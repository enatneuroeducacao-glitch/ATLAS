import { NextResponse } from "next/server";
import { searchLocalKnowledge } from "@/lib/knowledge/local-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isLocalRequest(request: Request): boolean {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export async function POST(request: Request) {
  if (process.env.ATLAS_LOCAL_KNOWLEDGE_ENABLED !== "true" || !isLocalRequest(request)) {
    return NextResponse.json({ error: "Pesquisa local desativada ou acessada fora do computador local." }, { status: 403 });
  }
  try {
    const body = await request.json() as { query?: unknown };
    if (typeof body.query !== "string" || body.query.trim().length < 2 || body.query.length > 500) {
      return NextResponse.json({ error: "Informe uma pergunta entre 2 e 500 caracteres." }, { status: 400 });
    }
    const results = await searchLocalKnowledge(body.query.trim());
    return NextResponse.json({ results, count: results.length });
  } catch {
    return NextResponse.json({ error: "Não foi possível pesquisar a biblioteca local." }, { status: 500 });
  }
}
