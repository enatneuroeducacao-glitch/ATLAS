import { NextResponse } from "next/server";

export const runtime = "nodejs";

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;

function allowRequest(request: Request) {
  const now = Date.now();
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const bucket = rateBuckets.get(client);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(client, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
      } catch {
        return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
      }
    }
    if (!allowRequest(request)) return NextResponse.json({ error: "Muitas solicitações de voz. Aguarde um minuto." }, { status: 429 });
    const body = await request.json() as { text?: unknown };
    if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 4096) {
      return NextResponse.json({ error: "Texto inválido. O limite é de 4.096 caracteres." }, { status: 400 });
    }
    const piperUrl = process.env.PIPER_TTS_URL?.trim().replace(/\/+$/, "");
    if (piperUrl) {
      const piperToken = process.env.PIPER_API_TOKEN;
      if (!piperToken) return NextResponse.json({ error: "Piper TTS está selecionado, mas PIPER_API_TOKEN não foi configurado no servidor." }, { status: 503 });
      let piperResponse: Response;
      try {
        piperResponse = await fetch(`${piperUrl}/v1/audio/speech`, {
          method: "POST",
          headers: { Authorization: `Bearer ${piperToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ text: body.text.trim() }),
          signal: AbortSignal.timeout(95000)
        });
      } catch (error) {
        console.error("ATLAS Piper TTS connection error:", error instanceof Error ? error.name : "unknown");
        return NextResponse.json({ error: "O serviço gratuito de voz Piper está indisponível. Tente novamente em instantes." }, { status: 502 });
      }
      if (!piperResponse.ok) {
        console.error("ATLAS Piper TTS provider error:", piperResponse.status);
        if (piperResponse.status === 401 || piperResponse.status === 403) return NextResponse.json({ error: "A autenticação do serviço Piper falhou. Confira PIPER_API_TOKEN nos dois serviços." }, { status: 502 });
        if (piperResponse.status === 504) return NextResponse.json({ error: "A geração da voz Piper demorou demais. Tente um texto menor." }, { status: 504 });
        return NextResponse.json({ error: "O Piper não conseguiu gerar o áudio. Verifique o serviço de voz." }, { status: 502 });
      }
      return new Response(await piperResponse.arrayBuffer(), {
        headers: {
          "Content-Type": "audio/wav",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }
    const key = process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ error: "A chave da IA não está configurada no servidor." }, { status: 503 });
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
        voice: process.env.OPENAI_TTS_VOICE || "marin",
        input: body.text.trim(),
        instructions: "Fale em português brasileiro natural, com voz acolhedora, fluida e profissional. Use ritmo moderado, entonação expressiva e pausas naturais. Evite soar robótico. Pronuncie siglas e termos técnicos claramente.",
        response_format: "mp3",
        speed: 1.0
      }),
      signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) {
      let providerCode = "";
      let providerMessage = "";
      try {
        const providerError = await response.json() as { error?: { code?: string; type?: string; message?: string } };
        providerCode = providerError.error?.code || providerError.error?.type || "";
        providerMessage = providerError.error?.message || "";
      } catch {}
      console.error("ATLAS TTS provider error:", response.status, providerCode);
      if (response.status === 401) return NextResponse.json({ error: "A chave da OpenAI foi recusada. Confira OPENAI_API_KEY no Render." }, { status: 502 });
      if (response.status === 429 && (providerCode === "insufficient_quota" || /quota|billing|credits/i.test(providerMessage))) {
        return NextResponse.json({ error: "A voz neural está indisponível porque a conta da API OpenAI está sem cota/créditos ou precisa de configuração de cobrança. Confira Billing e Usage na plataforma OpenAI." }, { status: 402 });
      }
      if (response.status === 429) return NextResponse.json({ error: "Limite temporário da API de áudio atingido. Aguarde um minuto e tente novamente." }, { status: 429 });
      return NextResponse.json({ error: "Não foi possível gerar a voz neural. Confira o modelo e o acesso à API de áudio." }, { status: 502 });
    }
    return new Response(await response.arrayBuffer(), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("ATLAS TTS error:", error);
    return NextResponse.json({ error: "Falha ao gerar áudio." }, { status: 500 });
  }
}
