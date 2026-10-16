"use client";
import { FormEvent, useRef, useState } from "react";
import { AudioLines, Bot, Mic, MicOff, Send, ShieldCheck, Activity, CheckCircle2 } from "lucide-react";

export default function Home() {
  const [text, setText] = useState("");
  const [reply, setReply] = useState("Olá! Sou o ATLAS. A base de conhecimento do ENAT está incorporada ao projeto. Configure a chave da IA no servidor para habilitar respostas inteligentes.");
  const [history, setHistory] = useState<{role:"user"|"assistant";content:string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState(true);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
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
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: message }] }) });
      const data = await res.json(); const answer = data.reply || data.error || "Não consegui responder.";
      setReply(answer);
      if (voice && "speechSynthesis" in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(answer); u.lang = "pt-BR"; window.speechSynthesis.speak(u); }
    } catch { setReply("Não consegui acessar o servidor. Tente novamente."); } finally { setLoading(false); }
  }
  return <main className="shell">
    <aside className="sidebar"><div className="brand"><span className="brandIcon"><AudioLines size={25}/></span><span><b>ATLAS</b><small>PERSONAL INTELLIGENCE</small></span></div><p className="sideLabel">WORKSPACE</p><div className="workspace"><span className="avatar">V</span><span><b>Meu espaço</b><small>Assistente pessoal</small></span></div><p className="sideLabel">MENU PRINCIPAL</p><div className="navItem"><Activity size={17}/> Visão geral</div><div className="navItem"><Bot size={17}/> Conversas</div><div className="navItem"><CheckCircle2 size={17}/> Tarefas</div><div className="sideGrow"/><div className="security"><ShieldCheck/><b>Proteção ativa</b><p>Ações externas bloqueadas nesta versão.</p><small>● POLÍTICAS BÁSICAS ATIVAS</small></div></aside>
    <section className="main"><header className="topbar">Workspace <span>● Sistema operacional</span></header><div className="content"><div className="eyebrow">● SEU ASSISTENTE PESSOAL</div><h1>Bom dia. <span>Vamos realizar.</span></h1><p className="subtitle">Seu centro de inteligência está pronto para começar.</p>
    <section className="hero"><div><div className="eyebrow">● ATLAS CORE / ONLINE</div><h2>Inteligência em<br/><span>movimento.</span></h2><p>Uma central para pensar, organizar e executar — com você no controle.</p></div><div className="orb"><AudioLines size={55}/></div></section>
    <div className="metrics"><article><small>ESTADO DO SISTEMA</small><b>Operacional</b><p>Interface carregada</p></article><article><small>BASE DE CONHECIMENTO</small><b>ENAT integrada</b><p>Contexto carregado no assistente</p></article><article><small>SEGURANÇA</small><b>Protegido</b><p>Execução local desativada</p></article></div>
    <section className="chat"><header><AudioLines/><div><b>Converse com o ATLAS</b><small>ENAT, conhecimento geral, planejamento e análise.</small></div><span>● ONLINE</span></header><div className="conversation" aria-live="polite">
      {history.length === 0 ? <div className="answer"><div className="botIcon"><Bot/></div><div><b>ATLAS <small>ASSISTENTE</small></b><p>{reply}</p></div></div> : history.map((item, index) => <div className="answer" key={index}><div className="botIcon">{item.role === "assistant" ? <Bot/> : <span>V</span>}</div><div><b>{item.role === "assistant" ? "ATLAS" : "VOCÊ"} <small>{item.role === "assistant" ? "ASSISTENTE" : "MENSAGEM"}</small></b><p>{item.content}</p></div></div>)}
      {loading&&<div className="answer"><div className="botIcon"><Bot/></div><div><b>ATLAS</b><p>Processando…</p></div></div>}
      </div><form onSubmit={send}><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Pergunte sobre ENAT, HSI, NEXUS 12 ou qualquer outro assunto…" rows={2}/><div className="formFoot"><button type="button" className="voiceButton" onClick={toggleMic}>{listening?<MicOff size={16}/>:<Mic size={16}/>} {listening?"Ouvindo…":"Falar mensagem"}</button><button type="button" className="voiceButton" onClick={()=>{setVoice(!voice);if(voice)window.speechSynthesis?.cancel();}}><AudioLines size={15}/> Resposta {voice?"falada":"silenciosa"}</button><button className="send" disabled={loading||!text.trim()}><Send size={16}/> Enviar</button></div></form></section>
    <footer>ATLAS SYSTEMS / BUILD 0.2.0 <span>BASE ENAT + CONHECIMENTO GERAL / AUTONOMIA CONTROLADA</span></footer></div></section>
  </main>;
}
