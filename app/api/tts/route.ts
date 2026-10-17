import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Piper and its token remain isolated in the Render staging environment.
const BACKEND = "https://atlas-assistant-voice-staging.onrender.com";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (!body || body.length > 20_000) {
      return NextResponse.json({ error: "Solicitação de voz inválida." }, { status: 400 });
    }

    const headers = new Headers({ "Content-Type": "application/json" });
    const clientIp = request.headers.get("cf-connecting-ip");
    if (clientIp) headers.set("X-Forwarded-For", clientIp);

    const response = await fetch(`${BACKEND}/api/tts`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(100000),
      cache: "no-store"
    });

    const contentType = response.headers.get("content-type") || "application/json";
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json(
      { error: "O serviço de voz de teste está indisponível. Tente novamente em instantes." },
      { status: 502 }
    );
  }
}
