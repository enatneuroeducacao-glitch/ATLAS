"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AudioLines, CheckCircle2, CircleAlert, Download, LoaderCircle, Play, RotateCcw, ShieldCheck } from "lucide-react";

const SAMPLE = `A segurança no trânsito começa com conhecimento, responsabilidade e decisões conscientes. O instrutor de trânsito exerce uma função educativa que exige domínio técnico, clareza na comunicação e respeito à legislação. Ensinar não é apenas transmitir regras: é ajudar cada pessoa a compreender os riscos, reconhecer situações e agir com responsabilidade para preservar vidas.`;

type Provider = { id: "kokoro" | "piper" | "gemini"; name: string; configured: boolean; role: string };
type Result = { url: string; duration: number; chars: number; provider: string };

export default function VoiceLabPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [text, setText] = useState(SAMPLE);
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Carregando disponibilidade dos mecanismos…");

  useEffect(() => {
    fetch("/api/voice-lab", { cache: "no-store" })
      .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error || "Não foi possível carregar o laboratório."); return data; })
      .then(data => { setProviders(data.providers || []); setMessage("Use o mesmo texto para gerar cada amostra e comparar os resultados."); })
      .catch(e => setMessage(e.message || "Falha ao carregar o laboratório."));
    return () => { Object.values(results).forEach(item => URL.revokeObjectURL(item.url)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const count = text.length;
  const ready = useMemo(() => providers.filter(p => p.configured).length, [providers]);

  async function generate(provider: Provider) {
    setLoading(provider.id);
    setErrors(current => ({ ...current, [provider.id]: "" }));
    try {
      const response = await fetch("/api/voice-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, text }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Falha HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setResults(current => {
        if (current[provider.id]) URL.revokeObjectURL(current[provider.id].url);
        return { ...current, [provider.id]: { url, duration: 0, chars: count, provider: provider.name } };
      });
    } catch (e) {
      setErrors(current => ({ ...current, [provider.id]: e instanceof Error ? e.message : "Falha na geração." }));
    } finally {
      setLoading(null);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#090d14", color: "#edf4fb", padding: "32px 20px", fontFamily: "Arial,sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <a href="/admin" style={{ color: "#8bdfe4", textDecoration: "none", display: "inline-flex", gap: 8, alignItems: "center", marginBottom: 24 }}><ArrowLeft size={16}/> Painel administrativo</a>
        <header style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, display: "grid", placeItems: "center", borderRadius: 14, background: "#142b37", border: "1px solid #2c626b", color: "#8bf2f0" }}><AudioLines size={26}/></div>
          <div><p style={{ color: "#70e4e8", letterSpacing: 2, fontSize: 11, fontWeight: 700, margin: 0 }}>ENAT · ATLAS VOICE ENGINE</p><h1 style={{ fontSize: 30, margin: "5px 0" }}>Laboratório de avaliação vocal</h1><p style={{ color: "#94a3b8", margin: 0 }}>Comparação controlada com texto idêntico e registro das condições de teste.</p></div>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(280px, 0.85fr) minmax(0, 1.5fr)", gap: 18, alignItems: "start" }}>
          <article style={{ background: "#101823", border: "1px solid #243342", borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: 17, margin: "0 0 8px" }}>Texto-padrão de comparação</h2>
            <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>Este mesmo texto é enviado, sem alteração, a cada mecanismo selecionado. Não altere o texto entre as amostras de uma rodada.</p>
            <textarea value={text} onChange={e => setText(e.target.value)} maxLength={3000} rows={11} style={{ width: "100%", resize: "vertical", background: "#080e16", border: "1px solid #334155", borderRadius: 9, padding: 12, color: "#edf4fb", lineHeight: 1.7, fontSize: 13 }}/>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: 11, marginTop: 6 }}><span>Texto idêntico por rodada</span><span>{count}/3.000</span></div>
            <button type="button" onClick={() => { setText(SAMPLE); setResults({}); setErrors({}); }} style={{ marginTop: 14, background: "transparent", border: "1px solid #334155", color: "#cbd5e1", padding: "9px 12px", borderRadius: 8, display: "inline-flex", gap: 8, alignItems: "center" }}><RotateCcw size={14}/> Restaurar texto-padrão</button>
            <div style={{ marginTop: 18, padding: 12, borderRadius: 9, background: "#0d211e", border: "1px solid #1f5147", color: "#a7f3d0", fontSize: 11, lineHeight: 1.6 }}><ShieldCheck size={15} style={{ verticalAlign: "middle", marginRight: 6 }}/> A avaliação não altera a voz de produção do ATLAS nem os parâmetros dos estúdios.</div>
          </article>

          <div>
            <section style={{ background: "#101823", border: "1px solid #243342", borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><h2 style={{ fontSize: 17, margin: 0 }}>Mecanismos disponíveis</h2><span style={{ color: "#94a3b8", fontSize: 11 }}>{ready} de {providers.length} configurados</span></div>
              <p style={{ color: "#94a3b8", fontSize: 12, margin: "8px 0 14px" }}>{message}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
                {providers.map(provider => (
                  <article key={provider.id} style={{ border: "1px solid #334155", borderRadius: 10, padding: 14, background: "#0b131d" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><b style={{ fontSize: 13 }}>{provider.name}</b>{provider.configured ? <CheckCircle2 size={16} color="#59d9a1"/> : <CircleAlert size={16} color="#fbbf24"/>}</div>
                    <p style={{ color: "#94a3b8", fontSize: 11, margin: "7px 0 12px" }}>{provider.role}</p>
                    <button type="button" disabled={!provider.configured || Boolean(loading) || !text.trim()} onClick={() => generate(provider)} style={{ width: "100%", border: 0, borderRadius: 8, padding: "10px 12px", background: provider.configured ? "#70e4e8" : "#263442", color: provider.configured ? "#07131a" : "#94a3b8", fontWeight: 700, display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
                      {loading === provider.id ? <LoaderCircle size={15} className="animate-spin"/> : <Play size={15}/>} {loading === provider.id ? "Gerando amostra…" : provider.configured ? "Gerar amostra" : "Não configurado"}
                    </button>
                    {errors[provider.id] && <p style={{ color: "#fca5a5", fontSize: 11, lineHeight: 1.5, marginBottom: 0 }}>{errors[provider.id]}</p>}
                    {results[provider.id] && <div style={{ marginTop: 12 }}><audio controls preload="none" src={results[provider.id].url} style={{ width: "100%", height: 36 }}/><a href={results[provider.id].url} download={`atlas-voice-lab-${provider.id}.wav`} style={{ color: "#8bdfe4", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8 }}><Download size={13}/> Baixar amostra</a></div>}
                  </article>
                ))}
              </div>
            </section>
            <section style={{ background: "#101823", border: "1px solid #243342", borderRadius: 14, padding: 18 }}>
              <h2 style={{ fontSize: 17, margin: "0 0 8px" }}>Ficha de avaliação</h2>
              <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>Após ouvir as amostras, registre a avaliação de cada voz. Use a mesma escala e os mesmos critérios. A ficha é local nesta primeira versão; ainda não é persistida no banco.</p>
              <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr>{["Critério","O que observar","Nota (1–5)"].map(x=><th key={x} style={{ textAlign: "left", padding: 9, color: "#8bdfe4", borderBottom: "1px solid #334155" }}>{x}</th>)}</tr></thead><tbody>{[["Naturalidade","Soa humana e fluida?"],["Dicção","Pronuncia claramente as palavras?"],["Prosódia","Pausas, ritmo e entonação adequados?"],["Timbre","Grave, adulto, firme e acolhedor?"],["Inteligibilidade","É compreensível em volume normal?"],["Termos técnicos","Lê corretamente termos e siglas?"]].map(([criterion,question])=><tr key={criterion}><td style={{ padding: 9, borderBottom: "1px solid #243342", fontWeight: 700 }}>{criterion}</td><td style={{ padding: 9, borderBottom: "1px solid #243342", color: "#94a3b8" }}>{question}</td><td style={{ padding: 9, borderBottom: "1px solid #243342" }}><select aria-label={`Nota ${criterion}`} defaultValue="" style={{ background: "#080e16", color: "#edf4fb", border: "1px solid #334155", borderRadius: 6, padding: 6 }}><option value="" disabled>—</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></td></tr>)}</tbody></table></div>
            </section>
          </div>
        </section>
        <footer style={{ color: "#64748b", fontSize: 11, marginTop: 24 }}>ATLAS VOICE ENGINE · Laboratório experimental · Não altera a voz de produção.</footer>
      </div>
    </main>
  );
}
