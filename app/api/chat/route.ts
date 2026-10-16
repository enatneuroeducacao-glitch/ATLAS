import { NextResponse } from "next/server";
export const runtime = "nodejs";
type Msg = { role: "user" | "assistant"; content: string };
export async function POST(request: Request) {
  try {
    const body = await request.json() as { messages?: Msg[] };
    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    if (!messages.length || messages.some(m => !m || !["user","assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 8000)) return NextResponse.json({ error: "Mensagens inválidas." }, { status: 400 });
    const key = process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ reply: "Estou funcionando em modo inicial. Configure OPENAI_API_KEY nas variáveis do servidor para ativar o motor de IA. O painel e a interface de voz podem ser testados sem essa chave." });
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", instructions: "Você é ATLAS, assistente pessoal em português brasileiro. Seja objetivo e seguro. Não alegue ter executado ações externas sem confirmação verificável. Para ações críticas, explique riscos e peça autorização específica. Nunca solicite nem revele segredos.", input: messages.map(m => ({ role: m.role, content: m.content })) }),
      signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) { console.error("ATLAS AI provider error:", response.status); return NextResponse.json({ error: "O serviço de IA falhou. Verifique a chave e o modelo configurados no servidor." }, { status: 502 }); }
    const data = await response.json() as { output_text?: string };
    return NextResponse.json({ reply: data.output_text || "Não consegui gerar uma resposta." });
  } catch (error) { console.error("ATLAS chat error:", error); return NextResponse.json({ error: "Falha ao processar a mensagem. Tente novamente." }, { status: 500 }); }
}