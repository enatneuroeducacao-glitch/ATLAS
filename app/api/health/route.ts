import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ status: "ok", app: "ATLAS", version: "0.1.0", aiConfigured: Boolean(process.env.OPENAI_API_KEY), timestamp: new Date().toISOString() });
}