"use client";
import { useEffect, useRef, useState } from "react";
import { AudioLines, Download, RefreshCw, Radio, Waves, CircleDot, BarChart3 } from "lucide-react";

type VisualStyle = "wave" | "equalizer" | "radial";
const MAX_SCRIPT = 10000;

export default function VideoStudio(){
 const [script,setScript]=useState("");
 const [audioUrl,setAudioUrl]=useState("");
 const [videoUrl,setVideoUrl]=useState(""); const [videoExt,setVideoExt]=useState("webm");
 const [busy,setBusy]=useState(false);
 const [recording,setRecording]=useState(false);
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
 useEffect(()=>()=>{cancelAnimationFrame(animationRef.current);if(audioUrl)URL.revokeObjectURL(audioUrl);if(videoUrlRef.current)URL.revokeObjectURL(videoUrlRef.current);audioContextRef.current?.close();},[]);
 async function generateAudio(){
  if(!script.trim()||busy)return;
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
  }catch(e){setError(e instanceof Error?e.message:"Falha ao gerar áudio.");setStatus("");}
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
  ctx.textAlign="center";ctx.fillStyle="#75e8ed";ctx.font="600 "+Math.round(w*.022)+"px Arial";ctx.fillText("ENAT  /  ATLAS II",w/2,h*.12);
  ctx.fillStyle="rgba(200,235,245,.55)";ctx.font="400 "+Math.round(w*.013)+"px Arial";ctx.fillText("AUDIO SIGNAL VISUALIZATION",w/2,h*.15);
  const cx=w/2,cy=h*.49,base=Math.min(w,h)*.17;
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
  ctx.fillStyle="rgba(153,202,218,.8)";ctx.font="500 "+Math.round(w*.016)+"px Arial";ctx.fillText("FREQUÊNCIA  •  AMPLITUDE  •  TEMPO",w/2,h*.82);
  ctx.fillStyle="rgba(91,224,230,.75)";ctx.fillRect(w*.1,h*.88,w*.8,2);
  ctx.fillStyle="rgba(180,214,224,.65)";ctx.font="400 "+Math.round(w*.012)+"px Arial";ctx.fillText("ENSINO NEUROEDUCACIONAL APLICADO AO TRÂNSITO",w/2,h*.92);
 }
 async function exportVideo(){
  const audio=audioRef.current,canvas=canvasRef.current;
  if(!audio||!canvas||!audioUrl){setError("Gere a narração antes de exportar.");return;}
  if(!("MediaRecorder" in window)||!canvas.captureStream){setError("Este navegador não oferece gravação de vídeo compatível.");return;}
  setRecording(true);setError("");setStatus("Preparando visualização de frequência...");
  let stream:MediaStream|undefined;
  try{
   let context=audioContextRef.current;
   if(!context){context=new AudioContext();audioContextRef.current=context;const source=context.createMediaElementSource(audio);sourceRef.current=source;const analyser=context.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.82;analyserRef.current=analyser;const destination=context.createMediaStreamDestination();destinationRef.current=destination;source.connect(analyser);analyser.connect(context.destination);analyser.connect(destination);}
   await context.resume();
   const w=format==="vertical"?720:1280,h=format==="vertical"?1280:720;canvas.width=w;canvas.height=h;
   const analyser=analyserRef.current!,destination=destinationRef.current!,ctx=canvas.getContext("2d");if(!ctx)throw new Error("Não foi possível preparar a visualização.");
   const videoStream=canvas.captureStream(30);stream=new MediaStream([...videoStream.getVideoTracks(),...destination.stream.getAudioTracks()]);
   const mime=["video/mp4;codecs=h264,aac","video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus"].find(t=>MediaRecorder.isTypeSupported(t));
   if(!mime)throw new Error("Formato de gravação não suportado neste navegador.");
   const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000,audioBitsPerSecond:128000});const chunks:BlobPart[]=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   const completed=new Promise<Blob>((resolve,reject)=>{recorder.onerror=()=>reject(new Error("Falha durante a gravação."));recorder.onstop=()=>resolve(new Blob(chunks,{type:mime}));});
   audio.currentTime=0;audio.onended=null;audio.onerror=null;
   const render=()=>{draw(ctx,analyser,w,h,style,performance.now());if(!audio!.paused&&!audio!.ended)animationRef.current=requestAnimationFrame(render);};
   draw(ctx,analyser,w,h,style,0);recorder.start(1000);render();setStatus("Gravando vídeo sincronizado com o áudio · "+formatTime(audio.duration));
   await audio.play();
   await new Promise<void>(resolve=>{audio.onended=()=>resolve();audio.onerror=()=>resolve();});
   cancelAnimationFrame(animationRef.current);draw(ctx,analyser,w,h,style,performance.now());recorder.stop();
   const blob=await completed;const url=URL.createObjectURL(blob);setVideoExt(blob.type.includes("mp4")?"mp4":"webm");setVideoUrl(old=>{if(old)URL.revokeObjectURL(old);videoUrlRef.current=url;return url;});
   setStatus("Vídeo finalizado · "+formatTime(audio.duration)+" · "+(blob.type.includes("mp4")?"MP4":"WebM"));
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível exportar o vídeo.");setStatus("");}
  finally{stream?.getTracks().forEach(t=>t.stop());setRecording(false);}
 }
 return <section className="videoStudio audioVisualStudio">
  <header className="videoStudioHeading"><div className="videoStudioIcon"><AudioLines size={25}/></div><div><span>ENAT / ATLAS II · AUDIOVISUAL</span><h2>Estúdio de frequência sonora</h2><p>Transforme a narração em um vídeo futurista sincronizado com o áudio.</p></div></header>
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
    <button className="videoPrimary" type="button" disabled={!script.trim()||busy||recording} onClick={generateAudio}>{busy?<><RefreshCw size={15} className="studioSpin"/> Gerando áudio...</>:<><Radio size={15}/> Gerar narração</>}</button>
    {audioUrl&&<div className="audioReady"><div className="videoSectionTitle"><b>2. Narração pronta</b><small>{formatTime(duration)}</small></div><audio ref={audioRef} className="videoAudioPreview" controls src={audioUrl}/></div>}
    <p className="videoStatus" role="status">{status}</p>{error&&<p className="studioError" role="alert">{error}</p>}
    <button className="videoPrimary videoExport" type="button" disabled={!audioUrl||recording||busy} onClick={exportVideo}>{recording?<><RefreshCw size={15} className="studioSpin"/> Gravando frequência...</>:<><Download size={15}/> Gerar vídeo completo</>}</button>
    <p className="audioDurationNote">A duração do vídeo acompanha integralmente o áudio. Não há limite artificial de 2 minutos. Gravações longas dependem da memória disponível no navegador.</p>
   </div>
   <div className="videoPreviewPanel"><div className={"audioVisualPreview "+format}><canvas ref={canvasRef}/><div className="audioPreviewOverlay"><AudioLines size={23}/><b>ATLAS II · ENAT</b><span>VISUALIZAÇÃO DE FREQUÊNCIA</span></div></div>
    {videoUrl&&<div className="videoDownloadArea"><a href={videoUrl} download={"ENAT-audio-visual-"+Date.now()+"."+videoExt}><Download size={16}/> Baixar vídeo</a><small>Formato final indicado pelo navegador durante a gravação.</small></div>}
    <div className="videoFreeNote">Sem pessoas, fotografias, cenas ou APIs de vídeo. A animação é gerada a partir das frequências reais da narração com Web Audio API e Canvas. A exportação utiliza a capacidade de gravação do navegador.</div>
   </div>
  </div>
 </section>;
}
