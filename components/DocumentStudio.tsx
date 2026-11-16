"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Printer, X } from "lucide-react";

type DocumentKind = "relatorio" | "plano" | "questionario" | "tecnico";

const templates: Record<DocumentKind, { label: string; title: string; body: string }> = {
  relatorio: {
    label: "Relatório de avaliação",
    title: "Relatório de avaliação educacional",
    body: "RELATÓRIO DE AVALIAÇÃO EDUCACIONAL\n\n1. IDENTIFICAÇÃO\nParticipante/turma:\nData:\nResponsável pela aplicação:\n\n2. OBJETIVO\n\n3. PROCEDIMENTOS E INSTRUMENTOS\n\n4. RESULTADOS\n\n5. ANÁLISE DESCRITIVA\n\n6. RECOMENDAÇÕES EDUCACIONAIS\n\n7. LIMITAÇÕES E OBSERVAÇÕES\n\nEste documento apresenta resultados descritivos e educacionais. Não constitui diagnóstico psicológico nem laudo clínico."
  },
  plano: {
    label: "Plano de aula",
    title: "Plano de aula — ENAT",
    body: "PLANO DE AULA\n\nTema:\nPúblico-alvo:\nDuração:\n\n1. OBJETIVO GERAL\n\n2. OBJETIVOS ESPECÍFICOS\n\n3. COMPETÊNCIAS E CONTEÚDOS\n\n4. RECURSOS DIDÁTICOS\n\n5. SEQUÊNCIA DIDÁTICA\n\n6. ATIVIDADE DE APRENDIZAGEM\n\n7. AVALIAÇÃO\n\n8. REFERÊNCIAS"
  },
  questionario: {
    label: "Questionário HSI / HSI-DOTH-P",
    title: "Instrumento de aplicação — HSI / HSI-DOTH-P",
    body: "QUESTIONÁRIO / FOLHA DE APLICAÇÃO\n\nInstrumento/versão:\nParticipante (código, se aplicável):\nData:\nAplicador:\n\nINSTRUÇÕES AO PARTICIPANTE\n\nITENS E RESPOSTAS\n[Inserir aqui os itens da versão metodológica autorizada e vigente.]\n\nREGISTRO DE PONTUAÇÃO\n\nOBSERVAÇÕES\n\nNOTA METODOLÓGICA\nUtilize somente itens, escalas, regras de cálculo e critérios pertencentes à versão metodológica aprovada do instrumento. Este modelo não declara validação psicométrica."
  },
  tecnico: {
    label: "Relatório / nota técnica",
    title: "Relatório técnico — ENAT",
    body: "RELATÓRIO TÉCNICO\n\n1. IDENTIFICAÇÃO\n\n2. OBJETO\n\n3. CONTEXTO E FUNDAMENTAÇÃO\n\n4. METODOLOGIA\n\n5. ANÁLISE\n\n6. CONCLUSÕES\n\n7. RECOMENDAÇÕES\n\n8. REFERÊNCIAS E ANEXOS"
  }
};

function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  return value.replace(/[&<>"]/g, char => entities[char]);
}

export default function DocumentStudio({ initialContent = "", onClose }: { initialContent?: string; onClose: () => void }) {
  const [kind, setKind] = useState<DocumentKind>("relatorio");
  const [title, setTitle] = useState(templates.relatorio.title);
  const [content, setContent] = useState(initialContent.trim() || templates.relatorio.body);
  const [status, setStatus] = useState("");

  function changeKind(next: DocumentKind) {
    setKind(next);
    setTitle(templates[next].title);
    setContent(initialContent.trim() || templates[next].body);
    setStatus("");
  }

  const printable = useMemo(() => {
    const safeTitle = escapeHtml(title.trim() || "Documento ATLAS II");
    const safeContent = escapeHtml(content);
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${safeTitle}</title><style>
      @page{size:A4;margin:20mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;font-size:11pt;line-height:1.55}
      header{border-bottom:2px solid #177e83;padding-bottom:14px;margin-bottom:24px}header .brand{font-size:9pt;letter-spacing:2px;color:#177e83;font-weight:bold}
      h1{font-size:20pt;margin:8px 0 0}main{white-space:pre-wrap;overflow-wrap:anywhere}footer{margin-top:32px;padding-top:10px;border-top:1px solid #cbd5e1;font-size:8pt;color:#64748b}
      @media screen{body{max-width:800px;margin:30px auto;padding:36px;box-shadow:0 2px 18px #0002}}
    </style></head><body><header><div class="brand">ENAT · ATLAS II</div><h1>${safeTitle}</h1></header><main>${safeContent}</main><footer>Documento elaborado com apoio do ATLAS II · Ensino Neuroeducacional Aplicado ao Trânsito</footer><script>window.onload=()=>{document.title=${JSON.stringify(title.trim() || "Documento ATLAS II")};};</script></body></html>`;
  }, [title, content]);

  function openPreview() {
    const popup = window.open("", "_blank");
    if (!popup) {
      setStatus("O navegador bloqueou a prévia. Permita pop-ups para este site e tente novamente.");
      return;
    }
    popup.document.open();
    popup.document.write(printable);
    popup.document.close();
    setStatus("Prévia aberta. Use Imprimir e escolha “Salvar como PDF” para gerar o arquivo.");
  }

  function downloadText() {
    const blob = new Blob([`ENAT · ATLAS II\n${title}\n\n${content}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(title || "documento-atlas").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "documento-atlas"}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Arquivo de texto baixado. Para PDF, use a prévia e a opção Salvar como PDF.");
  }

  return <section className="documentStudio" aria-label="Estúdio de documentos">
    <header className="documentStudioHeader">
      <div><span>ATLAS II / PRODUÇÃO DOCUMENTAL</span><h2><FileText size={22}/> Estúdio de documentos</h2><p>Prepare, revise e imprima documentos em formato A4.</p></div>
      <button type="button" className="documentClose" onClick={onClose} aria-label="Fechar estúdio"><X size={18}/></button>
    </header>
    <div className="documentStudioFields">
      <label>Tipo de documento
        <select value={kind} onChange={event => changeKind(event.target.value as DocumentKind)}>
          {Object.entries(templates).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </select>
      </label>
      <label>Título
        <input value={title} onChange={event => setTitle(event.target.value)} maxLength={140}/>
      </label>
    </div>
    <label className="documentContentLabel" htmlFor="atlas-document-content">Conteúdo do documento</label>
    <textarea id="atlas-document-content" className="documentContent" value={content} onChange={event => setContent(event.target.value)} rows={16}/>
    {kind === "questionario" && <p className="documentCaution">Atenção: o modelo não inventa itens oficiais nem regras de pontuação. Insira a versão metodológica autorizada do HSI/HSI-DOTH-P antes da aplicação.</p>}
    <div className="documentActions">
      <button type="button" className="documentPrimary" onClick={openPreview} disabled={!title.trim() || !content.trim()}><Printer size={16}/> Pré-visualizar / Salvar PDF</button>
      <button type="button" className="documentSecondary" onClick={downloadText} disabled={!content.trim()}><Download size={16}/> Baixar TXT</button>
    </div>
    {status && <p className="documentStatus" role="status">{status}</p>}
  </section>;
}
