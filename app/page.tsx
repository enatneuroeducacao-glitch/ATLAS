"use client";
import { FormEvent, useState } from "react";
import { AudioLines, Bot, Mic, Send, ShieldCheck, Activity, CheckCircle2 } from "lucide-react";

export default function Home() {
  const [text, setText] = useState("");
  const [reply, setReply] = useState("Olá! Sou o ATLAS. Meu painel está ativo. Configure a chave da IA no servidor para habilitar respostas inteligentes.");
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState(true);
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
    <div className="metrics"><article><small>ESTADO DO SISTEMA</small><b>Operacional</b><p>Interface carregada</p></article><article><small>CAPACIDADE DE IA</small><b>Preparada</b><p>Chave do servidor opcional</p></article><article><small>SEGURANÇA</small><b>Protegido</b><p>Execução local desativada</p></article></div>
    <section className="chat"><header><AudioLines/><div><b>Converse com o ATLAS</b><small>Seu assistente, pronto para ouvir.</small></div><span>● ONLINE</span></header><div className="answer"><div className="botIcon"><Bot/></div><div><b>ATLAS <small>ASSISTENTE</small></b><p>{reply}</p>{loading&&<p>Processando…</p>}</div></div><form onSubmit={send}><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Envie uma mensagem ao ATLAS…" rows={2}/><div className="formFoot"><button type="button" className="voiceButton" onClick={()=>{setVoice(!voice);if(voice)window.speechSynthesis?.cancel();}}><Mic size={16}/> Voz {voice?"ativa":"desativada"}</button><button className="send" disabled={loading||!text.trim()}><Send size={16}/> Enviar</button></div></form></section>
    <footer>ATLAS SYSTEMS / BUILD 0.1.0 <span>ASSISTENTE COM AUTONOMIA CONTROLADA</span></footer></div></section>
  </main>;
}