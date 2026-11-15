"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message || "Não foi possível entrar.");
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao autenticar.");
    } finally { setBusy(false); }
  }


  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#07111f",color:"#eaf2ff",padding:24}}>
    <section style={{width:"min(100%,420px)",background:"#101e30",border:"1px solid #263a53",borderRadius:20,padding:32,boxShadow:"0 24px 80px #0006"}}>
      <div style={{fontSize:12,letterSpacing:3,color:"#8ba9c9",fontWeight:700}}>ENAT · INSTRUTOR INTELIGENTE</div>
      <h1 style={{fontSize:30,margin:"12px 0 6px"}}>Entrar no ATLAS</h1>
      <p style={{color:"#a9bbd0",marginBottom:24}}>Acesse seu ambiente de conhecimento e ferramentas.</p>
      <form onSubmit={submit} style={{display:"grid",gap:12}}>
        <label style={{display:"grid",gap:6}}>E-mail<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} style={field}/></label>
        <label style={{display:"grid",gap:6}}>Senha<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label>
        {error && <p role="alert" style={{color:"#ff9c9c",fontSize:14}}>{error}</p>}
        <button disabled={busy} style={primary}>{busy?"Aguarde…":"Entrar"}</button>
      </form>
      <p style={{marginTop:14,fontSize:13}}><Link href="/auth/forgot-password" style={{color:"#7dc4ff"}}>Esqueci minha senha</Link></p>
      <p style={{marginTop:22,fontSize:14,color:"#a9bbd0"}}>Ainda não tem conta? <Link href="/auth/sign-up" style={{color:"#7dc4ff"}}>Criar cadastro</Link></p>
      <p style={{marginTop:10,fontSize:12,color:"#7f94ad"}}>A autenticação é protegida pelo Neon Auth.</p>
    </section>
  </main>;
}

const field = {width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid #3a506b",background:"#0b1726",color:"#fff",outline:"none"} as const;
const primary = {padding:13,border:0,borderRadius:10,background:"#2477c8",color:"#fff",fontWeight:700,cursor:"pointer"} as const;
