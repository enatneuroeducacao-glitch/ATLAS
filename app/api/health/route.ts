import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "ATLAS II",
    version: "0.4.0",
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    voiceConfigured: Boolean(process.env.GEMINI_API_KEY || (process.env.PIPER_TTS_URL && process.env.PIPER_API_TOKEN)),
    voiceProvider: process.env.GEMINI_API_KEY ? "gemini-neural-free-tier-with-piper-fallback" : "piper-fallback",
    voiceModel: process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-lite-tts",
    timestamp: new Date().toISOString()
  });
}
