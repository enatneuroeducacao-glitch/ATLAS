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
    app: "ATLAS II",
    version: "0.5.0",
    aiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    voiceConfigured: geminiConfigured || piperConfigured,
    voiceProviders: {
      geminiConfigured,
      piperConfigured,
      fallbackEnabled: piperConfigured
    },
    voicePolicy: "gemini-primary-piper-fallback",
    voiceModel: process.env.GEMINI_TTS_MODEL?.trim() || "gemini-3.8-flash-tts",
    timestamp: new Date().toISOString()
  });
}
