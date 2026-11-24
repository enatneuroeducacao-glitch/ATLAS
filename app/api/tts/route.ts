import { auth } from "@/lib/auth/server";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { cleanTextForSpeech } from "@/lib/speech-text";

export const runtime = "nodejs";

const buckets = new Map<string, { count: number; resetAt: number }>();
const cache = new Map<string, { audio: Uint8Array; createdAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const MAX_TTS_CHARS = 30_000;
const CACHE_TTL = 10 * 60_000;
const PRIMARY_MODEL = process.env.GEMINI_TTS_MODEL?.trim() || "gemini-3.8-flash-tts";
const FALLBACK_MODEL = "gemini-3.8-flash-lite-tts";
const modelCooldowns = new Map<string, number>();

function isWav(bytes: Uint8Array): boolean {
  return bytes.length >= 44 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
}

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

class GeminiRateLimitError extends Error {
  cooldownMs: number;
  constructor(cooldownMs: number) {
    super("Limite temporário de solicitações do Gemini atingido.");
    this.name = "GeminiRateLimitError";
    this.cooldownMs = cooldownMs;
  }
}

function parseRetryDelay(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\\d+(?:\\.\\d+)?)(ms|s|m|h)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  return amount * (unit === "ms" ? 1 : unit === "s" ? 1000 : unit === "m" ? 60_000 : 3_600_000);
}

function getQuotaCooldown(response: Response, errorText: string): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date) && date > Date.now()) return date - Date.now();
  }

  try {
    const payload = JSON.parse(errorText);
    const details = JSON.stringify(payload?.error?.details ?? payload);
    const retryInfo = payload?.error?.details?.find?.((item: any) =>
      item?.["@type"]?.includes("RetryInfo")
    );
    const retryDelay = parseRetryDelay(retryInfo?.retryDelay);
    if (retryDelay) return retryDelay;
    const quotaText = (details + " " + errorText).toLowerCase();
    if (/per.?day|requests.?per.?day|daily.?quota|rpd/.test(quotaText)) {
      const nextUtcDay = new Date();
      nextUtcDay.setUTCHours(24, 5, 0, 0);
      return Math.max(60_000, nextUtcDay.getTime() - Date.now());
    }
    if (/per.?minute|requests.?per.?minute|rpm/.test(quotaText)) return 60_000;
  } catch {
    // Use a conservative short cooldown when the provider does not return structured details.
  }
  return 5 * 60_000;
}

async function requestGeminiSpeech(apiKey: string, text: string, model: string): Promise<Uint8Array | null> {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [{
        type: "user_input",
        content: [{
          type: "text",
          text,
          annotations: [{
            type: "speech_metadata",
            style: "Fale em português brasileiro natural, como um homem adulto com voz grave, encorpada, firme e acolhedora. Timbre masculino de registro médio-grave, ressonância natural, articulação clara e ritmo de conversa. Use entonação humana, variação melódica discreta, pausas curtas entre ideias e ênfase suave nos pontos importantes. Soe como um instrutor experiente conversando diretamente com uma pessoa, nunca como locutor de GPS, leitura automática, robô ou voz excessivamente teatral. Pronuncie siglas e termos técnicos com clareza. Leia somente o texto fornecido, sem acrescentar palavras."
          }]
        }]
      }],
      response_format: { type: "audio", mime_type: "audio/wav", sample_rate: 24000 },
      generation_config: { speech_config: [{ voice: process.env.GEMINI_TTS_VOICE || "Orus" }] }
    }),
    signal: AbortSignal.timeout(90_000)
  });

  if (!response.ok) {
    const rawError = await response.text().catch(() => "");
    const detail = rawError.replace(/[\\r\\n\\t]+/g, " ").slice(0, 400);
    console.error("ATLAS Gemini TTS provider error:", model, response.status, detail);
    if (response.status === 429) throw new GeminiRateLimitError(getQuotaCooldown(response, rawError));
    return null;
  }

  const data = await response.json();
  const audio = audioFromInteraction(data);
  if (!audio?.length) {
    console.error("ATLAS Gemini TTS returned no audio payload:", model);
    return null;
  }

  const bytes = new Uint8Array(audio);
  if (!isWav(bytes)) {
    console.error("ATLAS Gemini TTS returned an invalid WAV payload:", model);
    return null;
  }
  return bytes;
}

async function requestPiperSpeech(text: string): Promise<Uint8Array | null> {
  const baseUrl = process.env.PIPER_TTS_URL?.trim().replace(/\\/+$/, "");
  const token = process.env.PIPER_API_TOKEN?.trim();
  if (!baseUrl || !token) return null;

  const response = await fetch(`${baseUrl}/v1/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(100_000)
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).replace(/[\\r\\n\\t]+/g, " ").slice(0, 300);
    console.error("ATLAS Piper TTS provider error:", response.status, detail);
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("audio/")) {
    console.error("ATLAS Piper TTS returned unexpected content type:", contentType || "missing");
    return null;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!isWav(bytes)) {
    console.error("ATLAS Piper TTS returned an invalid WAV payload");
    return null;
  }
  return bytes;
}

export async function POST(request: Request) {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Sessão necessária. Entre no ATLAS para continuar." }, { status: 401 });
    }

    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) {
          return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
      }
    }

    if (!allowRequest(request)) {
      return NextResponse.json({ error: "Limite temporário de voz atingido. Aguarde um minuto." }, { status: 429 });
    }

    const body = await request.json() as { text?: unknown };
    if (typeof body.text !== "string" || !body.text.trim() || body.text.length > MAX_TTS_CHARS) {
      return NextResponse.json({ error: "Texto inválido. O limite é de 30.000 caracteres." }, { status: 400 });
    }

    const speechText = cleanTextForSpeech(body.text);
    if (!speechText) {
      return NextResponse.json({ error: "Não há texto para leitura." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const piperConfigured = Boolean(process.env.PIPER_TTS_URL?.trim() && process.env.PIPER_API_TOKEN?.trim());
    if (!apiKey && !piperConfigured) {
      console.error("ATLAS TTS is not configured: neither Gemini nor Piper credentials are available");
      return NextResponse.json({ error: "Nenhum mecanismo de voz está configurado no servidor do ATLAS." }, { status: 503 });
    }

    const key = createHash("sha256").update(speechText).digest("hex");
    const cached = cache.get(key);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL) {
      return new Response(toResponseBuffer(cached.audio), {
        headers: {
          "Content-Type": "audio/wav",
          "Cache-Control": "private, max-age=600",
          "X-ATLAS-Voice": "gemini-neural-cache"
        }
      });
    }
    if (cached) cache.delete(key);

    // Gemini is preferred when available. Piper is the self-hosted fallback,
    // including when Gemini is unconfigured, rate-limited, or temporarily unavailable.
    const models = apiKey ? [...new Set([PRIMARY_MODEL, FALLBACK_MODEL].filter(Boolean))] : [];
    let audio: Uint8Array | null = null;
    const now = Date.now();
    const blockedUntil: number[] = [];
    const availableModels = models.filter(model => {
      const until = modelCooldowns.get(model) || 0;
      if (until > now) {
        blockedUntil.push(until);
        return false;
      }
      if (until) modelCooldowns.delete(model);
      return true;
    });

    for (const model of availableModels) {
      try {
        audio = await requestGeminiSpeech(apiKey!, speechText, model);
        if (audio) {
          modelCooldowns.delete(model);
          break;
        }
      } catch (error) {
        if (error instanceof GeminiRateLimitError) {
          const until = Date.now() + error.cooldownMs;
          modelCooldowns.set(model, until);
          blockedUntil.push(until);
          console.warn("ATLAS Gemini TTS model cooling down:", model, Math.ceil(error.cooldownMs / 1000), "seconds");
          continue;
        }
        console.error("ATLAS Gemini TTS request failed:", model, error instanceof Error ? error.name : "unknown");
      }
    }

    let provider = "gemini-neural";
    if (!audio && piperConfigured) {
      try {
        audio = await requestPiperSpeech(speechText);
        if (audio) provider = "piper-self-hosted";
      } catch (error) {
        console.error("ATLAS Piper TTS request failed:", error instanceof Error ? error.name : "unknown");
      }
    }

    if (!audio && blockedUntil.length && !piperConfigured) {
      const retryAt = Math.min(...blockedUntil);
      const retryInSeconds = Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
      return NextResponse.json({
        error: "Os modelos de voz estão temporariamente limitados. O ATLAS não fará novas chamadas antes da próxima janela disponível.",
        retryAfterSeconds: retryInSeconds,
        retryAt: new Date(retryAt).toISOString()
      }, { status: 429, headers: { "Retry-After": String(retryInSeconds) } });
    }

    if (!audio) {
      return NextResponse.json({
        error: "Os mecanismos de voz estão temporariamente indisponíveis. O texto foi preservado; tente gerar o áudio novamente."
      }, { status: 503 });
    }

    cache.set(key, { audio, createdAt: Date.now() });
    if (cache.size > 40) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }

    return new Response(toResponseBuffer(audio), {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private, max-age=600",
        "X-ATLAS-Voice": provider
      }
    });
  } catch (error) {
    console.error("ATLAS TTS error:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Falha ao gerar áudio." }, { status: 500 });
  }
}
