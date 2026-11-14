import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "ATLAS II",
    version: "0.3.0",
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    voiceConfigured: Boolean(process.env.PIPER_TTS_URL && process.env.PIPER_API_TOKEN),
    voiceProvider: "piper",
    timestamp: new Date().toISOString()
  });
}
