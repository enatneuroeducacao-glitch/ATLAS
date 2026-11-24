import { auth } from "@/lib/auth/server";
import { NextResponse } from "next/server";
import { ENAT_KNOWLEDGE } from "@/lib/enat-knowledge";

export const runtime = "nodejs";
type DocumentKind = "relatorio" | "plano" | "questionario" | "tecnico";
const allowedKinds: DocumentKind[] = ["relatorio", "plano", "questionario", "tecnico"];
const requests = new Map<string, { count: number; resetAt: number }>();

function allowRequest(key: string) {
  const now = Date.now();
  const current = requests.get(key);
  if (!current || now >= current.resetAt) {
    requests.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 5) return false;
  current.count += 1;
  return true;
}

const kindLabels: Record<DocumentKind, string> = {
  relatorio: "relatório de avaliação educacional",
  plano: "plano de aula completo",
  questionario: "documento de aplicação do HSI/HSI-DOTH-P",
  tecnico: "relatório ou nota técnica institucional",
};

export async function POST(request: Request) {
  try {
    const { data: session } = await auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Sessão necessária. Entre no ATLAS para continuar." }, { status: 401 });

    const body = await request.json() as { kind?: unknown; title?: unknown; content?: unknown; reference?: unknown };
    if (typeof body.kind !== "string" || !allowedKinds.includes(body.kind as DocumentKind)) return NextResponse.json({ error: "Tipo de documento inválido." }, { status: 400 });
    if (typeof body.title !== "string" || body.title.trim().length < 2 || body.title.length > 160) return NextResponse.json({ error: "Informe um título válido." }, { status: 400 });
    if (typeof body.content !== "string" || body.content.length > 24_000) return NextResponse.json({ error: "O conteúdo-base está vazio ou ultrapassa o limite permitido." }, { status: 400 });
    if (body.reference !== undefined && (typeof body.reference !== "string" || body.reference.length > 24_000)) return NextResponse.json({ error: "O material de referência ultrapassa o limite permitido." }, { status: 400 });

    if (!allowRequest(session.user.id)) return NextResponse.json({ error: "Limite de geração atingido. Aguarde um minuto e tente novamente." }, { status: 429 });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "A geração documental por IA não está configurada no servidor." }, { status: 503 });

    const kind = body.kind as DocumentKind;
    const reference = typeof body.reference === "string" ? body.reference.trim() : "";
    const prompt = [
      "Elabore integralmente o documento solicitado. Não entregue esqueleto, sumário, roteiro, campos vazios ou resumo. O resultado deve estar pronto para revisão final e impressão, com todos os capítulos preenchidos em texto desenvolvido.",
      "TIPO: " + kindLabels[kind],
      "TÍTULO: " + body.title.trim(),
      "CONTEÚDO-BASE / ESTRUTURA:\n" + body.content.trim(),
      "MATERIAL DE REFERÊNCIA E CONTEXTO:\n" + (reference || "Não foi fornecido material adicional."),
      "REGRAS OBRIGATÓRIAS:",
      "1. Preserve tema, público, duração, dados e decisões informados.",
      "2. Complete todas as seções com conteúdo substantivo. Plano de aula: objetivos observáveis, competências, conteúdos, metodologia, sequência com tempos, recursos, atividade, avaliação, critérios e referências. Relatórios: contexto, método, resultados somente quando fornecidos, análise, limitações e recomendações. Nota técnica: objeto, fundamentação, análise, conclusão e encaminhamentos.",
      "3. Não invente participantes, resultados, amostras, datas, referências bibliográficas, dispositivos legais, pontuações ou fatos. Se faltar dado indispensável, marque 'Dado não informado' e explique o que precisa ser fornecido; desenvolva integralmente as partes possíveis.",
      "4. HSI/HSI-DOTH-P: não invente itens oficiais, escalas, normas, pontos de corte ou alegue validação psicométrica. Sem a versão oficial, produza documento metodológico completo e identifique claramente o espaço dos itens autorizados.",
      "5. Não emita diagnóstico psicológico ou clínico. Relatórios educacionais devem ser descritivos.",
      "6. Não invente legislação. Se não houver fonte normativa fornecida, indique a necessidade de conferência oficial.",
      "7. Português brasileiro, linguagem profissional, títulos claros, parágrafos completos e sem repetição.",
      "8. Retorne somente o conteúdo integral do documento, sem prefácio ou comentários ao usuário.",
      "BASE DE CONHECIMENTO ENAT:\n" + ENAT_KNOWLEDGE
    ].join("\n\n");

    const configuredModel = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const models = [configuredModel, "gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.1-flash-lite"].filter((model, index, list) => list.indexOf(model) === index);
    let response: Response | undefined;
    for (const model of models) {
      try {
        response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(apiKey), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: "Você é o redator técnico e pedagógico do ENAT e do ATLAS II. Produza documentos completos, rigorosos e úteis. Não invente dados nem omita seções." }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 8192, temperature: 0.35 }
          }),
          signal: AbortSignal.timeout(90_000)
        });
        if (response.ok) break;
        if (![404, 429, 500, 502, 503, 504].includes(response.status)) break;
      } catch { response = undefined; continue; }
    }
    if (!response) return NextResponse.json({ error: "Os modelos de IA não responderam no tempo esperado. Tente novamente." }, { status: 504 });
    if (!response.ok) return NextResponse.json({ error: response.status === 429 ? "Limite de uso do Gemini atingido. Tente novamente mais tarde." : "Não foi possível gerar o documento integral neste momento." }, { status: response.status === 429 ? 429 : 502 });

    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }> };
    const candidate = data.candidates?.[0];
    const generated = candidate?.content?.parts?.map(part => part.text || "").join("").trim();
    if (!generated) return NextResponse.json({ error: "A IA não retornou conteúdo documental. Tente novamente." }, { status: 502 });
    if (candidate?.finishReason === "MAX_TOKENS") return NextResponse.json({ error: "O documento excedeu o limite de geração e pode estar incompleto. Divida o documento em partes ou reduza o escopo." }, { status: 422 });
    return NextResponse.json({ content: generated });
  } catch (error) {
    console.error("ATLAS document generation error:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Falha ao gerar o documento. Confira os dados e tente novamente." }, { status: 500 });
  }
}
