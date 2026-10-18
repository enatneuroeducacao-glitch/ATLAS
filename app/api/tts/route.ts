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

    if (!allowRequest(request)) {
      return NextResponse.json({ error: "Muitas solicitações de voz. Aguarde um minuto." }, { status: 429 });
    }

    const body = await request.json() as { text?: unknown };
    if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 4096) {
      return NextResponse.json({ error: "Texto inválido. O limite é de 4.096 caracteres." }, { status: 400 });
    }

    const piperUrl = process.env.PIPER_TTS_URL?.trim().replace(/\/+$/, "");
    const piperToken = process.env.PIPER_API_TOKEN?.trim();
    if (!piperUrl || !piperToken) {
      console.error("ATLAS Piper TTS is not configured:", JSON.stringify({
        urlConfigured: Boolean(piperUrl),
        tokenConfigured: Boolean(piperToken)
      }));
      return NextResponse.json({
        error: "A voz Piper não está configurada corretamente na homologação. Confira PIPER_TTS_URL e PIPER_API_TOKEN no Render."
      }, { status: 503 });
    }

    let piperResponse: Response;
    try {
      piperResponse = await fetch(`${piperUrl}/v1/audio/speech`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${piperToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: body.text.trim() }),
        signal: AbortSignal.timeout(100000)
      });
    } catch (error) {
      console.error("ATLAS Piper TTS connection error:", error instanceof Error ? error.name : "unknown");
      return NextResponse.json({
        error: "O serviço Piper não respondeu a tempo. Tente um texto menor; se persistir, verifique o serviço de voz no Render."
      }, { status: 504 });
    }

    if (!piperResponse.ok) {
      console.error("ATLAS Piper TTS provider error:", piperResponse.status);
      if (piperResponse.status === 401 || piperResponse.status === 403) {
        return NextResponse.json({
          error: "A autenticação do Piper falhou. PIPER_API_TOKEN precisa ser idêntico nos dois serviços de homologação."
        }, { status: 502 });
      }
      if (piperResponse.status === 503) {
        return NextResponse.json({
          error: "O Piper está sem autenticação ou o modelo de voz não está disponível. Confira /health no serviço Piper."
        }, { status: 503 });
      }
      if (piperResponse.status === 504) {
        return NextResponse.json({
          error: "O Piper excedeu o tempo de geração. Tente uma frase menor ou aguarde o serviço terminar de iniciar."
        }, { status: 504 });
      }
      return NextResponse.json({ error: "O Piper não conseguiu gerar o áudio. Verifique os logs do serviço de voz." }, { status: 502 });
    }

    const contentType = piperResponse.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("audio/")) {
      console.error("ATLAS Piper TTS returned unexpected content type:", contentType || "missing");
      return NextResponse.json({ error: "O Piper respondeu sem um arquivo de áudio válido." }, { status: 502 });
    }

    return new Response(await piperResponse.arrayBuffer(), {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("ATLAS TTS error:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Falha ao gerar áudio." }, { status: 500 });
  }
}
