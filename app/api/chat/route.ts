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
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ error: "Configure GEMINI_API_KEY nas variáveis de ambiente do Render para ativar o chat do ATLAS com Google Gemini." }, { status: 503 });
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || "gemini-2.5-flash"}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: ATLAS_INSTRUCTIONS }] },
        contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      }),
      signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) {
      let providerCode = "";
      let providerMessage = "";
      try {
        const providerError = await response.json() as { error?: { code?: number; status?: string; message?: string } };
        providerCode = providerError.error?.status || String(providerError.error?.code || "");
        providerMessage = providerError.error?.message || "";
      } catch {}
      console.error("ATLAS Gemini provider error:", response.status, providerCode);
      if (response.status === 400 || response.status === 403) return NextResponse.json({ error: "O Google Gemini recusou a solicitação. Confira se GEMINI_API_KEY é válida e se a API Gemini está habilitada no projeto Google." }, { status: 502 });
      if (response.status === 401) return NextResponse.json({ error: "A chave GEMINI_API_KEY foi recusada. Confira a variável no Render." }, { status: 502 });
      if (response.status === 429) return NextResponse.json({ error: "O Google Gemini atingiu o limite de uso ou de cota gratuita. Confira os limites do projeto no Google AI Studio e tente novamente mais tarde." }, { status: 429 });
      if (response.status === 404) return NextResponse.json({ error: "O modelo Gemini configurado não está disponível. Confira GEMINI_MODEL no Render." }, { status: 502 });
      return NextResponse.json({ error: "O serviço Google Gemini não conseguiu processar a solicitação. Confira a configuração da API e tente novamente." }, { status: 502 });
    }
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>; promptFeedback?: { blockReason?: string } };
    const reply = data.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
    if (!reply) return NextResponse.json({ error: data.promptFeedback?.blockReason ? "O Google Gemini bloqueou essa solicitação por suas regras de segurança. Reformule a mensagem." : "O Google Gemini não retornou uma resposta. Tente novamente." }, { status: 502 });
    return NextResponse.json({ reply });
  } catch (error) { console.error("ATLAS chat error:", error); return NextResponse.json({ error: "Falha ao processar a mensagem. Tente novamente." }, { status: 500 }); }
}
