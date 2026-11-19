"use client";

import { useEffect, useState } from "react";
import { AudioLines, Download, Mic2, RefreshCw, Volume2 } from "lucide-react";
import { generateLongSpeech, splitSpeechText } from "@/lib/tts-client";

const MAX_CHARS = 30000;

export default function AudioStudio() {
  const [script, setScript] = useState("");
  const [busy, setBusy] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [error, setError] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [progress, setProgress] = useState({ completed: 0, total: 0, percent: 0, current: 1 });

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  async function generate() {
    const value = script.trim();
    if (!value || busy) return;
    setBusy(true);
    setError("");
    setCreatedAt("");
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
    try {
      const chunks = splitSpeechText(value);
      setProgress({ completed: 0, total: chunks.length, percent: 0, current: 1 });
      const bytes = await generateLongSpeech(value, setProgress);
      setAudioUrl(URL.createObjectURL(new Blob([bytes], { type: "audio/wav" })));
      setCreatedAt(new Date().toLocaleString("pt-BR"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar áudio.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="audioStudio">
    <header className="studioHeading">
      <div className="studioIcon"><AudioLines size={23}/></div>
      <div><span>ATLAS II / PRODUÇÃO DE CONTEÚDO</span><h2>Estúdio de áudio</h2><p>Transforme textos extensos em narrações com o motor neural de voz do ATLAS.</p></div>
    </header>
    <div className="studioGrid">
      <div className="studioEditor">
        <label htmlFor="studio-script">Texto para narração</label>
        <textarea id="studio-script" value={script} onChange={e => setScript(e.target.value.slice(0, MAX_CHARS))} placeholder="Cole ou escreva o texto que deseja transformar em áudio..." maxLength={MAX_CHARS}/>
        <div className="studioMeta"><span>Português brasileiro · Motor neural de voz do ATLAS</span><span>{script.length.toLocaleString("pt-BR")} / {MAX_CHARS.toLocaleString("pt-BR")} caracteres</span></div>
        <button type="button" className="studioGenerate" onClick={generate} disabled={!script.trim() || busy}>
          {busy ? <><RefreshCw size={16} className="studioSpin"/> Gerando bloco {progress.current} de {progress.total || "..." }...</> : <><Mic2 size={16}/> {progress.completed > 0 && progress.completed < progress.total ? "Continuar geração" : "Gerar áudio"}</>}
        </button>
        {busy && <div className="videoRenderProgress" role="status"><div><b>Geração sequencial Gemini</b><strong>{progress.percent}%</strong></div><progress value={progress.percent} max={100}/><small>Bloco {Math.min(progress.completed + 1, progress.total)} de {progress.total} · {progress.completed} concluídos</small></div>}
        {error && <p className="studioError" role="alert">{error}</p>}
      </div>
      <div className="studioOutput">
        <div className="outputIcon"><Volume2 size={25}/></div>
        <h3>Seu áudio aparecerá aqui</h3>
        <p>Depois de gerar, você poderá ouvir e baixar o arquivo para suas postagens.</p>
        {audioUrl ? <div className="audioResult">
          <audio controls preload="metadata" src={audioUrl}/>
          <a className="studioDownload" href={audioUrl} download={`atlas-narracao-${Date.now()}.wav`}><Download size={16}/> Baixar áudio</a>
          <small>Gerado em {createdAt}</small>
        </div> : <small className="studioHint">A gravação utiliza o mesmo mecanismo de voz do ATLAS II.</small>}
      </div>
    </div>
    <div className="studioNote"><AudioLines size={15}/><span>A voz, a identidade sonora e as orientações de pronúncia são as mesmas já aprovadas para o ATLAS. A geração utiliza o motor neural próprio do ENAT quando configurado, sem depender de cotas de provedores externos.</span></div>
  </section>;
}
