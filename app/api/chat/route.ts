import { NextResponse } from "next/server";
import { ENAT_KNOWLEDGE } from "@/lib/enat-knowledge";
export const runtime = "nodejs";
type Msg = { role: "user" | "assistant"; content: string };
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 15;
function allowRequest(request: Request) {
  const now = Date.now();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const bucket = rateBuckets.get(forwarded);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(forwarded, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}
const ATLAS_INSTRUCTIONS = `Você é ATLAS, assistente pessoal em português brasileiro, objetivo, prático e seguro. Ajude o usuário com conhecimento geral e use a base ENAT abaixo quando pertinente. Não alegue ter executado ações externas sem confirmação verificável. Para ações críticas, explique riscos e peça autorização específica. Nunca solicite nem revele segredos. Diferencie propostas, estimativas, fatos verificados e hipóteses. Quando informações atuais sobre legislação, ciência, serviços ou sistemas forem necessárias e não estiverem disponíveis no contexto, declare a limitação e peça/verifique fontes antes de afirmar. Proteja dados pessoais.\n\nBASE DE CONHECIMENTO ENAT:\n${ENAT_KNOWLEDGE}`;
export async function POST(request: Request) {
  try {
    const body = await request.json() as { messages?: Msg[] };
    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    if (!messages.length || messages.some(m => !m || !["user","assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 8000)) return NextResponse.json({ error: "Mensagens inválidas." }, { status: 400 });
    const key = process.env.OPENAI_API_KEY;
    if (!key) return NextResponse.json({ reply: "Estou funcionando em modo inicial. A base de conhecimento do ENAT já está incorporada ao projeto, mas respostas inteligentes exigem configurar OPENAI_API_KEY no servidor. O painel e a interface de voz podem ser testados sem essa chave." });
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", instructions: ATLAS_INSTRUCTIONS, input: messages.map(m => ({ role: m.role, content: m.content })) }),
      signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) {
      let providerCode = "";
      let providerMessage = "";
      try {
        const providerError = await response.json() as { error?: { code?: string; type?: string; message?: string } };
        providerCode = providerError.error?.code || providerError.error?.type || "";
        providerMessage = providerError.error?.message || "";
      } catch {}
      console.error("ATLAS AI provider error:", response.status, providerCode);
      if (response.status === 401) return NextResponse.json({ error: "A chave da OpenAI foi recusada. Confira OPENAI_API_KEY no Render." }, { status: 502 });
      if (response.status === 429 && (providerCode === "insufficient_quota" || /quota|billing|credits/i.test(providerMessage))) {
        return NextResponse.json({ error: "A chave foi reconhecida, mas a conta da API OpenAI está sem cota/créditos disponíveis ou precisa de configuração de cobrança. Confira Billing e Usage na plataforma OpenAI; a assinatura do ChatGPT não inclui créditos da API." }, { status: 402 });
      }
      if (response.status === 429) return NextResponse.json({ error: "A API OpenAI recebeu solicitações demais no momento. Aguarde um minuto e tente novamente." }, { status: 429 });
      if (response.status === 404) return NextResponse.json({ error: "O modelo configurado não foi encontrado ou não está disponível para esta chave. Confira OPENAI_MODEL no Render." }, { status: 502 });
      return NextResponse.json({ error: "O serviço da OpenAI não conseguiu processar a solicitação. Confira a configuração da API e tente novamente." }, { status: 502 });
    }
    const data = await response.json() as { output_text?: string };
    return NextResponse.json({ reply: data.output_text || "Não consegui gerar uma resposta." });
  } catch (error) { console.error("ATLAS chat error:", error); return NextResponse.json({ error: "Falha ao processar a mensagem. Tente novamente." }, { status: 500 }); }
}
