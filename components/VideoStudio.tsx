"use client";
import { useEffect, useRef, useState } from "react";
import { AudioLines, Download, RefreshCw, Radio, Waves, CircleDot, BarChart3, Pause, Play, Square } from "lucide-react";

type VisualStyle = "wave" | "equalizer" | "radial";
const MAX_SCRIPT = 10000;

export default function VideoStudio(){
 const [script,setScript]=useState("");
 const [audioUrl,setAudioUrl]=useState("");
 const [videoUrl,setVideoUrl]=useState(""); const [videoExt,setVideoExt]=useState("webm");
 const [busy,setBusy]=useState(false);
 const [recording,setRecording]=useState(false);
 const [paused,setPaused]=useState(false);
 const [error,setError]=useState("");
 const [status,setStatus]=useState("");
 const [style,setStyle]=useState<VisualStyle>("wave");
 const [format,setFormat]=useState<"vertical"|"horizontal">("vertical");
 const [duration,setDuration]=useState(0);
 const audioRef=useRef<HTMLAudioElement|null>(null);
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const audioContextRef=useRef<AudioContext|null>(null);
 const sourceRef=useRef<MediaElementAudioSourceNode|null>(null);
 const analyserRef=useRef<AnalyserNode|null>(null);
 const destinationRef=useRef<MediaStreamAudioDestinationNode|null>(null);
 const animationRef=useRef<number>(0);
 const videoUrlRef=useRef("");
 const recorderRef=useRef<MediaRecorder|null>(null);
 const finishPlaybackRef=useRef<(()=>void)|null>(null);
 const stopRequestedRef=useRef(false);
 const enatLogoRef=useRef<HTMLImageElement|null>(null);
 const neuroLogoRef=useRef<HTMLImageElement|null>(null);
 useEffect(()=>{
  const enat=new Image();enat.src="/logos/enat-logo.png";enat.onload=()=>{enatLogoRef.current=enat;};
  const neuro=new Image();neuro.src="/logos/neurociencia-aplicada-transito.jpeg";neuro.onload=()=>{neuroLogoRef.current=neuro;};
 },[]);
 useEffect(()=>()=>{cancelAnimationFrame(animationRef.current);if(audioUrl)URL.revokeObjectURL(audioUrl);if(videoUrlRef.current)URL.revokeObjectURL(videoUrlRef.current);audioContextRef.current?.close();},[]);
 async function generateAudio():Promise<string|null>{
  if(!script.trim()||busy)return null;
  setBusy(true);setError("");setStatus("Gerando narração com a voz do ATLAS...");
  try{
   const r=await fetch("/api/tts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:script.trim()}),signal:AbortSignal.timeout(110000)});
   if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||"Não foi possível gerar a narração.");}
   const blob=await r.blob();if(!blob.type.startsWith("audio/"))throw new Error("O serviço não retornou áudio válido.");
   const url=URL.createObjectURL(blob);const probe=new Audio(url);
   const seconds=await new Promise<number>((resolve,reject)=>{probe.onloadedmetadata=()=>resolve(probe.duration);probe.onerror=()=>reject(new Error("Não foi possível ler a duração do áudio."));});
   if(audioUrl)URL.revokeObjectURL(audioUrl);
   setAudioUrl(url);setDuration(seconds);setStatus("Narração pronta · "+formatTime(seconds)+". O vídeo acompanhará toda a duração do áudio.");
   setVideoUrl(old=>{if(old)URL.revokeObjectURL(old);videoUrlRef.current="";return "";});
   return url;
  }catch(e){setError(e instanceof Error?e.message:"Falha ao gerar áudio.");setStatus("");return null;}
  finally{setBusy(false);}
 }
 function formatTime(value:number){if(!Number.isFinite(value))return "--:--";const n=Math.max(0,Math.floor(value));return Math.floor(n/60)+":"+String(n%60).padStart(2,"0");}
 function draw(ctx:CanvasRenderingContext2D,analyser:AnalyserNode,w:number,h:number,mode:VisualStyle,time:number){
  const buffer=new Uint8Array(analyser.frequencyBinCount);analyser.getByteTimeDomainData(buffer);
  const freq=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(freq);
  ctx.fillStyle="#050b14";ctx.fillRect(0,0,w,h);
  const glow=ctx.createRadialGradient(w/2,h*.48,10,w/2,h*.48,w*.72);glow.addColorStop(0,"rgba(0,198,220,.13)");glow.addColorStop(1,"rgba(2,9,18,0)");
  ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="rgba(68,207,226,.12)";ctx.lineWidth=1;
  for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(w*i/8,0);ctx.lineTo(w*i/8,h);ctx.stroke();}
  for(let i=1;i<14;i++){ctx.beginPath();ctx.moveTo(0,h*i/14);ctx.lineTo(w,h*i/14);ctx.stroke();}
  // Logomarcas originais no cabeçalho superior, fora da área da frequência.
  const drawLogo=(img:HTMLImageElement|null,x:number,y:number,maxW:number,maxH:number)=>{
   if(!img||!img.complete||!img.naturalWidth)return;
   const scale=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight);
   const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
   ctx.drawImage(img,x-dw/2,y-dh/2,dw,dh);
  };
  drawLogo(neuroLogoRef.current,w*.27,h*.105,w*.28,h*.19);
  drawLogo(enatLogoRef.current,w*.73,h*.105,w*.24,h*.19);
  ctx.textAlign="center";
  ctx.save();
  ctx.shadowColor="rgba(31,226,238,.7)";ctx.shadowBlur=Math.max(12,w*.018);
  ctx.fillStyle="#a8fbff";ctx.font="700 "+Math.round(w*.034)+"px Arial";
  ctx.fillText("ATLAS IA",w/2,h*.225);
  ctx.restore();
  ctx.strokeStyle="rgba(70,221,232,.28)";ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(w*.34,h*.275);ctx.lineTo(w*.66,h*.275);ctx.stroke();
  const cx=w/2,cy=h*.57,base=Math.min(w,h)*.17;
  if(mode==="wave"){
   ctx.beginPath();ctx.lineWidth=Math.max(2,w*.003);ctx.strokeStyle="#64edf0";ctx.shadowColor="#28dbe7";ctx.shadowBlur=18;
   for(let i=0;i<buffer.length;i++){const x=i/(buffer.length-1)*w*.82+w*.09;const y=cy+(buffer[i]-128)/128*h*.22;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();ctx.shadowBlur=0;
   ctx.beginPath();ctx.strokeStyle="rgba(71,174,224,.6)";ctx.lineWidth=1;for(let i=0;i<buffer.length;i++){const x=i/(buffer.length-1)*w*.82+w*.09;const y=cy+(buffer[i]-128)/128*h*.12+Math.sin(time/500+i*.04)*2;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
  }else if(mode==="equalizer"){
   const count=64,gap=w*.004,bw=(w*.78-gap*(count-1))/count;
   for(let i=0;i<count;i++){const value=freq[Math.floor(i*freq.length/count)]/255;const bh=Math.max(4,value*h*.35);const x=w*.11+i*(bw+gap);const grad=ctx.createLinearGradient(0,cy-bh,0,cy+bh);grad.addColorStop(0,"#8cfbfa");grad.addColorStop(1,"#1678b5");ctx.fillStyle=grad;ctx.shadowColor="#27cde0";ctx.shadowBlur=8;ctx.fillRect(x,cy-bh/2,bw,bh);}ctx.shadowBlur=0;
  }else{
   const count=112;ctx.save();ctx.translate(cx,cy);ctx.rotate(time/12000);
   for(let i=0;i<count;i++){const angle=i/count*Math.PI*2;const value=freq[Math.floor(i*freq.length/count)]/255;const inner=base*.68;const outer=inner+base*(.15+value*.72);ctx.beginPath();ctx.moveTo(Math.cos(angle)*inner,Math.sin(angle)*inner);ctx.lineTo(Math.cos(angle)*outer,Math.sin(angle)*outer);ctx.strokeStyle=i%4===0?"#9afafa":"#28b9d3";ctx.lineWidth=Math.max(2,w*.0025);ctx.shadowColor="#23dce8";ctx.shadowBlur=10;ctx.stroke();}
   ctx.shadowBlur=0;ctx.beginPath();ctx.arc(0,0,base*.58,0,Math.PI*2);ctx.strokeStyle="rgba(100,237,240,.5)";ctx.lineWidth=2;ctx.stroke();ctx.restore();
  }
  // Área inferior e laterais permanecem livres: somente a frequência visual.
 }
 async function exportVideo(){
  const audio=audioRef.current,canvas=canvasRef.current;
  if(!audio||!canvas||!audioUrl){setError("Gere a narração antes de exportar.");return;}
  if(!("MediaRecorder" in window)||!canvas.captureStream){setError("Este navegador não oferece gravação de vídeo compatível.");return;}
  setRecording(true);stopRequestedRef.current=false;setError("");setStatus("Preparando visualização de frequência...");
  let stream:MediaStream|undefined;
  try{
   let context=audioContextRef.current;
   if(!context){
    context=new AudioContext();audioContextRef.current=context;
    const source=context.createMediaElementSource(audio);sourceRef.current=source;
    const analyser=context.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.82;analyserRef.current=analyser;
    const destination=context.createMediaStreamDestination();destinationRef.current=destination;
    source.connect(analyser);analyser.connect(context.destination);analyser.connect(destination);
   }
   await context.resume();
   audio.muted=false;audio.volume=1;
   const w=format==="vertical"?720:1280,h=format==="vertical"?1280:720;canvas.width=w;canvas.height=h;
   const analyser=analyserRef.current!,ctx=canvas.getContext("2d");if(!ctx)throw new Error("Não foi possível preparar a visualização.");
   const videoStream=canvas.captureStream(30);
   // Captura a saída real do elemento de áudio, evitando depender de uma rota de mixagem separada.
   const audioWithCaptureStream=audio as HTMLAudioElement & { captureStream?: () => MediaStream };
   const audioStream=typeof audioWithCaptureStream.captureStream==="function"?audioWithCaptureStream.captureStream():destinationRef.current?.stream;
   const audioTracks=audioStream?.getAudioTracks()??[];
   if(!audioTracks.length)throw new Error("O navegador não disponibilizou a faixa de áudio para a gravação. Tente novamente no Microsoft Edge atualizado.");
   stream=new MediaStream([...videoStream.getVideoTracks(),...audioTracks]);
   const mime=["video/mp4;codecs=h264,aac","video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus"].find(t=>MediaRecorder.isTypeSupported(t));
   if(!mime)throw new Error("Formato de gravação não suportado neste navegador.");
   if(stream.getAudioTracks().length===0)throw new Error("A gravação foi interrompida: o vídeo está sem faixa de áudio.");
   const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000,audioBitsPerSecond:192000});const chunks:BlobPart[]=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorderRef.current=recorder;
   const completed=new Promise<Blob>((resolve,reject)=>{recorder.onerror=()=>reject(new Error("Falha durante a gravação."));recorder.onstop=()=>resolve(new Blob(chunks,{type:mime}));});
   audio.currentTime=0;audio.onended=null;audio.onerror=null;
   const render=()=>{draw(ctx,analyser,w,h,style,performance.now());if(recorderRef.current&&recorderRef.current.state!=="inactive")animationRef.current=requestAnimationFrame(render);};
   draw(ctx,analyser,w,h,style,0);recorder.start(1000);render();setStatus("Gravando vídeo sincronizado com o áudio · "+formatTime(audio.duration));
   await audio.play();
   await new Promise<void>(resolve=>{
    finishPlaybackRef.current=resolve;
    audio.onended=()=>resolve();audio.onerror=()=>resolve();
    // Também atende ao clique em "Parar" feito durante a inicialização do player.
    if(stopRequestedRef.current)resolve();
   });
   finishPlaybackRef.current=null;
   cancelAnimationFrame(animationRef.current);draw(ctx,analyser,w,h,style,performance.now());
   // O MediaRecorder só pode ser finalizado uma vez. O botão Parar apenas solicita
   // o encerramento; este ponto gera o arquivo e libera o botão de download.
   if(recorder.state!=="inactive")recorder.stop();
   const blob=await completed;
   if(!blob.size)throw new Error("O arquivo de vídeo ficou vazio. Tente gerar novamente.");
   const url=URL.createObjectURL(blob);
   const verification=new Audio(url);
   await new Promise<void>((resolve,reject)=>{verification.onloadedmetadata=()=>resolve();verification.onerror=()=>reject(new Error("Não foi possível validar o arquivo de vídeo gerado."));});
   if(!Number.isFinite(verification.duration)||verification.duration<=0){URL.revokeObjectURL(url);throw new Error("O vídeo gerado não contém uma duração válida.");}
   setVideoExt(blob.type.includes("mp4")?"mp4":"webm");setVideoUrl(old=>{if(old)URL.revokeObjectURL(old);videoUrlRef.current=url;return url;});
   setStatus("Vídeo finalizado com faixa de áudio · "+formatTime(verification.duration)+" · "+(blob.type.includes("mp4")?"MP4":"WebM"));
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível exportar o vídeo.");setStatus("");}
  finally{stream?.getTracks().forEach(t=>t.stop());recorderRef.current=null;setRecording(false);setPaused(false);}
 }
 async function generateVideoWithAudio(){
  const generated=await generateAudio();
  if(!generated)return;
  await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  await exportVideo();
 }
 function pauseVideo(){
  const audio=audioRef.current,recorder=recorderRef.current;
  if(!audio||!recorder||recorder.state!=="recording")return;
  audio.pause();recorder.pause();setPaused(true);setStatus("Gravação pausada.");
 }
 function resumeVideo(){
  const audio=audioRef.current,recorder=recorderRef.current;
  if(!audio||!recorder||recorder.state!=="paused")return;
  void audio.play();recorder.resume();setPaused(false);setStatus("Gravação retomada.");
 }
 function stopVideo(){
  const audio=audioRef.current,recorder=recorderRef.current;
  if(!recorder||recorder.state==="inactive")return;
  stopRequestedRef.current=true;
  if(audio)audio.pause();
  finishPlaybackRef.current?.();
  setStatus("Finalizando arquivo para liberar o download...");
 }
 return <section className="videoStudio audioVisualStudio">
  <header className="videoStudioHeading"><div className="videoStudioIcon"><AudioLines size={25}/></div><div><span>ATLAS IA</span><h2>Estúdio de frequência sonora</h2><p>Transforme a narração em um vídeo futurista sincronizado com o áudio.</p></div></header>
  <div className="audioStudioControls">
   <label>Formato do vídeo</label><div className="videoFormat"><button type="button" className={format==="vertical"?"selected":""} onClick={()=>setFormat("vertical")}>Vertical · Reels</button><button type="button" className={format==="horizontal"?"selected":""} onClick={()=>setFormat("horizontal")}>Horizontal · YouTube</button></div>
   <label>Visualização sonora</label><div className="audioStyleChoices">
    <button type="button" className={style==="wave"?"selected":""} onClick={()=>setStyle("wave")}><Waves size={17}/> Onda sonora</button>
    <button type="button" className={style==="equalizer"?"selected":""} onClick={()=>setStyle("equalizer")}><BarChart3 size={17}/> Equalizador</button>
    <button type="button" className={style==="radial"?"selected":""} onClick={()=>setStyle("radial")}><CircleDot size={17}/> Espectro circular</button>
   </div>
  </div>
  <div className="audioStudioGrid">
   <div className="videoEditor">
    <div className="videoSectionTitle"><b>1. Texto para narração</b><small>{script.length.toLocaleString("pt-BR")} / {MAX_SCRIPT}</small></div>
    <textarea className="videoNarration" rows={10} maxLength={MAX_SCRIPT} value={script} onChange={e=>setScript(e.target.value.slice(0,MAX_SCRIPT))} placeholder="Escreva ou cole o texto que o ATLAS deverá narrar..."/>
    <button className="videoPrimary" type="button" disabled={!script.trim()||busy||recording} onClick={generateVideoWithAudio}>{busy?<><RefreshCw size={15} className="studioSpin"/> Gerando áudio e preparando vídeo...</>:<><Radio size={15}/> Gerar vídeo com áudio</>}</button>
    {audioUrl&&<div className="audioReady"><div className="videoSectionTitle"><b>2. Narração pronta</b><small>{formatTime(duration)}</small></div><audio ref={audioRef} className="videoAudioPreview" controls src={audioUrl}/></div>}
    <p className="videoStatus" role="status">{status}</p>{error&&<p className="studioError" role="alert">{error}</p>}
    {recording&&<div className="audioStyleChoices audioRecordingControls">
     {paused?<button type="button" onClick={resumeVideo}><Play size={16}/> Continuar</button>:<button type="button" onClick={pauseVideo}><Pause size={16}/> Pausar</button>}
     <button type="button" onClick={stopVideo}><Square size={15}/> Parar e finalizar</button>
    </div>}
    {!recording&&audioUrl&&<button className="videoPrimary videoExport" type="button" disabled={busy} onClick={exportVideo}><RefreshCw size={15}/> Gerar vídeo novamente</button>}
    <p className="audioDurationNote">A duração do vídeo acompanha integralmente o áudio. Não há limite artificial de 2 minutos. Gravações longas dependem da memória disponível no navegador.</p>
   </div>
   <div className="videoPreviewPanel"><div className={"audioVisualPreview "+format}><canvas ref={canvasRef}/></div>
    {videoUrl&&<div className="videoDownloadArea"><a href={videoUrl} download={"ENAT-audio-visual-"+Date.now()+"."+videoExt}><Download size={16}/> Baixar vídeo</a><small>Formato final indicado pelo navegador durante a gravação.</small></div>}
    <div className="videoFreeNote">Sem pessoas, fotografias, cenas ou APIs de vídeo. A animação é gerada a partir das frequências reais da narração com Web Audio API e Canvas. A exportação utiliza a capacidade de gravação do navegador.</div>
   </div>
  </div>
 </section>;
}
