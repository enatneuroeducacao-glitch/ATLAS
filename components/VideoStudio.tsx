"use client";
import { useEffect, useRef, useState } from "react";
import { Film, ImagePlus, Download, RefreshCw, Video, Volume2 } from "lucide-react";

type Scene = { id:string; title:string; text:string; imageUrl:string; fileName:string };
const makeScene = (n:number):Scene => ({id:String(Date.now())+"-"+n,title:"Cena "+(n+1),text:"",imageUrl:"",fileName:""});

export default function VideoStudio(){
 const [format,setFormat]=useState<"vertical"|"horizontal">("vertical");
 const [scenes,setScenes]=useState<Scene[]>([makeScene(0)]);
 const [script,setScript]=useState(""); const [audioUrl,setAudioUrl]=useState("");
 const [videoUrl,setVideoUrl]=useState(""); const [busy,setBusy]=useState(false);
 const [recording,setRecording]=useState(false); const [error,setError]=useState(""); const [status,setStatus]=useState("");
 const audioRef=useRef<HTMLAudioElement|null>(null); const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const images=useRef<Map<string,HTMLImageElement>>(new Map());
 useEffect(()=>()=>{if(audioUrl)URL.revokeObjectURL(audioUrl);if(videoUrl)URL.revokeObjectURL(videoUrl);},[]);
 function patch(id:string,value:Partial<Scene>){setScenes(old=>old.map(s=>s.id===id?{...s,...value}:s));}
 async function addImage(id:string,file?:File){if(!file)return;if(!file.type.startsWith("image/")){setError("Selecione uma imagem.");return;}patch(id,{imageUrl:URL.createObjectURL(file),fileName:file.name});}
 async function generateAudio(){
  if(!script.trim()||busy)return;setBusy(true);setError("");setStatus("Gerando narração...");
  try{const r=await fetch("/api/tts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:script.trim()}),signal:AbortSignal.timeout(110000)});
   if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||"Falha ao gerar narração.");}
   const b=await r.blob();if(!b.type.startsWith("audio/"))throw new Error("O serviço não retornou áudio.");
   if(audioUrl)URL.revokeObjectURL(audioUrl);setAudioUrl(URL.createObjectURL(b));setStatus("Narração pronta.");
  }catch(e){setError(e instanceof Error?e.message:"Falha ao gerar áudio.");setStatus("");}finally{setBusy(false);}
 }
 function draw(ctx:CanvasRenderingContext2D,s:Scene,w:number,h:number,index:number){
  ctx.fillStyle="#08121c";ctx.fillRect(0,0,w,h);
  const img=images.current.get(s.imageUrl);
  if(img&&img.complete&&img.naturalWidth){const scale=Math.max(w/img.width,h/img.height),iw=img.width*scale,ih=img.height*scale;ctx.drawImage(img,(w-iw)/2,(h-ih)/2,iw,ih);ctx.fillStyle="rgba(3,10,18,.58)";ctx.fillRect(0,0,w,h);}
  const pad=w*.075;ctx.fillStyle="#76e7e5";ctx.fillRect(pad,h*.69,w*.12,7);ctx.fillStyle="#fff";ctx.textAlign="left";ctx.textBaseline="top";
  ctx.font="700 "+Math.round(w*.052)+"px Arial";ctx.fillText(s.title||("Cena "+(index+1)),pad,h*.74,w-pad*2);
  ctx.font="400 "+Math.round(w*.029)+"px Arial";const words=s.text.split(/\s+/);let line="",y=h*.82;
  for(const word of words){const test=line?line+" "+word:word;if(ctx.measureText(test).width>w-pad*2&&line){ctx.fillText(line,pad,y);line=word;y+=w*.042;}else line=test;}
  if(line)ctx.fillText(line,pad,y);ctx.fillStyle="#9bb4c4";ctx.font="500 "+Math.round(w*.018)+"px Arial";ctx.fillText("ATLAS II • ENAT",pad,h-pad*.7);
 }
 async function exportVideo(){
  const canvas=canvasRef.current,audio=audioRef.current;if(!canvas||!audioUrl||!audio){setError("Gere a narração antes de exportar.");return;}
  if(!("MediaRecorder" in window)||!canvas.captureStream){setError("Atualize o navegador para gravar vídeos.");return;}
  setRecording(true);setError("");setStatus("Preparando cenas...");
  try{
   for(const s of scenes){if(!s.imageUrl)continue;await new Promise<void>((resolve,reject)=>{const img=new Image();img.onload=()=>{images.current.set(s.imageUrl,img);resolve();};img.onerror=()=>reject(new Error("Falha ao carregar "+s.fileName));img.src=s.imageUrl;});}
   const w=format==="vertical"?720:1280,h=format==="vertical"?1280:720;canvas.width=w;canvas.height=h;
   const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas indisponível.");
   const videoStream=canvas.captureStream(30);const audioStream=(audio as any).captureStream?.()||(audio as any).mozCaptureStream?.();
   if(!audioStream)throw new Error("Captura de áudio não suportada neste navegador.");
   const stream=new MediaStream([...videoStream.getVideoTracks(),...audioStream.getAudioTracks()]);
   const mime=["video/mp4;codecs=h264,aac","video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus"].find(t=>MediaRecorder.isTypeSupported(t));
   if(!mime)throw new Error("Formato de vídeo não suportado.");
   const recorder=new MediaRecorder(stream,{mimeType:mime});const chunks:BlobPart[]=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   const done=new Promise<Blob>((resolve,reject)=>{recorder.onerror=()=>reject(new Error("Erro na gravação."));recorder.onstop=()=>resolve(new Blob(chunks,{type:mime}));});
   const duration=Math.max(1,Number.isFinite(audio.duration)?audio.duration:1),per=duration/scenes.length;let raf=0;
   const render=()=>{const i=Math.min(scenes.length-1,Math.floor(audio.currentTime/per));draw(ctx,scenes[i],w,h,i);if(!audio.paused&&!audio.ended)raf=requestAnimationFrame(render);};
   draw(ctx,scenes[0],w,h,0);recorder.start(250);audio.currentTime=0;await audio.play();render();setStatus("Gravando vídeo...");
   await new Promise<void>(resolve=>{audio.onended=()=>resolve();audio.onerror=()=>resolve();});cancelAnimationFrame(raf);recorder.stop();
   const blob=await done;const url=URL.createObjectURL(blob);setVideoUrl(old=>{if(old)URL.revokeObjectURL(old);return url;});
   setStatus("Vídeo pronto para baixar.");stream.getTracks().forEach(t=>t.stop());
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível exportar.");setStatus("");}finally{setRecording(false);}
 }
 const ext=videoUrl&&videoUrl.includes("mp4")?"mp4":"webm";
 return <section className="videoStudio">
  <header className="videoStudioHeading"><div className="videoStudioIcon"><Film size={24}/></div><div><span>ATLAS II / PRODUÇÃO DE CONTEÚDO</span><h2>Estúdio de vídeo</h2><p>Crie vídeos com imagens, textos e a narração atual do ATLAS, sem contratar APIs.</p></div></header>
  <div className="videoStudioToolbar"><b>Formato:</b><button className={format==="vertical"?"selected":""} onClick={()=>setFormat("vertical")} type="button">Vertical · Reels / Shorts</button><button className={format==="horizontal"?"selected":""} onClick={()=>setFormat("horizontal")} type="button">Horizontal · YouTube</button></div>
  <div className="videoStudioGrid"><div className="videoEditor">
   <div className="videoSectionTitle"><b>1. Cenas</b><small>{scenes.length} / 12</small></div>
   {scenes.map((s,i)=><article className="videoScene" key={s.id}><div className="videoSceneTop"><b>Cena {i+1}</b>{scenes.length>1&&<button type="button" onClick={()=>setScenes(old=>old.filter(x=>x.id!==s.id))}>Remover</button>}</div>
    <input value={s.title} maxLength={90} onChange={e=>patch(s.id,{title:e.target.value})} placeholder="Título da cena"/>
    <textarea value={s.text} maxLength={500} onChange={e=>patch(s.id,{text:e.target.value})} placeholder="Texto que aparecerá na tela..." rows={2}/>
    <label className="videoImagePicker"><ImagePlus size={15}/>{s.fileName||"Adicionar imagem (opcional)"}<input type="file" accept="image/*" onChange={e=>addImage(s.id,e.target.files?.[0])}/></label>
    {s.imageUrl&&<img className="videoSceneThumb" src={s.imageUrl} alt={"Imagem da cena "+(i+1)}/>}
   </article>)}
   <button className="videoAddScene" type="button" disabled={scenes.length>=12} onClick={()=>setScenes(old=>[...old,makeScene(old.length)])}>+ Adicionar cena</button>
   <div className="videoSectionTitle videoNarrationTitle"><b>2. Roteiro da narração</b><small>{script.length.toLocaleString("pt-BR")} / 10.000</small></div>
   <textarea className="videoNarration" rows={7} maxLength={10000} value={script} onChange={e=>setScript(e.target.value.slice(0,10000))} placeholder="Cole o roteiro que será narrado..."/>
   <button className="videoPrimary" type="button" disabled={!script.trim()||busy} onClick={generateAudio}>{busy?<><RefreshCw size={15} className="studioSpin"/> Gerando...</>:<><Volume2 size={15}/> Gerar narração</>}</button>
   {audioUrl&&<audio ref={audioRef} className="videoAudioPreview" controls src={audioUrl}/>}
   <p className="videoStatus" role="status">{status}</p>{error&&<p className="studioError" role="alert">{error}</p>}
   <button className="videoPrimary videoExport" type="button" disabled={!audioUrl||recording} onClick={exportVideo}>{recording?<><RefreshCw size={15} className="studioSpin"/> Montando vídeo...</>:<><Video size={15}/> Exportar vídeo</>}</button>
  </div><div className="videoPreviewPanel"><div className={"videoPreview "+format}><canvas ref={canvasRef}/>{!videoUrl&&<div className="videoPreviewPlaceholder"><Film size={30}/><b>Prévia do vídeo</b><span>O resultado será composto com suas cenas e narração.</span></div>}</div>
   {videoUrl&&<div className="videoDownloadArea"><a href={videoUrl} download={"atlas-video-"+Date.now()+"."+ext}><Download size={16}/> Baixar vídeo</a><small>O formato depende do suporte do navegador: MP4 ou WebM.</small></div>}
   <div className="videoFreeNote">Sem API de vídeo e sem custo de geração de cenas. As imagens permanecem no navegador. A narração usa o serviço de voz já existente no ATLAS. Esta versão não cria cenas cinematográficas por IA.</div>
  </div></div>
 </section>;
}
