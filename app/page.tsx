"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AudioLines, Bot, Mic, MicOff, Send, ShieldCheck, GraduationCap, ClipboardList, Scale, ShieldAlert, MessageSquare, History, House } from "lucide-react";

export default function Home() {
  const [text, setText] = useState("");
  const [reply, setReply] = useState("Olá! Sou o ATLAS II — Instrutor Inteligente. Posso ajudar com legislação, aulas, neuroeducação, segurança viária e mobilidade.");
  const [history, setHistory] = useState<{role:"user"|"assistant";content:string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState(true);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [serviceStatus, setServiceStatus] = useState<"checking" | "ready" | "error">("checking");
  const [activeMenu, setActiveMenu] = useState("overview");
  function navigate(id: string, prompt?: string) {
    setActiveMenu(id);
    if (prompt) setText(prompt);
    if (id === "overview") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const chat = document.getElementById("atlas-chat");
    chat?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (id !== "history") window.setTimeout(() => document.getElementById("atlas-chat-input")?.focus(), 350);
  }
  useEffect(() => {
    try {
      const saved = localStorage.getItem("atlas-conversation-v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const safe = parsed.filter((m: any) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string").slice(-20);
          setHistory(safe);
          const lastAnswer = [...safe].reverse().find((m: any) => m.role === "assistant");
          if (lastAnswer) setReply(lastAnswer.content);
        }
      }
    } catch {}
    fetch("/api/health").then(r => { if (!r.ok) throw new Error("health"); return r.json(); })
      .then(() => setServiceStatus("ready")).catch(() => setServiceStatus("error"));
  }, []);
  useEffect(() => {
    try { localStorage.setItem("atlas-conversation-v1", JSON.stringify(history.slice(-20))); } catch {}
  }, [history]);
  function toggleMic() {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechAPI) { setReply("O reconhecimento de voz não está disponível neste navegador. Tente usar o Microsoft Edge ou Google Chrome atualizado."); return; }
    const rec = new SpeechAPI(); rec.lang = "pt-BR"; rec.interimResults = false; rec.continuous = false;
    rec.onresult = (event: any) => { const transcript = event.results?.[0]?.[0]?.transcript; if (transcript) setText(transcript); };
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); setReply("Não foi possível acessar o microfone. Confira as permissões do navegador."); };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }
  async function send(e: FormEvent) {
    e.preventDefault(); if (!text.trim() || loading) return;
    const message = text.trim(); setText(""); setLoading(true);
    const nextHistory = [...history, { role: "user" as const, content: message }].slice(-20);
    setHistory(nextHistory);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: nextHistory }) });
      const data = await res.json(); const answer = data.reply || data.error || "Não consegui responder.";
      setReply(answer);
      setHistory([...nextHistory, { role: "assistant" as const, content: String(answer) }].slice(-20));
      if (voice) {
        try {
          window.speechSynthesis?.cancel();
          audioRef.current?.pause();
          const speech = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: answer }) });
          if (!speech.ok) throw new Error("TTS indisponível");
          const audioUrl = URL.createObjectURL(await speech.blob());
          const audio = new Audio(audioUrl); audioRef.current = audio;
          audio.onended = () => URL.revokeObjectURL(audioUrl);
          await audio.play();
        } catch {
          if ("speechSynthesis" in window) { const u = new SpeechSynthesisUtterance(answer); u.lang = "pt-BR"; window.speechSynthesis.speak(u); }
        }
      }
    } catch { setReply("Não consegui acessar o servidor. Tente novamente."); } finally { setLoading(false); }
  }
  return <main className="shell">
    <aside className="sidebar"><div className="brand"><span className="brandIcon"><AudioLines size={25}/></span><span><b>ATLAS II</b><small>INSTRUTOR INTELIGENTE</small></span></div><p className="sideLabel">WORKSPACE</p><div className="workspace"><span className="avatar">V</span><span><b>Meu espaço</b><small>Instrutor inteligente</small></span></div><p className="sideLabel">NAVEGAÇÃO</p><button type="button" className={`navItem ${activeMenu === "overview" ? "active" : ""}`} onClick={() => navigate("overview")}><House size={17}/> Visão geral</button><button type="button" className={`navItem ${activeMenu === "chat" ? "active" : ""}`} onClick={() => navigate("chat")}><MessageSquare size={17}/> Instrutor ATLAS</button><p className="sideLabel navGroupLabel">FERRAMENTAS</p><button type="button" className={`navItem ${activeMenu === "lesson" ? "active" : ""}`} onClick={() => navigate("lesson", "Elabore um plano de aula completo sobre: [informe o tema]. Inclua público-alvo, duração, objetivos, competências, sequência didática, atividade e avaliação.")}><GraduationCap size={17}/> Planejar aula</button><button type="button" className={`navItem ${activeMenu === "quiz" ? "active" : ""}`} onClick={() => navigate("quiz", "Crie um simulado de trânsito com 10 questões de múltipla escolha, gabarito comentado e nível de dificuldade progressivo. Informe o tema: [tema].") }><ClipboardList size={17}/> Criar simulado</button><button type="button" className={`navItem ${activeMenu === "law" ? "active" : ""}`} onClick={() => navigate("law", "Explique a legislação de trânsito aplicável ao seguinte tema. Identifique a norma, artigo, vigência e fonte oficial atualizada: [tema].") }><Scale size={17}/> Legislação</button><button type="button" className={`navItem ${activeMenu === "risk" ? "active" : ""}`} onClick={() => navigate("risk", "Analise esta situação de trânsito sob a ótica da segurança viária: perigos, riscos, fatores humanos, usuários vulneráveis e conduta preventiva. Situação: [descreva].") }><ShieldAlert size={17}/> Análise de risco</button><p className="sideLabel navGroupLabel">SESSÃO</p><button type="button" className={`navItem ${activeMenu === "history" ? "active" : ""}`} onClick={() => navigate("history")}><History size={17}/> Histórico recente</button><button type="button" className="navItem" onClick={() => { setVoice(v => !v); if (voice) { window.speechSynthesis?.cancel(); audioRef.current?.pause(); } }}><AudioLines size={17}/> Voz: {voice ? "ativada" : "desativada"}</button><div className="sideGrow"/><div className="security"><ShieldCheck/><b>Proteção ativa</b><p>O ATLAS não executa ações externas nesta versão.</p><small>● POLÍTICAS BÁSICAS ATIVAS</small></div></aside>
    <section className="main"><header className="topbar">Workspace <span>{serviceStatus === "ready" ? "● Sistema operacional" : serviceStatus === "error" ? "● Verificar conexão" : "● Verificando sistema…"}</span></header><div className="content"><div className="eyebrow">● ATLAS II / INSTRUTOR INTELIGENTE</div><h1>Conhecimento que <span>protege vidas.</span></h1><p className="subtitle">Seu parceiro inteligente para aprender, ensinar e compreender o trânsito.</p>
    <section className="hero"><div><div className="eyebrow">● ATLAS II CORE / ONLINE</div><h2>Trânsito, ciência<br/><span>e aprendizagem.</span></h2><p>Legislação, formação, neuroeducação e segurança viária em uma experiência inteligente.</p></div><div className="orb"><AudioLines size={55}/></div></section>
    <section className="quickTopics" aria-label="Temas para começar"><div><b>COMECE POR UM TEMA</b><small>Atalhos para explorar o ATLAS II</small></div><div className="topicButtons">{["Explique um artigo do CTB","Monte um plano de aula","Crie um simulado de trânsito","Explique neuroeducação aplicada ao trânsito","Analise uma situação de risco","Prepare uma aula de direção defensiva"].map(topic=><button type="button" key={topic} onClick={()=>setText(topic)}>{topic}</button>)}</div></section>
    <div className="metrics"><article><small>ESTADO DO SISTEMA</small><b>Operacional</b><p>Interface carregada</p></article><article><small>ESPECIALIZAÇÃO</small><b>Trânsito + ENAT</b><p>Legislação, aulas e neuroeducação</p></article><article><small>SEGURANÇA</small><b>Protegido</b><p>Execução local desativada</p></article></div>
    <section className="chat" id="atlas-chat"><header><AudioLines/><div><b>Converse com o ATLAS II</b><small>Instrutor Inteligente · Trânsito, legislação, aulas e neuroeducação.</small></div><span>● ONLINE</span></header><div className="conversation" id="atlas-conversation" aria-live="polite">
      {history.length === 0 ? <div className="answer"><div className="botIcon"><Bot/></div><div><b>ATLAS II <small>INSTRUTOR INTELIGENTE</small></b><p>{reply}</p></div></div> : history.map((item, index) => <div className="answer" key={index}><div className="botIcon">{item.role === "assistant" ? <Bot/> : <span>V</span>}</div><div><b>{item.role === "assistant" ? "ATLAS" : "VOCÊ"} <small>{item.role === "assistant" ? "ASSISTENTE" : "MENSAGEM"}</small></b><p>{item.content}</p></div></div>)}
      {loading&&<div className="answer"><div className="botIcon"><Bot/></div><div><b>ATLAS</b><p>Processando…</p></div></div>}
      </div><form onSubmit={send}><textarea id="atlas-chat-input" value={text} onChange={e=>setText(e.target.value)} placeholder="Pergunte sobre CTB, legislação, aulas, direção defensiva, neuroeducação ou segurança viária…" rows={2}/><div className="formFoot"><button type="button" className="voiceButton" onClick={toggleMic}>{listening?<MicOff size={16}/>:<Mic size={16}/>} {listening?"Ouvindo…":"Falar mensagem"}</button><button type="button" className="voiceButton" onClick={()=>{setVoice(!voice);if(voice){window.speechSynthesis?.cancel();audioRef.current?.pause();}}}><AudioLines size={15}/> Resposta {voice?"falada":"silenciosa"}</button><button className="send" disabled={loading||!text.trim()}><Send size={16}/> Enviar</button></div></form></section>
    <footer>ATLAS II / INSTRUTOR INTELIGENTE <span>TRÂNSITO + LEGISLAÇÃO + NEUROEDUCAÇÃO / SEGURANÇA CONTROLADA</span></footer></div></section>
  </main>;
}
