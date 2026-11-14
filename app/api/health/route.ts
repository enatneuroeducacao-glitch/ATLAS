import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ status: "ok", app: "ATLAS II", version: "0.2.0", aiConfigured: Boolean(process.env.GEMINI_API_KEY), timestamp: new Date().toISOString() });
}