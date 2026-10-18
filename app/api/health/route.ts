import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const piperConfigured = Boolean(
    process.env.PIPER_TTS_URL?.trim() &&
    process.env.PIPER_API_TOKEN?.trim()
  );

  return NextResponse.json({
    status: "ok",
    app: "ATLAS",
    version: "0.1.0",
    aiProvider: "gemini",
    aiConfigured: geminiConfigured,
    voiceProvider: "piper",
    voiceConfigured: piperConfigured,
    timestamp: new Date().toISOString()
  });
}
