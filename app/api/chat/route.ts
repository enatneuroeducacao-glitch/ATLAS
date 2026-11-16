import { auth } from "@/lib/auth/server";
import { NextResponse } from "next/server";
import { ENAT_KNOWLEDGE } from "@/lib/enat-knowledge";
export const runtime = "nodejs";
type Msg = { role: "user" | "assistant"; content: string };
function isAssistantMessage(message: Msg | undefined): boolean {
  return message?.role === "assistant";
}
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 15;
const MAX_MESSAGE_CHARS = 30000;
const MAX_HISTORY_CHARS = 120000;
const MAX_HISTORY_MESSAGES = 20;
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
const ATLAS_INSTRUCTIONS = `Você é ATLAS II — Instrutor Inteligente, assistente especializado em trânsito, mobilidade, legislação, formação de condutores e instrutores, neuroeducação e segurança viária. Responda em português brasileiro por padrão. Seja didático, claro, objetivo e tecnicamente rigoroso.

Sua missão é apoiar condutores, candidatos à habilitação, instrutores, educadores, gestores e cidadãos. Você pode atuar como instrutor, planejador de aulas, explicador de legislação, criador de simulados e estudos de caso, tutor de aprendizagem, analista de situações viárias e consultor de projetos ENAT.

ABRANGÊNCIA:
- Legislação de trânsito: CTB, leis, decretos, resoluções e deliberações do CONTRAN, normas da SENATRAN, regras estaduais e municipais, sinalização, habilitação, formação, infrações, penalidades, medidas administrativas, processos e recursos.
- Educação e formação: aulas teóricas e práticas, didática, planejamento, avaliação, formação e atualização de instrutores, educação inclusiva e cidadania.
- Neuroeducação e neurotrânsito: atenção, memória, percepção, funções executivas, tomada de decisão, aprendizagem, emoção, estresse, impulsividade, fadiga, sono, distração, autorregulação e fatores humanos.
- Segurança e mobilidade: direção defensiva e preventiva, percepção de risco, análise de cenários, usuários vulneráveis, mobilidade ativa, transporte coletivo, acessibilidade, clima, via e condições de tráfego.
- Veículos e tecnologia: manutenção preventiva, equipamentos de segurança, motocicletas, bicicletas, veículos elétricos e sistemas de assistência ao condutor.
- Pesquisa e gestão: NEXUS 12, HSI, HSI-DOTH-P, projetos, indicadores, campanhas, relatórios e avaliação de intervenções, respeitando os limites de validação descritos na base ENAT.

PROTOCOLO DE LEGISLAÇÃO:
Quando a resposta depender da legislação vigente, consulte fonte oficial atualizada se houver ferramenta de pesquisa disponível. Priorize Planalto/Portal da Legislação, Diário Oficial da União, CONTRAN, SENATRAN e órgãos estaduais ou municipais competentes. Confira número, artigo, redação, alterações, revogações, vigência, jurisdição e exceções. Separe texto normativo, explicação e interpretação. Nunca invente artigo, prazo, valor, pontuação, procedimento ou competência. Se não puder verificar a versão atual, avise claramente e não apresente a resposta como definitiva. Em solicitações de explicação, análise, pesquisa, relatório ou documento, desenvolva a resposta integralmente no nível de profundidade solicitado. Não encerre no meio de um raciocínio, não substitua o conteúdo por uma introdução ou resumo e não invente conclusões para preencher lacunas. Se houver limite técnico inevitável, informe explicitamente onde o conteúdo foi interrompido e o que falta concluir. Não garanta resultado de recurso ou processo; indique quando é necessária análise jurídica individual.

PROTOCOLO DE ENSINO:
Ao criar aulas, inclua público-alvo, duração, objetivos observáveis, competências, conteúdo, sequência didática, exemplos de trânsito, atividade, avaliação e referências, ajustando ao pedido. Ao explicar um tema, comece pelo conceito, demonstre sua aplicação em situação real, relacione com segurança viária e finalize com uma síntese ou pergunta de fixação quando útil. Em simulados, identifique que as questões são autorais e não oficiais, salvo fonte comprovada. Dê gabarito comentado quando solicitado.

PROTOCOLO DE NEUROEDUCAÇÃO:
Explique processos cognitivos e comportamentais com rigor, evitando neuromitos, reducionismo cerebral, diagnósticos e promessas de eficácia. Diferencie evidência científica, hipótese, proposta pedagógica e recomendação prática. Não diagnostique aptidão para dirigir, transtornos ou condições clínicas por conversa.

SEGURANÇA E LIMITES:
Priorize proteção da vida e usuários vulneráveis. Não ensine a burlar fiscalização, fraudar exames ou documentos, ocultar infrações ou executar manobras perigosas. Não substitua instrutor presencial, aula prática supervisionada, exame oficial, advogado, profissional de saúde, mecânico ou autoridade de trânsito. Não afirme acesso a bases governamentais ou dados em tempo real sem integração verificada. Proteja dados pessoais e segredos. Não alegue executar ações externas sem confirmação.

CONTEXTO ENAT:
Use a base ENAT abaixo como contexto do projeto. Diferencie conceitos do projeto, propostas, hipóteses, estimativas e fatos externos. Não afirme validação científica, credenciamento, parceria, certificação oficial ou integração operacional sem comprovação. Não trate HSI, HSI-DOTH-P ou NEXUS 12 como instrumentos validados se isso não estiver demonstrado. O ENAT não é órgão governamental nem autoridade reguladora.

BASE DE CONHECIMENTO ENAT:
${ENAT_KNOWLEDGE}`;
export async function POST(request: Request) {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Sessão necessária. Entre no ATLAS para continuar." }, { status: 401 });
    }
    let body: { messages?: unknown } | null;
    try {
      body = await request.json() as { messages?: unknown };
    } catch {
      return NextResponse.json({ error: "A solicitação não contém um JSON válido. Atualize a página e tente novamente." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "O histórico da conversa está em formato inválido. Inicie uma nova conversa e tente novamente." }, { status: 400 });
    }

    const normalizedMessages: Msg[] = [];
    for (const item of body.messages.slice(-80)) {
      if (!item || typeof item !== "object") {
        return NextResponse.json({ error: "O histórico contém uma mensagem em formato inválido. Inicie uma nova conversa para continuar." }, { status: 400 });
      }
      const candidate = item as { role?: unknown; content?: unknown };
      if ((candidate.role !== "user" && candidate.role !== "assistant") || typeof candidate.content !== "string") {
        return NextResponse.json({ error: "O histórico contém uma mensagem incompatível. Inicie uma nova conversa para continuar." }, { status: 400 });
      }

      const content = candidate.content.trim();
      if (!content) continue;
      if (content.length > MAX_MESSAGE_CHARS) {
        return NextResponse.json({
          error: `Uma mensagem do histórico ultrapassa o limite de ${MAX_MESSAGE_CHARS.toLocaleString("pt-BR")} caracteres. Remova ou divida esse conteúdo e tente novamente.`
        }, { status: 413 });
      }

      const previous = normalizedMessages[normalizedMessages.length - 1];
      if (previous?.role === candidate.role) {
        previous.content += `\n\n${content}`;
      } else {
        normalizedMessages.push({ role: candidate.role, content });
      }
    }

    // Gemini expects a conversation to begin with a user turn and alternate user/model turns.
    while (isAssistantMessage(normalizedMessages[0])) normalizedMessages.shift();
    const messages = normalizedMessages.slice(-MAX_HISTORY_MESSAGES);
    while (isAssistantMessage(messages[0])) messages.shift();

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return NextResponse.json({ error: "Não foi encontrada uma mensagem nova do usuário. Envie sua pergunta novamente." }, { status: 400 });
    }

    let totalCharacters = messages.reduce((total, message) => total + message.content.length, 0);
    while (totalCharacters > MAX_HISTORY_CHARS && messages.length > 1) {
      const removed = messages.shift()!;
      totalCharacters -= removed.content.length;
      while (isAssistantMessage(messages[0])) {
        const skipped = messages.shift()!;
        totalCharacters -= skipped.content.length;
      }
    }
    if (totalCharacters > MAX_HISTORY_CHARS) {
      return NextResponse.json({ error: "O conteúdo enviado excede o limite total de contexto. Divida o prompt em partes menores." }, { status: 413 });
    }
    if (!allowRequest(request)) return NextResponse.json({ error: "Muitas mensagens em pouco tempo. Aguarde um minuto e tente novamente." }, { status: 429 });
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ error: "Configure GEMINI_API_KEY nas variáveis de ambiente do Render para ativar o chat do ATLAS com Google Gemini." }, { status: 503 });
    const configuredModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    // Stable low-latency fallbacks: the Lite model is last so the primary model
    // keeps its quality when available, while 503/429/404 can fail over quickly.
    const modelsToTry = [configuredModel, "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.1-flash-lite"]
      .filter((model, index, list) => list.indexOf(model) === index);
    let response: Response | undefined;
    for (const model of modelsToTry) {
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: ATLAS_INSTRUCTIONS }] },
            contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
            generationConfig: { maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: "medium" } }
          }),
          signal: AbortSignal.timeout(model === modelsToTry[0] ? 55000 : 35000)
        });
        if (response.ok) break;
        console.error("ATLAS Gemini provider error:", model, response.status);
        if (![404, 429, 500, 502, 503, 504].includes(response.status)) break;
      } catch (error) {
        console.error("ATLAS Gemini request failed:", model, error instanceof Error ? error.name : "unknown");
        response = undefined;
        // Continue para modelos gratuitos alternativos quando houver timeout.
        response = undefined;
        continue;
      }
    }
    if (!response) return NextResponse.json({ error: "Os modelos Gemini disponíveis não responderam dentro do tempo esperado. Tente novamente em instantes; se persistir, confira a disponibilidade e a cota da API no Google AI Studio." }, { status: 504 });
    if (!response.ok) {
      let providerCode = "";
      try {
        const providerError = await response.json() as { error?: { code?: number; status?: string; message?: string } };
        providerCode = providerError.error?.status || String(providerError.error?.code || "");
      } catch {}
      console.error("ATLAS Gemini final provider error:", response.status, providerCode);
      if (response.status === 400 || response.status === 403) return NextResponse.json({ error: "O Google Gemini recusou a solicitação. Confira se GEMINI_API_KEY é válida e se a API Gemini está habilitada no projeto Google." }, { status: 502 });
      if (response.status === 401) return NextResponse.json({ error: "A chave GEMINI_API_KEY foi recusada. Confira a variável no Render." }, { status: 502 });
      if (response.status === 429) return NextResponse.json({ error: "O Google Gemini atingiu o limite de uso ou de cota gratuita. Confira os limites do projeto no Google AI Studio e tente novamente mais tarde." }, { status: 429 });
      if (response.status === 404) return NextResponse.json({ error: "Nenhum dos modelos Gemini configurados está disponível para esta chave. Confira o acesso à API Gemini no Google AI Studio." }, { status: 502 });
      return NextResponse.json({ error: "O Google Gemini está temporariamente indisponível. Tente novamente em instantes." }, { status: 502 });
    }
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>; promptFeedback?: { blockReason?: string } };
    const reply = data.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("").trim();
    if (!reply) return NextResponse.json({ error: data.promptFeedback?.blockReason ? "O Google Gemini bloqueou essa solicitação por suas regras de segurança. Reformule a mensagem." : "O Google Gemini não retornou uma resposta. Tente novamente." }, { status: 502 });
    return NextResponse.json({ reply });
  } catch (error) { console.error("ATLAS chat error:", error); return NextResponse.json({ error: "Falha ao processar a mensagem. Tente novamente." }, { status: 500 }); }
}
