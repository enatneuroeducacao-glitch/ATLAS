import { auth } from "@/lib/auth/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SAMPLE_CHARS = 3000;
const MODELS = {
  kokoro: "ATLAS VOICE ENGINE · Kokoro",
  piper: "Piper TTS · serviço próprio",
  gemini: "Gemini Neural TTS · referência externa",
} as const;

type Provider = keyof typeof MODELS;

async function authorized() {
  const { data: session } = await auth.getSession();
  const user = session?.user as ({ role?: string } & Record<string, unknown>) | undefined;
  return Boolean(user && user.role === "admin");
}

function configured(provider: Provider) {
  if (provider === "kokoro") return Boolean(process.env.ATLAS_VOICE_ENGINE_URL?.trim() && process.env.ATLAS_VOICE_ENGINE_TOKEN?.trim());
  if (provider === "piper") return Boolean(process.env.PIPER_TTS_URL?.trim() && process.env.PIPER_API_TOKEN?.trim());
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

async function requestAudio(provider: Provider, text: string): Promise<Response> {
  if (provider === "kokoro" || provider === "piper") {
    const base = provider === "kokoro" ? process.env.ATLAS_VOICE_ENGINE_URL : process.env.PIPER_TTS_URL;
    const token = provider === "kokoro" ? process.env.ATLAS_VOICE_ENGINE_TOKEN : process.env.PIPER_API_TOKEN;
    const response = await fetch(`${base!.trim().replace(/\/+$/, "")}/v1/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(180000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${MODELS[provider]} respondeu HTTP ${response.status}.`);
    if (!(response.headers.get("content-type") || "").includes("audio/")) throw new Error("O serviço não retornou um arquivo de áudio.");
    return response;
  }

  const apiKey = process.env.GEMINI_API_KEY!;
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-lite-tts",
      input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: "Leia exatamente o texto em português brasileiro, com dicção clara, ritmo natural e sem acrescentar ou omitir palavras." }] }] }],
      response_format: { type: "audio", mime_type: "audio/wav", sample_rate: 24000 },
      generation_config: { speech_config: [{ voice: process.env.GEMINI_TTS_VOICE || "Orus" }] },
    }),
    signal: AbortSignal.timeout(120000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Gemini TTS respondeu HTTP ${response.status}.`);
  const data = await response.json();
  const direct = data?.output_audio?.data;
  let encoded = typeof direct === "string" ? direct : null;
  if (!encoded && Array.isArray(data?.steps)) {
    for (let i = data.steps.length - 1; i >= 0 && !encoded; i--) {
      const parts = Array.isArray(data.steps[i]?.content) ? data.steps[i].content : [];
      for (let j = parts.length - 1; j >= 0; j--) {
        if (parts[j]?.type === "audio" && typeof parts[j]?.data === "string") { encoded = parts[j].data; break; }
      }
    }
  }
  if (!encoded) throw new Error("O Gemini não retornou áudio nesta resposta.");
  return new Response(Buffer.from(encoded, "base64"), { headers: { "Content-Type": "audio/wav" } });
}

export async function GET() {
  if (!(await authorized())) return NextResponse.json({ error: "Acesso restrito à administração do ATLAS." }, { status: 401 });
  return NextResponse.json({
    providers: (Object.keys(MODELS) as Provider[]).map(id => ({ id, name: MODELS[id], configured: configured(id), role: id === "gemini" ? "referência externa" : id === "kokoro" ? "motor próprio em avaliação" : "alternativa auto-hospedada" })),
    sampleLimit: MAX_SAMPLE_CHARS,
  });
}

export async function POST(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: "Acesso administrativo necessário." }, { status: 401 });
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });

  try {
    const body = await request.json() as { provider?: Provider; text?: string };
    const provider = body.provider;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!provider || !(provider in MODELS)) return NextResponse.json({ error: "Selecione um mecanismo válido." }, { status: 400 });
    if (!text || text.length > MAX_SAMPLE_CHARS) return NextResponse.json({ error: `A amostra deve conter entre 1 e ${MAX_SAMPLE_CHARS} caracteres.` }, { status: 400 });
    if (!configured(provider)) return NextResponse.json({ error: "Este mecanismo ainda não está configurado no servidor." }, { status: 503 });

    const audio = await requestAudio(provider, text);
    const bytes = new Uint8Array(await audio.arrayBuffer());
    return new Response(bytes, {
      headers: {
        "Content-Type": audio.headers.get("content-type") || "audio/wav",
        "Cache-Control": "private, no-store",
        "X-ATLAS-Lab-Provider": provider,
        "X-ATLAS-Lab-Text-Chars": String(text.length),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao gerar a amostra." }, { status: 502 });
  }
}
