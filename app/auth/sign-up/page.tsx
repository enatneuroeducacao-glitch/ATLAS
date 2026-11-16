"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

export default function SignUpPage() {
  const router = useRouter();
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [code,setCode]=useState("");
  const [step,setStep]=useState<"signup"|"verify">("signup");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  async function submit(event:FormEvent){
    event.preventDefault();setError("");setMessage("");setBusy(true);
    try {
      const result=await authClient.signUp.email({name,email,password});
      if(result.error) throw new Error(result.error.message||"Não foi possível criar a conta.");
      if(result.data?.user && !result.data.user.emailVerified) {
        const otpResult = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
        if (otpResult.error) throw new Error(otpResult.error.message || "Conta criada, mas não foi possível enviar o código de confirmação.");
        setStep("verify");
        setMessage("O Neon Auth enviou um código de confirmação para seu e-mail. O ATLAS não envia essa mensagem. Confira também a pasta de spam.");
      } else {
        router.replace("/");
        router.refresh();
      }
    } catch(e){setError(e instanceof Error?e.message:"Falha ao cadastrar.");}
    finally{setBusy(false);}
  }

  async function verify(event:FormEvent){
    event.preventDefault();setError("");setMessage("");setBusy(true);
    try {
      const result=await authClient.emailOtp.verifyEmail({email,otp:code});
      if(result.error) throw new Error(result.error.message||"Código inválido ou expirado.");
      setStep("signup");
      setPassword("");
      setCode("");
      setMessage("E-mail confirmado com sucesso. Agora entre com seu e-mail e senha.");
    } catch(e){setError(e instanceof Error?e.message:"Não foi possível confirmar o e-mail.");}
    finally{setBusy(false);}
  }

  async function resend(){
    setError("");setMessage("");setBusy(true);
    try {
      const result=await authClient.emailOtp.sendVerificationOtp({email,type:"email-verification"});
      if(result.error) throw new Error(result.error.message||"Não foi possível reenviar o código.");
      setMessage("O reenvio foi solicitado ao Neon Auth. Confira sua caixa de entrada e a pasta de spam.");
    } catch(e){setError(e instanceof Error?e.message:"Falha ao reenviar o código.");}
    finally{setBusy(false);}
  }

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#07111f",color:"#eaf2ff",padding:24}}>
    <section style={{width:"min(100%,420px)",background:"#101e30",border:"1px solid #263a53",borderRadius:20,padding:32}}>
      <div style={{fontSize:12,letterSpacing:3,color:"#8ba9c9",fontWeight:700}}>ENAT · INSTRUTOR INTELIGENTE</div>
      <h1 style={{fontSize:30,margin:"12px 0 6px"}}>{step==="verify"?"Confirmar e-mail":"Criar conta"}</h1>
      <p style={{color:"#a9bbd0",marginBottom:16}}>{step==="verify"?`Informe o código enviado para ${email}.`:"Cadastre-se para acessar o ATLAS."}</p>
      {step==="signup"&&<div role="note" style={{padding:12,marginBottom:16,borderRadius:10,border:"1px solid #36516e",background:"#0b1a2b",color:"#c5d8ec",fontSize:13,lineHeight:1.5}}>
        <strong style={{color:"#9dd6ff"}}>Aviso sobre a confirmação:</strong> após o cadastro, o código de autenticação será enviado pelo <strong>Neon Auth</strong> ao e-mail informado. A mensagem de confirmação não será enviada pelo ATLAS. Verifique também a pasta de spam ou lixo eletrônico.
      </div>}
      {step==="verify"&&<div role="note" style={{padding:12,marginBottom:16,borderRadius:10,border:"1px solid #36516e",background:"#0b1a2b",color:"#c5d8ec",fontSize:13,lineHeight:1.5}}>
        <strong style={{color:"#9dd6ff"}}>Quem enviou o código?</strong> O código foi enviado pelo serviço de autenticação <strong>Neon Auth</strong>, e não pelo ATLAS. O remetente pode aparecer como <strong>Neon Auth (auth@mail.myneon.app)</strong>. Se não encontrar a mensagem, confira o spam ou lixo eletrônico.
      </div>}
      {step==="signup"?<form onSubmit={submit} style={{display:"grid",gap:12}}>
        <label style={{display:"grid",gap:6}}>Nome<input required value={name} onChange={e=>setName(e.target.value)} style={field}/></label>
        <label style={{display:"grid",gap:6}}>E-mail<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} style={field}/></label>
        <label style={{display:"grid",gap:6}}>Senha<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label>
        {error&&<p role="alert" style={{color:"#ff9c9c",fontSize:14}}>{error}</p>}
        {message&&<p role="status" style={{color:"#9dd6ff",fontSize:14}}>{message}</p>}
        <button disabled={busy} style={primary}>{busy?"Criando conta…":"Cadastrar"}</button>
      </form>:<form onSubmit={verify} style={{display:"grid",gap:12}}>
        <label style={{display:"grid",gap:6}}>Código de confirmação<input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={e=>setCode(e.target.value)} style={field}/></label>
        {error&&<p role="alert" style={{color:"#ff9c9c",fontSize:14}}>{error}</p>}
        {message&&<p role="status" style={{color:"#9dd6ff",fontSize:14}}>{message}</p>}
        <button disabled={busy} style={primary}>{busy?"Confirmando…":"Confirmar e-mail"}</button>
        <button type="button" disabled={busy} onClick={resend} style={secondary}>Reenviar código</button>
      </form>}
      <p style={{marginTop:22,fontSize:14,color:"#a9bbd0"}}>Já tem conta? <Link href="/auth/sign-in" style={{color:"#7dc4ff"}}>Entrar</Link></p>
    </section>
  </main>;
}
const field={width:"100%",padding:"12px 14px",borderRadius:10,border:"1px solid #3a506b",background:"#0b1726",color:"#fff",outline:"none"} as const;
const primary={padding:13,border:0,borderRadius:10,background:"#2477c8",color:"#fff",fontWeight:700,cursor:"pointer"} as const;
const secondary={...primary,background:"#172b42",border:"1px solid #405875"} as const;
