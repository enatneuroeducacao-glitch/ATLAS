"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AudioLines, Bot, Mic, MicOff, Send, ShieldCheck, Activity, CheckCircle2 } from "lucide-react";

export default function Home() {
  const [text, setText] = useState("");
  const [reply, setReply] = useState("Olá! Sou o ATLAS. A base de conhecimento do ENAT está incorporada ao projeto. Configure a chave da IA no servidor para habilitar respostas inteligentes.");
  const [history, setHistory] = useState<{role:"user"|"assistant";content:string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState(true);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [serviceStatus, setServiceStatus] = useState<"checking" | "ready" | "error">("checking");
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
    const nextHistory: { role: "user" | "assistant"; content: string }[] = [...history, { role: "user", content: message }].slice(-20);
    setHistory(nextHistory);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: nextHistory }) });
      const data = await res.json(); const answer = data.reply || data.error || "Não consegui responder.";
      setReply(answer);
      setHistory([...nextHistory, { role: "assistant", content: answer }].slice(-20));
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
    <aside className="sidebar"><div className="brand"><span className="brandIcon"><AudioLines size={25}/></span><span><b>ATLAS</b><small>PERSONAL INTELLIGENCE</small></span></div><p className="sideLabel">WORKSPACE</p><div className="workspace"><span className="avatar">V</span><span><b>Meu espaço</b><small>Assistente pessoal</small></span></div><p className="sideLabel">MENU PRINCIPAL</p><div className="navItem"><Activity size={17}/> Visão geral</div><div className="navItem"><Bot size={17}/> Conversas</div><div className="navItem"><CheckCircle2 size={17}/> Tarefas</div><div className="sideGrow"/><div className="security"><ShieldCheck/><b>Proteção ativa</b><p>Ações externas bloqueadas nesta versão.</p><small>● POLÍTICAS BÁSICAS ATIVAS</small></div></aside>
    <section className="main"><header className="topbar">Workspace <span>{serviceStatus === "ready" ? "● Sistema operacional" : serviceStatus === "error" ? "● Verificar conexão" : "● Verificando sistema…"}</span></header><div className="content"><div className="eyebrow">● SEU ASSISTENTE PESSOAL</div><h1>Bom dia. <span>Vamos realizar.</span></h1><p className="subtitle">Seu centro de inteligência está pronto para começar.</p>
    <section className="hero"><div><div className="eyebrow">● ATLAS CORE / ONLINE</div><h2>Inteligência em<br/><span>movimento.</span></h2><p>Uma central para pensar, organizar e executar — com você no controle.</p></div><div className="orb"><AudioLines size={55}/></div></section>
    <div className="metrics"><article><small>ESTADO DO SISTEMA</small><b>Operacional</b><p>Interface carregada</p></article><article><small>BASE DE CONHECIMENTO</small><b>ENAT integrada</b><p>Contexto carregado no assistente</p></article><article><small>SEGURANÇA</small><b>Protegido</b><p>Execução local desativada</p></article></div>
    <section className="chat"><header><AudioLines/><div><b>Converse com o ATLAS</b><small>ENAT, conhecimento geral, planejamento e análise.</small></div><span>● ONLINE</span></header><div className="conversation" aria-live="polite">
      {history.length === 0 ? <div className="answer"><div className="botIcon"><Bot/></div><div><b>ATLAS <small>ASSISTENTE</small></b><p>{reply}</p></div></div> : history.map((item, index) => <div className="answer" key={index}><div className="botIcon">{item.role === "assistant" ? <Bot/> : <span>V</span>}</div><div><b>{item.role === "assistant" ? "ATLAS" : "VOCÊ"} <small>{item.role === "assistant" ? "ASSISTENTE" : "MENSAGEM"}</small></b><p>{item.content}</p></div></div>)}
      {loading&&<div className="answer"><div className="botIcon"><Bot/></div><div><b>ATLAS</b><p>Processando…</p></div></div>}
      </div><form onSubmit={send}><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Pergunte sobre ENAT, HSI, NEXUS 12 ou qualquer outro assunto…" rows={2}/><div className="formFoot"><button type="button" className="voiceButton" onClick={toggleMic}>{listening?<MicOff size={16}/>:<Mic size={16}/>} {listening?"Ouvindo…":"Falar mensagem"}</button><button type="button" className="voiceButton" onClick={()=>{setVoice(!voice);if(voice){window.speechSynthesis?.cancel();audioRef.current?.pause();}}}><AudioLines size={15}/> Resposta {voice?"falada":"silenciosa"}</button><button className="send" disabled={loading||!text.trim()}><Send size={16}/> Enviar</button></div></form></section>
    <footer>ATLAS SYSTEMS / BUILD 0.2.0 <span>BASE ENAT + CONHECIMENTO GERAL / AUTONOMIA CONTROLADA</span></footer></div></section>
  </main>;
}
