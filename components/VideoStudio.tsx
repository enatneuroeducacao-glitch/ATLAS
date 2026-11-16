"use client";
import { useEffect, useRef, useState } from "react";
import { AudioLines, Download, RefreshCw, Radio, Waves, CircleDot, BarChart3, Eye, Zap, Play } from "lucide-react";

type VisualStyle = "wave" | "equalizer" | "radial";
type ProductionMode = "download" | "preview";
const MAX_SCRIPT = 30000;
const FPS = 30;
const SCRIPT_STORAGE_KEY = "atlas.video-studio.script.v1";

export default function VideoStudio(){
 const [script,setScript]=useState("");
 const [scriptRestored,setScriptRestored]=useState(false);
 const [scriptSaveStatus,setScriptSaveStatus]=useState("Carregando rascunho...");
 const [audioUrl,setAudioUrl]=useState("");
 const [videoUrl,setVideoUrl]=useState("");
 const [videoExt,setVideoExt]=useState("mp4");
 const [busy,setBusy]=useState(false);
 const [rendering,setRendering]=useState(false);
 const [progress,setProgress]=useState(0);
 const [error,setError]=useState("");
 const [status,setStatus]=useState("");
 const [style,setStyle]=useState<VisualStyle>("wave");
 const [format,setFormat]=useState<"vertical"|"horizontal">("vertical");
 const [mode,setMode]=useState<ProductionMode>("download");
 const [duration,setDuration]=useState(0);
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const videoUrlRef=useRef("");
 const audioUrlRef=useRef("");
 const enatLogoRef=useRef<HTMLImageElement|null>(null);
 const neuroLogoRef=useRef<HTMLImageElement|null>(null);

 useEffect(()=>{
  try{
   const saved=window.localStorage.getItem(SCRIPT_STORAGE_KEY);
   if(saved!==null)setScript(saved.slice(0,MAX_SCRIPT));
   setScriptSaveStatus(saved!==null&&saved.length>0?"Rascunho recuperado automaticamente":"Salvamento automático ativado");
  }catch{setScriptSaveStatus("Salvamento local indisponível neste navegador");}
  setScriptRestored(true);
 },[]);
 function updateScript(value:string){
  const next=value.slice(0,MAX_SCRIPT);
  setScript(next);
  try{
   if(next.length)window.localStorage.setItem(SCRIPT_STORAGE_KEY,next);
   else window.localStorage.removeItem(SCRIPT_STORAGE_KEY);
   setScriptSaveStatus(next.length?"Salvo automaticamente neste navegador":"Rascunho vazio");
  }catch{setScriptSaveStatus("Não foi possível salvar neste navegador");}
  clearAudio();clearVideo();
 }
 useEffect(()=>{
  const enat=new Image();enat.src="/logos/enat-logo.png";enat.onload=()=>{enatLogoRef.current=enat;};
  const neuro=new Image();neuro.src="/logos/neurociencia-aplicada-transito.jpeg";neuro.onload=()=>{neuroLogoRef.current=neuro;};
 },[]);
 useEffect(()=>()=>{if(videoUrlRef.current)URL.revokeObjectURL(videoUrlRef.current);if(audioUrlRef.current)URL.revokeObjectURL(audioUrlRef.current);},[]);

 function formatTime(value:number){
  if(!Number.isFinite(value))return "--:--";
  const n=Math.max(0,Math.floor(value));
  return Math.floor(n/60)+":"+String(n%60).padStart(2,"0");
 }
 function clearAudio(){
  if(audioUrlRef.current)URL.revokeObjectURL(audioUrlRef.current);
  audioUrlRef.current="";setAudioUrl("");setDuration(0);
 }
 function clearVideo(){
  setVideoUrl(old=>{if(old)URL.revokeObjectURL(old);videoUrlRef.current="";return "";});
  setProgress(0);
 }
 async function generateAudio():Promise<string|null>{
  if(!script.trim()||busy||rendering)return null;
  setBusy(true);setError("");setStatus("Gerando narração com a voz do ATLAS...");
  try{
   const r=await fetch("/api/tts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:script.trim()}),signal:AbortSignal.timeout(110000)});
   if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||"Não foi possível gerar a narração.");}
   const blob=await r.blob();if(!blob.type.startsWith("audio/"))throw new Error("O serviço não retornou áudio válido.");
   const url=URL.createObjectURL(blob);
   const probe=new Audio(url);
   const seconds=await new Promise<number>((resolve,reject)=>{probe.onloadedmetadata=()=>resolve(probe.duration);probe.onerror=()=>reject(new Error("Não foi possível ler a duração do áudio."));});
   if(audioUrlRef.current)URL.revokeObjectURL(audioUrlRef.current);
   audioUrlRef.current=url;setAudioUrl(url);setDuration(seconds);clearVideo();
   setStatus("Narração pronta · "+formatTime(seconds)+". Escolha o modo de produção.");
   return url;
  }catch(e){setError(e instanceof Error?e.message:"Falha ao gerar áudio.");setStatus("");return null;}
  finally{setBusy(false);}
 }

 function createOfflineAnalyser(audioBuffer:AudioBuffer,time:number):AnalyserNode{
  const size=512,bins=size/2,channelCount=audioBuffer.numberOfChannels;
  const channels=Array.from({length:channelCount},(_,i)=>audioBuffer.getChannelData(i));
  const center=Math.floor(time*audioBuffer.sampleRate);
  const real=new Float64Array(size),imag=new Float64Array(size),timeData=new Uint8Array(bins),frequencyData=new Uint8Array(bins);
  for(let i=0;i<size;i++){
   const index=center+i-size/2;
   let sample=0;
   if(index>=0&&index<audioBuffer.length){for(let ch=0;ch<channelCount;ch++)sample+=channels[ch][index]||0;sample/=channelCount;}
   const window=.5-.5*Math.cos(2*Math.PI*i/(size-1));
   real[i]=sample*window;
   if(i%2===0)timeData[i/2]=Math.max(0,Math.min(255,Math.round(128+sample*112)));
  }
  // FFT radix-2 para extrair a frequência real da narração sem reproduzir o áudio.
  let j=0;
  for(let i=1;i<size;i++){
   let bit=size>>1;
   while(j&bit){j^=bit;bit>>=1;}
   j^=bit;
   if(i<j){[real[i],real[j]]=[real[j],real[i]];[imag[i],imag[j]]=[imag[j],imag[i]];}
  }
  for(let length=2;length<=size;length<<=1){
   const angle=-2*Math.PI/length,stepReal=Math.cos(angle),stepImag=Math.sin(angle);
   for(let start=0;start<size;start+=length){
    let wr=1,wi=0;
    for(let k=0;k<length/2;k++){
     const even=start+k,odd=even+length/2;
     const tr=wr*real[odd]-wi*imag[odd],ti=wr*imag[odd]+wi*real[odd];
     real[odd]=real[even]-tr;imag[odd]=imag[even]-ti;
     real[even]+=tr;imag[even]+=ti;
     const nextWr=wr*stepReal-wi*stepImag;wi=wr*stepImag+wi*stepReal;wr=nextWr;
    }
   }
  }
  for(let i=0;i<bins;i++){
   const magnitude=Math.sqrt(real[i]*real[i]+imag[i]*imag[i])/size;
   frequencyData[i]=Math.max(0,Math.min(255,Math.round(magnitude*18*255)));
  }
  const analyser={
   frequencyBinCount:bins,
   getByteTimeDomainData:(target:Uint8Array)=>target.set(timeData.subarray(0,target.length)),
   getByteFrequencyData:(target:Uint8Array)=>target.set(frequencyData.subarray(0,target.length))
  };
  return analyser as unknown as AnalyserNode;
 }

 function draw(ctx:CanvasRenderingContext2D,analyser:AnalyserNode,w:number,h:number,visual:VisualStyle,time:number){
  const buffer=new Uint8Array(analyser.frequencyBinCount);analyser.getByteTimeDomainData(buffer);
  const freq=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(freq);
  ctx.fillStyle="#050b14";ctx.fillRect(0,0,w,h);
  const glow=ctx.createRadialGradient(w/2,h*.48,10,w/2,h*.48,w*.72);glow.addColorStop(0,"rgba(0,198,220,.13)");glow.addColorStop(1,"rgba(2,9,18,0)");
  ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="rgba(68,207,226,.12)";ctx.lineWidth=1;
  for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(w*i/8,0);ctx.lineTo(w*i/8,h);ctx.stroke();}
  for(let i=1;i<14;i++){ctx.beginPath();ctx.moveTo(0,h*i/14);ctx.lineTo(w,h*i/14);ctx.stroke();}
  const drawLogo=(img:HTMLImageElement|null,x:number,y:number,maxW:number,maxH:number)=>{
   if(!img||!img.complete||!img.naturalWidth)return;
   const scale=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight);
   const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
   ctx.drawImage(img,x-dw/2,y-dh/2,dw,dh);
  };
  drawLogo(neuroLogoRef.current,w*.27,h*.105,w*.28,h*.19);
  drawLogo(enatLogoRef.current,w*.73,h*.105,w*.24,h*.19);
  ctx.textAlign="center";ctx.save();ctx.shadowColor="rgba(31,226,238,.7)";ctx.shadowBlur=Math.max(12,w*.018);
  ctx.fillStyle="#a8fbff";ctx.font="700 "+Math.round(w*.034)+"px Arial";ctx.fillText("ATLAS IA",w/2,h*.225);ctx.restore();
  ctx.strokeStyle="rgba(70,221,232,.28)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w*.34,h*.275);ctx.lineTo(w*.66,h*.275);ctx.stroke();
  const cx=w/2,cy=h*.57,base=Math.min(w,h)*.17;
  if(visual==="wave"){
   ctx.beginPath();ctx.lineWidth=Math.max(2,w*.003);ctx.strokeStyle="#64edf0";ctx.shadowColor="#28dbe7";ctx.shadowBlur=18;
   for(let i=0;i<buffer.length;i++){const x=i/(buffer.length-1)*w*.82+w*.09;const y=cy+(buffer[i]-128)/128*h*.22;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();ctx.shadowBlur=0;
   ctx.beginPath();ctx.strokeStyle="rgba(71,174,224,.6)";ctx.lineWidth=1;
   for(let i=0;i<buffer.length;i++){const x=i/(buffer.length-1)*w*.82+w*.09;const y=cy+(buffer[i]-128)/128*h*.12+Math.sin(time*2+i*.04)*2;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
  }else if(visual==="equalizer"){
   const count=64,gap=w*.004,bw=(w*.78-gap*(count-1))/count;
   for(let i=0;i<count;i++){const value=freq[Math.floor(i*freq.length/count)]/255;const bh=Math.max(4,value*h*.35);const x=w*.11+i*(bw+gap);const grad=ctx.createLinearGradient(0,cy-bh,0,cy+bh);grad.addColorStop(0,"#8cfbfa");grad.addColorStop(1,"#1678b5");ctx.fillStyle=grad;ctx.shadowColor="#27cde0";ctx.shadowBlur=8;ctx.fillRect(x,cy-bh/2,bw,bh);}ctx.shadowBlur=0;
  }else{
   const count=112;ctx.save();ctx.translate(cx,cy);ctx.rotate(time/12);
   for(let i=0;i<count;i++){const angle=i/count*Math.PI*2;const value=freq[Math.floor(i*freq.length/count)]/255;const inner=base*.68;const outer=inner+base*(.15+value*.72);ctx.beginPath();ctx.moveTo(Math.cos(angle)*inner,Math.sin(angle)*inner);ctx.lineTo(Math.cos(angle)*outer,Math.sin(angle)*outer);ctx.strokeStyle=i%4===0?"#9afafa":"#28b9d3";ctx.lineWidth=Math.max(2,w*.0025);ctx.shadowColor="#23dce8";ctx.shadowBlur=10;ctx.stroke();}
   ctx.shadowBlur=0;ctx.beginPath();ctx.arc(0,0,base*.58,0,Math.PI*2);ctx.strokeStyle="rgba(100,237,240,.5)";ctx.lineWidth=2;ctx.stroke();ctx.restore();
  }
 }

 async function renderOfflineVideo(sourceUrl:string,productionMode:ProductionMode){
  if(rendering)return;
  const canvas=canvasRef.current;
  if(!canvas){setError("A área de renderização não está disponível.");return;}
  setRendering(true);setProgress(0);setError("");setStatus("Preparando renderização offline...");
  let outputInstance:import("mediabunny").Output|undefined;
  try{
   const media=await import("mediabunny");
   const bytes=await (await fetch(sourceUrl)).arrayBuffer();
   const decodeContext=new AudioContext();
   let audioBuffer:AudioBuffer;
   try{audioBuffer=await decodeContext.decodeAudioData(bytes.slice(0));}
   finally{await decodeContext.close();}
   const width=720,height=format==="vertical"?1280:405;
   canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Não foi possível preparar a tela de renderização.");
   const mp4Format=new media.Mp4OutputFormat();
   let selectedFormat:InstanceType<typeof media.Mp4OutputFormat>|InstanceType<typeof media.WebMOutputFormat>=mp4Format;
   let videoCodec=await media.getFirstEncodableVideoCodec(mp4Format.getSupportedVideoCodecs(),{width,height});
   let audioCodec=await media.getFirstEncodableAudioCodec(mp4Format.getSupportedAudioCodecs());
   let extension="mp4";
   if(!videoCodec||!audioCodec){
    const webmFormat=new media.WebMOutputFormat();
    const webmVideo=await media.getFirstEncodableVideoCodec(webmFormat.getSupportedVideoCodecs(),{width,height});
    const webmAudio=await media.getFirstEncodableAudioCodec(webmFormat.getSupportedAudioCodecs());
    if(!webmVideo||!webmAudio)throw new Error("Este navegador não oferece codificação de vídeo e áudio compatível. Atualize o Microsoft Edge e tente novamente.");
    selectedFormat=webmFormat;videoCodec=webmVideo;audioCodec=webmAudio;extension="webm";
   }
   const target=new media.BufferTarget();
   outputInstance=new media.Output({format:selectedFormat,target});
   const videoSource=new media.CanvasSource(canvas,{codec:videoCodec,quality:new media.Quality({bitrate:1_700_000})});
   const audioSource=new media.AudioBufferSource({codec:audioCodec,quality:new media.Quality({bitrate:128_000})});
   outputInstance.addVideoTrack(videoSource,{frameRate:FPS});
   outputInstance.addAudioTrack(audioSource);
   outputInstance.setMetadataTags({title:"ATLAS IA — ENAT",artist:"ENAT — Ensino Neuroeducacional Aplicado ao Trânsito"});
   await outputInstance.start();
   const audioTask=audioSource.add(audioBuffer);
   const totalFrames=Math.max(1,Math.ceil(audioBuffer.duration*FPS));
   for(let frame=0;frame<totalFrames;frame++){
    const timestamp=frame/FPS;
    const analyser=createOfflineAnalyser(audioBuffer,Math.min(timestamp,audioBuffer.duration));
    draw(ctx,analyser,width,height,style,timestamp);
    await videoSource.add(timestamp,Math.min(1/FPS,Math.max(0,audioBuffer.duration-timestamp)));
    if(frame%12===0||frame===totalFrames-1){
     const percent=Math.min(99,Math.round(((frame+1)/totalFrames)*100));
     setProgress(percent);setStatus("Renderizando sem reproduzir o áudio · "+percent+"% · quadro "+(frame+1)+" de "+totalFrames);
     await new Promise<void>(resolve=>setTimeout(resolve,0));
    }
   }
   videoSource.close();
   await audioTask;
   audioSource.close();
   setStatus("Finalizando arquivo MP4...");
   await outputInstance.finalize();
   const encoded=target.buffer;
   if(!encoded||!encoded.byteLength)throw new Error("A renderização terminou sem produzir um arquivo válido.");
   const blob=new Blob([encoded],{type:extension==="mp4"?"video/mp4":"video/webm"});
   const url=URL.createObjectURL(blob);
   clearVideo();videoUrlRef.current=url;setVideoUrl(url);setVideoExt(extension);setProgress(100);
   if(productionMode==="download"){
    const link=document.createElement("a");link.href=url;link.download="ENAT-ATLAS-video-"+Date.now()+"."+extension;
    document.body.appendChild(link);link.click();link.remove();
    setStatus("Vídeo renderizado offline e download iniciado · "+formatTime(audioBuffer.duration)+" · "+extension.toUpperCase());
   }else{
    setStatus("Pré-visualização pronta · "+formatTime(audioBuffer.duration)+". Assista ao vídeo e use Baixar vídeo quando desejar.");
   }
  }catch(e){
   setError(e instanceof Error?e.message:"Não foi possível renderizar o vídeo.");
   setStatus("");
  }finally{
   setRendering(false);
  }
 }

 async function startProduction(){
  if(busy||rendering)return;
  let currentAudio=audioUrl;
  if(!currentAudio){currentAudio=await generateAudio()||"";}
  if(!currentAudio)return;
  await renderOfflineVideo(currentAudio,mode);
 }
 function chooseStyle(next:VisualStyle){setStyle(next);clearVideo();}
 function chooseFormat(next:"vertical"|"horizontal"){setFormat(next);clearVideo();}
 function chooseMode(next:ProductionMode){setMode(next);}

 return <section className="videoStudio audioVisualStudio">
  <header className="videoStudioHeading"><div className="videoStudioIcon"><AudioLines size={25}/></div><div><span>ATLAS IA</span><h2>Estúdio de frequência sonora</h2><p>Transforme a narração em um vídeo futurista sincronizado com o áudio.</p></div></header>
  <div className="audioStudioControls">
   <label>Formato do vídeo</label><div className="videoFormat"><button type="button" className={format==="vertical"?"selected":""} onClick={()=>chooseFormat("vertical")}>Vertical · Reels</button><button type="button" className={format==="horizontal"?"selected":""} onClick={()=>chooseFormat("horizontal")}>Horizontal · YouTube</button></div>
   <label>Visualização sonora</label><div className="audioStyleChoices">
    <button type="button" className={style==="wave"?"selected":""} onClick={()=>chooseStyle("wave")}><Waves size={17}/> Onda sonora</button>
    <button type="button" className={style==="equalizer"?"selected":""} onClick={()=>chooseStyle("equalizer")}><BarChart3 size={17}/> Equalizador</button>
    <button type="button" className={style==="radial"?"selected":""} onClick={()=>chooseStyle("radial")}><CircleDot size={17}/> Espectro circular</button>
   </div>
  </div>
  <div className="audioStudioGrid">
   <div className="videoEditor">
    <div className="videoSectionTitle"><b>1. Texto para narração</b><small>{script.length.toLocaleString("pt-BR")} / {MAX_SCRIPT}</small></div>
    <textarea className="videoNarration" rows={10} maxLength={MAX_SCRIPT} value={script} onChange={e=>updateScript(e.target.value)} disabled={!scriptRestored} placeholder="Escreva ou cole o texto que o ATLAS deverá narrar..."/>\n    <div className="videoScriptSaveStatus" role="status"><span className="videoScriptSaveDot"/> {scriptSaveStatus}</div>
    <button className="videoPrimary" type="button" disabled={!script.trim()||busy||rendering} onClick={()=>void generateAudio()}>{busy?<><RefreshCw size={15} className="studioSpin"/> Gerando narração...</>:rendering?<><RefreshCw size={15} className="studioSpin"/> Renderizando vídeo...</>:<><Radio size={15}/> Gerar narração</>}</button>
    {audioUrl&&<div className="audioReady"><div className="videoSectionTitle"><b>2. Narração pronta</b><small>{formatTime(duration)}</small></div><audio className="videoAudioPreview" controls src={audioUrl}/></div>}
    <div className="videoProductionModes">
     <div className="videoSectionTitle"><b>2. Modo de produção</b><small>Escolha como deseja concluir</small></div>
     <div className="videoModeChoices">
      <button type="button" className={mode==="download"?"selected":""} aria-pressed={mode==="download"} disabled={rendering||busy} onClick={()=>chooseMode("download")}><Zap size={19}/><span><b>Gerar e baixar</b><small>Renderiza o vídeo completo em segundo plano e inicia o download ao terminar.</small></span></button>
      <button type="button" className={mode==="preview"?"selected":""} aria-pressed={mode==="preview"} disabled={rendering||busy} onClick={()=>chooseMode("preview")}><Eye size={19}/><span><b>Pré-visualizar</b><small>Gera o vídeo sem reprodução em tempo real para assistir antes de baixar.</small></span></button>
     </div>
    </div>
    <button className="videoPrimary videoStartProduction" type="button" disabled={!script.trim()||busy||rendering} onClick={startProduction}>{rendering?<><RefreshCw size={15} className="studioSpin"/> Renderizando · {progress}%</>:mode==="download"?<><Download size={15}/> Iniciar geração e baixar</>:<><Play size={15}/> Gerar pré-visualização</>}</button>
    {(rendering||progress>0)&&<div className="videoRenderProgress" role="status"><div><b>{rendering?"Renderizando vídeo offline":"Renderização concluída"}</b><strong>{progress}%</strong></div><progress value={progress} max={100}/><small>{status}</small></div>}
    <p className="videoStatus" role="status">{status}</p>{error&&<p className="studioError" role="alert">{error}</p>}
    <p className="audioDurationNote">A renderização offline não exige ouvir a narração até o fim. O tempo de processamento depende da duração, da memória e da capacidade de codificação do navegador.</p>
   </div>
   <div className="videoPreviewPanel">
    <div className={"audioVisualPreview "+format}>
     {videoUrl?<video key={videoUrl} className="videoOfflineResult" controls playsInline preload="metadata" src={videoUrl}/>:<canvas ref={canvasRef}/>}
    </div>
    {videoUrl&&<div className="videoDownloadArea"><a href={videoUrl} download={"ENAT-ATLAS-video-"+Date.now()+"."+videoExt}><Download size={16}/> Baixar vídeo ({videoExt.toUpperCase()})</a><small>{mode==="preview"?"Assista à prévia antes de baixar.":"Arquivo finalizado e pronto para salvar."}</small></div>}
    <div className="videoFreeNote">O vídeo é renderizado quadro a quadro com WebCodecs, usando a análise das frequências reais do áudio. A narração original é incorporada ao arquivo, sem precisar reproduzi-la em tempo real. Arquivos longos dependem da memória disponível no navegador.</div>
   </div>
  </div>
 </section>;
}
