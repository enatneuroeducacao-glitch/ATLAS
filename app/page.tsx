"use client";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Bot, Mic, MicOff, Send, ShieldCheck, GraduationCap, ClipboardList, Scale, ShieldAlert, MessageSquare, History, House, Plus, Trash2, Clock3, Film, FileText } from "lucide-react";
import { cleanTextForSpeech } from "@/lib/speech-text";
import AudioStudio from "@/components/AudioStudio";
import VideoStudio from "@/components/VideoStudio";
import DocumentStudio from "@/components/DocumentStudio";
import AuthControls from "@/components/AuthControls";

type Message = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; messages: Message[]; updatedAt: number };
const STORAGE_KEY = "atlas-conversations-v2";
const LEGACY_KEY = "atlas-conversation-v1";
const welcome = "Olá! Sou o ATLAS II — Instrutor Inteligente. Posso ajudar com legislação, aulas, neuroeducação, segurança viária e mobilidade.";
function newId() { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `atlas-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function newConversation(): Conversation { return { id: newId(), title: "Nova conversa", messages: [], updatedAt: Date.now() }; }
const MAX_PROMPT_CHARS = 30000;
function normalizeStoredMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m: any): m is Message =>
      !!m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0
    )
    .slice(-80);
}
function titleFrom(text: string) { const clean = text.replace(/\\s+/g, " ").trim(); return clean.length > 42 ? clean.slice(0, 42).trimEnd() + "…" : clean || "Nova conversa"; }

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [slowRequest, setSlowRequest] = useState(false);
  const [voice, setVoice] = useState(true);
  const [listening, setListening] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<"checking" | "ready" | "error">("checking");
  const [activeMenu, setActiveMenu] = useState("overview");
  const [showDocumentStudio, setShowDocumentStudio] = useState(false);
  const recRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const active = conversations.find(c => c.id === activeId);
  const history = active?.messages || [];

  useEffect(() => {
    let saved: Conversation[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) saved = parsed.filter((c: any) => c && typeof c.id === "string" && Array.isArray(c.messages)).map((c: any) => ({
          id: c.id, title: typeof c.title === "string" ? c.title : "Conversa",
          updatedAt: Number(c.updatedAt) || Date.now(),
          messages: normalizeStoredMessages(c.messages)
        }));
      } else {
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) {
          const old = JSON.parse(legacy);
          if (Array.isArray(old) && old.length) saved = [{ id: newId(), title: titleFrom(old.find((m: any) => m.role === "user")?.content || "Conversa anterior"), messages: normalizeStoredMessages(old), updatedAt: Date.now() }];
        }
      }
    } catch { saved = []; }
    setConversations(saved);
    const fresh = newConversation();
    setConversations(current => [fresh, ...current]);
    setActiveId(fresh.id);
    setActiveMenu("chat");
    fetch("/api/health").then(r => { if (!r.ok) throw new Error("health"); return r.json(); })
      .then(data => setServiceStatus(data.aiConfigured === false ? "error" : "ready"))
      .catch(() => setServiceStatus("error"));
  }, []);

  useEffect(() => {
    if (!conversations.length) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 100))); } catch {}
  }, [conversations]);

  useEffect(() => {
    conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" });
  }, [history.length, loading]);

  useEffect(() => () => { if (requestTimer.current) clearTimeout(requestTimer.current); }, []);

  function createConversation() {
    if (loading) return;
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    const item = newConversation();
    setConversations(prev => [item, ...prev]);
    setActiveId(item.id);
    setText("");
    setActiveMenu("chat");
    window.setTimeout(() => document.getElementById("atlas-chat-input")?.focus(), 50);
  }
  function openConversation(id: string) {
    if (loading) return;
    setActiveId(id);
    setActiveMenu("chat");
    setText("");
  }
  function deleteConversation(id: string) {
    const item = conversations.find(c => c.id === id);
    if (!item) return;
    if (!window.confirm(`Excluir a conversa "${item.title}"? Esta ação não pode ser desfeita.`)) return;
    const remaining = conversations.filter(c => c.id !== id);
    setConversations(remaining);
    if (activeId === id) {
      const fresh = newConversation();
      setConversations([fresh, ...remaining]);
      setActiveId(fresh.id);
      setActiveMenu("chat");
    }
  }
  function navigate(id: string, prompt?: string) {
    setActiveMenu(id);
    if (prompt) { setText(prompt); if (!activeId) createConversation(); }
    if (id === "overview") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (id === "chat") { if (!activeId) createConversation(); window.setTimeout(() => document.getElementById("atlas-chat-input")?.focus(), 100); }
    if (id === "history") document.getElementById("atlas-history")?.scrollIntoView({ behavior: "smooth", block: "start" });
    else document.getElementById("atlas-chat")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function toggleMic() {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechAPI) { window.alert("O reconhecimento de voz não está disponível neste navegador. Tente usar o Microsoft Edge ou Google Chrome atualizado."); return; }
    const rec = new SpeechAPI(); rec.lang = "pt-BR"; rec.interimResults = false; rec.continuous = false;
    rec.onresult = (event: any) => { const transcript = event.results?.[0]?.[0]?.transcript; if (transcript) setText(transcript); };
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); window.alert("Não foi possível acessar o microfone. Confira as permissões do navegador."); };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }
  async function speakAnswer(answer: string) {
    const spoken = cleanTextForSpeech(answer);
    if (!spoken) return;
    try {
      window.speechSynthesis?.cancel();
      audioRef.current?.pause();
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: spoken }),
        signal: AbortSignal.timeout(65000)
      });
      if (!response.ok) throw new Error("Voz neural indisponível");
      const audioUrl = URL.createObjectURL(await response.blob());
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      audio.onerror = () => URL.revokeObjectURL(audioUrl);
      await audio.play();
    } catch {
      // Browser voice is the final fallback; the written answer remains available.
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(spoken);
        utterance.lang = "pt-BR";
        utterance.rate = 0.96;
        utterance.pitch = 0.88;
        window.speechSynthesis.speak(utterance);
      }
    }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || loading) return;
    let conversationId = activeId;
    if (!conversationId) { const fresh = newConversation(); setConversations(prev => [fresh, ...prev]); setActiveId(fresh.id); conversationId = fresh.id; }
    const message = text.trim();
    if (message.length > MAX_PROMPT_CHARS) {
      window.alert(`Sua mensagem tem ${message.length.toLocaleString("pt-BR")} caracteres. O limite atual é de ${MAX_PROMPT_CHARS.toLocaleString("pt-BR")} caracteres por mensagem. O texto foi mantido para você poder ajustá-lo.`);
      return;
    }
    const existing = conversations.find(c => c.id === conversationId);
    const nextHistory: Message[] = [...(existing?.messages || []), { role: "user" as const, content: message }].slice(-80);
    setText(""); setLoading(true); setSlowRequest(false);
    setConversations(prev => {
      const base = prev.some(c => c.id === conversationId) ? prev : [{ id: conversationId, title: "Nova conversa", messages: [], updatedAt: Date.now() }, ...prev];
      return base.map(c => c.id === conversationId ? { ...c, title: c.messages.length ? c.title : titleFrom(message), messages: nextHistory, updatedAt: Date.now() } : c);
    });
    requestTimer.current = setTimeout(() => setSlowRequest(true), 12000);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: nextHistory.slice(-20) }), signal: AbortSignal.timeout(70000) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível gerar a resposta.");
      const answer = String(data.reply || "O modelo não retornou uma resposta.");
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, messages: [...nextHistory, { role: "assistant" as const, content: answer }].slice(-80), updatedAt: Date.now() } : c));
      if (voice) void speakAnswer(answer);
    } catch (error) {
      const messageError = error instanceof Error ? error.message : "Falha ao acessar o servidor.";
      const friendly = messageError.includes("timed out") || messageError.includes("Timeout") || messageError.includes("abort") ? "A resposta está demorando além do esperado. Tente novamente em alguns instantes." : messageError;
      const errorMessage: Message = { role: "assistant", content: friendly };
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, messages: [...nextHistory, errorMessage].slice(-80), updatedAt: Date.now() } : c));
    } finally {
      if (requestTimer.current) clearTimeout(requestTimer.current);
      setLoading(false); setSlowRequest(false);
    }
  }
  const sortedConversations = useMemo(() => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt), [conversations]);
  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="brandIcon"><AudioLines size={25}/></span><span><b>ATLAS II</b><small>INSTRUTOR INTELIGENTE</small></span></div>
      <p className="sideLabel">WORKSPACE</p><div className="workspace"><span className="avatar">V</span><span><b>Meu espaço</b><small>Instrutor inteligente</small></span></div>
      <button type="button" className="newChatButton" onClick={createConversation} disabled={loading}><Plus size={16}/> Nova conversa</button>
      <p className="sideLabel">NAVEGAÇÃO</p>
      <button type="button" className={`navItem ${activeMenu === "overview" ? "active" : ""}`} onClick={() => navigate("overview")}><House size={17}/> Visão geral</button>
      <button type="button" className={`navItem ${activeMenu === "chat" ? "active" : ""}`} onClick={() => navigate("chat")}><MessageSquare size={17}/> Instrutor ATLAS</button>
      <p className="sideLabel navGroupLabel">FERRAMENTAS</p>
      <button type="button" className="navItem" onClick={() => navigate("lesson", "Elabore um plano de aula completo sobre: [informe o tema]. Inclua público-alvo, duração, objetivos, competências, sequência didática, atividade e avaliação.")}><GraduationCap size={17}/> Planejar aula</button>
      <button type="button" className="navItem" onClick={() => navigate("quiz", "Crie um simulado de trânsito com 10 questões de múltipla escolha, gabarito comentado e nível de dificuldade progressivo. Informe o tema: [tema].")}><ClipboardList size={17}/> Criar simulado</button>
      <button type="button" className="navItem" onClick={() => navigate("law", "Explique a legislação de trânsito aplicável ao seguinte tema. Identifique a norma, artigo, vigência e fonte oficial atualizada: [tema].")}><Scale size={17}/> Legislação</button>
      <button type="button" className={`navItem ${activeMenu === "studio" ? "active" : ""}`} onClick={() => setActiveMenu("studio")}><AudioLines size={17}/> Estúdio de áudio</button>
      <button type="button" className={`navItem ${activeMenu === "video" ? "active" : ""}`} onClick={() => setActiveMenu("video")}><Film size={17}/> Estúdio de vídeo</button>
      <button type="button" className={`navItem ${activeMenu === "risk" ? "active" : ""}`} onClick={() => navigate("risk", "Analise esta situação de trânsito sob a ótica da segurança viária: perigos, riscos, fatores humanos, usuários vulneráveis e conduta preventiva. Situação: [descreva].")}><ShieldAlert size={17}/> Análise de risco</button>
      <div className="sidebarHistory" id="atlas-history">
        <div className="historyHeading"><span><History size={13}/> CONVERSAS</span><small>{conversations.length}</small></div>
        <div className="historyItems">{sortedConversations.map(c => <div className={`historyItem ${c.id === activeId ? "selected" : ""}`} key={c.id}>
          <button type="button" className="historyOpen" onClick={() => openConversation(c.id)} disabled={loading} title={c.title}><MessageSquare size={13}/><span>{c.title}</span></button>
          <button type="button" className="deleteConversation" onClick={() => deleteConversation(c.id)} disabled={loading} title="Excluir conversa" aria-label={`Excluir ${c.title}`}><Trash2 size={13}/></button>
        </div>)}</div>
      </div>
      <button type="button" className="navItem voiceToggle" onClick={() => { setVoice(v => !v); if (voice) { window.speechSynthesis?.cancel(); audioRef.current?.pause(); } }}><AudioLines size={17}/> Voz: {voice ? "ativada" : "desativada"}</button>
      <div className="sideGrow"/><div className="security"><ShieldCheck/><b>Proteção ativa</b><p>O ATLAS não executa ações externas nesta versão.</p><small>● POLÍTICAS BÁSICAS ATIVAS</small></div>
    </aside>
    <section className="main">
      <header className="topbar"><AuthControls/>Workspace <span>{serviceStatus === "ready" ? "● Sistema operacional" : serviceStatus === "error" ? "● Verificar conexão" : "● Verificando sistema…"}</span></header>
      <div className="content">
        <section className="welcomeBar"><div><div className="eyebrow">ATLAS II <span>/ INSTRUTOR INTELIGENTE</span></div><h1>Conhecimento que <span>protege vidas.</span></h1><p>Trânsito, legislação, neuroeducação e segurança viária em um só lugar.</p></div><div className="welcomeOrb"><AudioLines size={27}/></div></section>
        {activeMenu === "studio" ? <AudioStudio/> : activeMenu === "video" ? <VideoStudio/> : <section className="chat" id="atlas-chat">
          <header><AudioLines/><div><b>{active?.title || "Nova conversa"}</b><small>Instrutor Inteligente · Trânsito, legislação, aulas e neuroeducação.</small></div><span>{loading ? "● PROCESSANDO" : "● ONLINE"}</span></header>
          <div className="conversation" id="atlas-conversation" ref={conversationRef} aria-live="polite">
            {history.length === 0 ? <div className="answer"><div className="botIcon"><Bot/></div><div><b>ATLAS II <small>INSTRUTOR INTELIGENTE</small></b><p>{welcome}</p></div></div> : history.map((item, index) => <div className="answer" key={index}><div className="botIcon">{item.role === "assistant" ? <Bot/> : <span>V</span>}</div><div><b>{item.role === "assistant" ? "ATLAS" : "VOCÊ"} <small>{item.role === "assistant" ? "ASSISTENTE" : "MENSAGEM"}</small></b><p>{item.content}</p></div></div>)}
            {loading && <div className="answer processing"><div className="botIcon"><Bot/></div><div><b>ATLAS</b><p>{slowRequest ? "Ainda estou elaborando a resposta. Isso pode levar alguns segundos..." : "Analisando sua pergunta e preparando a resposta..."}</p><div className="processingTrack"><span/></div></div></div>}
          </div>
          {showDocumentStudio && <DocumentStudio key={activeId} initialContent={[...history].reverse().find(item => item.role === "assistant")?.content || ""} onClose={() => setShowDocumentStudio(false)}/>}
          <form onSubmit={send}><textarea id="atlas-chat-input" value={text} onChange={e => setText(e.target.value)} placeholder="Pergunte sobre CTB, legislação, aulas, direção defensiva, neuroeducação ou segurança viária…" rows={2} disabled={loading}/><div className="formFoot"><button type="button" className="voiceButton" onClick={() => setShowDocumentStudio(value => !value)} disabled={loading}><FileText size={16}/> {showDocumentStudio ? "Fechar documentos" : "Criar documento"}</button><button type="button" className="voiceButton" onClick={toggleMic} disabled={loading}>{listening ? <MicOff size={16}/> : <Mic size={16}/>} {listening ? "Ouvindo…" : "Falar mensagem"}</button><button type="button" className="voiceButton" onClick={() => { setVoice(!voice); if (voice) { window.speechSynthesis?.cancel(); audioRef.current?.pause(); } }}><AudioLines size={15}/> Resposta {voice ? "falada" : "silenciosa"}</button><button className="send" disabled={loading || !text.trim()}><Send size={16}/> Enviar</button></div></form>
        </section>}
        <footer>ATLAS II / INSTRUTOR INTELIGENTE <span>TRÂNSITO + LEGISLAÇÃO + NEUROEDUCAÇÃO / SEGURANÇA CONTROLADA</span></footer>
      </div>
    </section>
  </main>;
}
