"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

export default function ResetPasswordPage() {
  return <Suspense fallback={<main style={shell}><p style={{color:"#eaf2ff"}}>Carregando…</p></main>}><ResetPasswordForm /></Suspense>;
}

function ResetPasswordForm() {
  const router=useRouter();
  const params=useSearchParams();
  const token=params.get("token") || "";
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent) {
    event.preventDefault(); setError("");
    if(password!==confirm) { setError("As senhas não conferem."); return; }
    if(!token) { setError("Link de redefinição ausente ou inválido. Solicite um novo e-mail."); return; }
    setBusy(true);
    try {
      const result=await authClient.resetPassword({newPassword:password,token});
      if(result.error) throw new Error(result.error.message || "Não foi possível redefinir a senha.");
      router.replace("/auth/sign-in?passwordReset=success");
    } catch(e) {
      setError(e instanceof Error ? e.message : "Falha ao redefinir senha.");
    } finally { setBusy(false); }
  }
  return <main style={shell}><section style={panel}>
    <div style={eyebrow}>ENAT · INSTRUTOR INTELIGENTE</div>
    <h1 style={heading}>Criar nova senha</h1>
    <p style={muted}>Escolha uma senha com pelo menos 8 caracteres.</p>
    <form onSubmit={submit} style={form}>
      <label style={label}>Nova senha<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label>
      <label style={label}>Confirmar nova senha<input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)} style={field}/></label>
      {error&&<p role="alert" style={errorStyle}>{error}</p>}
      <button disabled={busy} style={primary}>{busy?"Salvando…":"Redefinir senha"}</button>
    </form>
    <p style={footer}><Link href="/auth/sign-in" style={link}>Voltar para entrar</Link></p>
  </section></main>;
}
const shell={minHeight:"100vh",display:"grid",placeItems:"center",background:"#07111f",color:"#eaf2ff",padding:24} as const;
const panel={width:"min(100%,420px)",background:"#101e30",border:"1px solid #263a53",borderRadius:20,padding:32,boxShadow:"0 24px 80px #0006"} as const;
const eyebrow={fontSize:12,letterSpacing:3,color:"#8ba9c9",fontWeight:700} as const;
const heading={fontSize:30,margin:"12px 0 6px"} as const;
const muted={color:"#a9bbd0",marginBottom:24,lineHeight:1.5} as const;
const form={display:"grid",gap:12} as const;
const label={display:"grid",gap:6} as const;
const field={width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid #3a506b",background:"#0b1726",color:"#fff",outline:"none"} as const;
const primary={padding:13,border:0,borderRadius:10,background:"#2477c8",color:"#fff",fontWeight:700,cursor:"pointer"} as const;
const errorStyle={color:"#ff9c9c",fontSize:14} as const;
const footer={marginTop:22,fontSize:14} as const;
const link={color:"#7dc4ff"} as const;
