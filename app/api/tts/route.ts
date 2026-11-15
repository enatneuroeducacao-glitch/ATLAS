import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { cleanTextForSpeech } from "@/lib/speech-text";

export const runtime = "nodejs";

const buckets = new Map<string, { count: number; resetAt: number }>();
const cache = new Map<string, { audio: Uint8Array; createdAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const MAX_TTS_CHARS = 10000;
const CACHE_TTL = 10 * 60_000;
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-lite-tts";

function toResponseBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function allowRequest(request: Request) {
  const now = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const bucket = buckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_REQUESTS) return false;
  bucket.count += 1;
  return true;
}

function audioFromInteraction(data: any): Buffer | null {
  const direct = data?.output_audio?.data;
  if (typeof direct === "string") return Buffer.from(direct, "base64");
  const steps = Array.isArray(data?.steps) ? data.steps : [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const parts = Array.isArray(steps[i]?.content) ? steps[i].content : [];
    for (let j = parts.length - 1; j >= 0; j--) {
      if (parts[j]?.type === "audio" && typeof parts[j]?.data === "string") {
        return Buffer.from(parts[j].data, "base64");
      }
    }
  }
  return null;
}

async function piperFallback(text: string): Promise<Response | null> {
  const url = process.env.PIPER_TTS_URL?.trim().replace(/\/+$/, "");
  const token = process.env.PIPER_API_TOKEN?.trim();
  if (!url || !token) return null;
  try {
    const response = await fetch(`${url}/v1/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(45000)
    });
    return response.ok && (response.headers.get("content-type") || "").includes("audio/") ? response : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
    }
    if (!allowRequest(request)) {
      return NextResponse.json({ error: "Limite temporário de voz atingido. Aguarde um minuto." }, { status: 429 });
    }
    const body = await request.json() as { text?: unknown };
    if (typeof body.text !== "string" || !body.text.trim() || body.text.length > MAX_TTS_CHARS) {
      return NextResponse.json({ error: "Texto inválido. O limite é de 10.000 caracteres." }, { status: 400 });
    }
    const speechText = cleanTextForSpeech(body.text);
    if (!speechText) return NextResponse.json({ error: "Não há texto para leitura." }, { status: 400 });

    const key = createHash("sha256").update(speechText).digest("hex");
    const cached = cache.get(key);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL) {
      return new Response(toResponseBuffer(cached.audio), { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=600", "X-ATLAS-Voice": "cache" } });
    }
    if (cached) cache.delete(key);

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: TTS_MODEL,
            input: [{
              type: "user_input",
              content: [{
                type: "text",
                text: speechText,
                annotations: [{
                  type: "speech_metadata",
                  style: "Fale em português brasileiro natural, como um homem adulto com voz grave, encorpada, firme e acolhedora. Timbre masculino de registro médio-grave, ressonância natural, articulação clara e ritmo de conversa. Use entonação humana, variação melódica discreta, pausas curtas entre ideias e ênfase suave nos pontos importantes. Soe como um instrutor experiente conversando diretamente com uma pessoa, nunca como locutor de GPS, leitura automática, robô ou voz excessivamente teatral. Pronuncie siglas e termos técnicos com clareza. Leia somente o texto fornecido, sem acrescentar palavras."
                }]
              }]
            }],
            response_format: { type: "audio", mime_type: "audio/wav", sample_rate: 24000 },
            generation_config: { speech_config: [{ voice: process.env.GEMINI_TTS_VOICE || "Orus" }] }
          }),
          signal: AbortSignal.timeout(90000)
        });
        if (response.ok) {
          const data = await response.json();
          const audio = audioFromInteraction(data);
          if (audio?.length) {
            const bytes = new Uint8Array(audio);
            cache.set(key, { audio: bytes, createdAt: Date.now() });
            if (cache.size > 40) {
              const oldest = cache.keys().next().value;
              if (oldest) cache.delete(oldest);
            }
            return new Response(toResponseBuffer(bytes), { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=600", "X-ATLAS-Voice": "gemini-neural" } });
          }
          console.error("ATLAS Gemini TTS returned no audio payload");
        } else {
          const detail = (await response.clone().text().catch(() => "")).slice(0, 300);
          console.error("ATLAS Gemini TTS error:", response.status, detail);
        }
      } catch (error) {
        console.error("ATLAS Gemini TTS request failed:", error instanceof Error ? error.name : "unknown");
      }
    }

    // No paid provider is called. Piper is the local/self-hosted zero-cost fallback.
    const piper = await piperFallback(speechText);
    if (piper) {
      const bytes = new Uint8Array(await piper.arrayBuffer());
      return new Response(toResponseBuffer(bytes), { headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=300", "X-ATLAS-Voice": "piper-fallback" } });
    }
    return NextResponse.json({
      error: "A voz neural gratuita está temporariamente indisponível. O texto da resposta foi preservado; tente reproduzir novamente mais tarde."
    }, { status: 503 });
  } catch (error) {
    console.error("ATLAS TTS error:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Falha ao gerar áudio." }, { status: 500 });
  }
}
