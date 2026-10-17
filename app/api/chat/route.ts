import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Cloudflare test deployment uses the isolated Render staging API, which owns
// the Gemini key and Piper token. No provider secrets are bundled into Worker code.
const BACKEND = "https://atlas-assistant-voice-staging.onrender.com";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (!body || body.length > 200_000) {
      return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
    }

    const headers = new Headers({ "Content-Type": "application/json" });
    const clientIp = request.headers.get("cf-connecting-ip");
    if (clientIp) headers.set("X-Forwarded-For", clientIp);

    const response = await fetch(`${BACKEND}/api/chat`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(30000),
      cache: "no-store"
    });

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json(
      { error: "O serviço de IA de teste está indisponível. Tente novamente em instantes." },
      { status: 502 }
    );
  }
}
