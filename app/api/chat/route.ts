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
  if (!allowRequest(request)) return NextResponse.json({ error: "Limite de solicitações atingido. Aguarde um minuto e tente novamente." }, { status: 429 });
  try {
    const body = await request.json() as { messages?: Msg[] };
    const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    if (!messages.length || messages.some(m => !m || !["user","assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 8000)) return NextResponse.json({ error: "Mensagens inválidas." }, { status: 400 });
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ error: "Configure GEMINI_API_KEY nas variáveis de ambiente do Render para ativar respostas inteligentes do ATLAS." }, { status: 503 });
    const configuredModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const modelsToTry = configuredModel === "gemini-3.8-flash"
      ? [configuredModel, "gemini-3.6-flash"]
      : [configuredModel, "gemini-3.8-flash", "gemini-3.6-flash"].filter((model, index, list) => list.indexOf(model) === index);
    let response: Response | undefined;
    for (const model of modelsToTry) {
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: ATLAS_INSTRUCTIONS }] },
            contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
            generationConfig: { maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: "low" } }
          }),
          signal: AbortSignal.timeout(25000)
        });
        if (response.ok) break;
        console.error("ATLAS Gemini provider error:", model, response.status);
        if (![404, 429, 500, 502, 503, 504].includes(response.status)) break;
      } catch (error) {
        console.error("ATLAS Gemini request failed:", model, error instanceof Error ? error.name : "unknown");
        response = undefined;
      }
    }
    if (!response) return NextResponse.json({ error: "O provedor de IA demorou demais para responder. Aguarde alguns segundos e tente novamente." }, { status: 504 });
    if (!response.ok) {
      let providerCode = "";
      try {
        const providerError = await response.json() as { error?: { code?: number; status?: string; message?: string } };
        providerCode = providerError.error?.status || String(providerError.error?.code || "");
      } catch {}
      console.error("ATLAS Gemini final provider error:", response.status, providerCode);
      if (response.status === 400 || response.status === 403) return NextResponse.json({ error: "O provedor de IA recusou a solicitação. Confira a chave e se a API está habilitada." }, { status: 502 });
      if (response.status === 401) return NextResponse.json({ error: "A chave da API foi recusada. Confira a variável de ambiente no Render." }, { status: 502 });
      if (response.status === 429) return NextResponse.json({ error: "O provedor de IA atingiu o limite de uso ou cota. Confira os limites do projeto e tente novamente mais tarde." }, { status: 429 });
      if (response.status === 404) return NextResponse.json({ error: "Nenhum dos modelos configurados está disponível para esta chave. Confira o acesso à API." }, { status: 502 });
      return NextResponse.json({ error: "O provedor de IA está temporariamente indisponível. Tente novamente em instantes." }, { status: 502 });
    }
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>; promptFeedback?: { blockReason?: string } };
    const reply = data.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
    if (!reply) return NextResponse.json({ error: data.promptFeedback?.blockReason ? "O provedor de IA bloqueou essa solicitação por suas regras de segurança. Reformule a mensagem." : "O provedor de IA não retornou uma resposta. Tente novamente." }, { status: 502 });
    return NextResponse.json({ reply });
  } catch (error) { console.error("ATLAS chat error:", error); return NextResponse.json({ error: "Falha ao processar a mensagem. Tente novamente." }, { status: 500 }); }
}
