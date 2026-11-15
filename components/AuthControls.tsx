"use client";

import { authClient } from "@/lib/auth/client";

export default function AuthControls() {
  const { data: session } = authClient.useSession();
  if (!session?.user) return null;
  return <div style={{position:"fixed",right:18,top:14,zIndex:50,display:"flex",alignItems:"center",gap:10,padding:"7px 10px",borderRadius:12,background:"#102238",border:"1px solid #314b68",color:"#eaf2ff",fontSize:12}}>
    <span title={session.user.email}>{session.user.name || session.user.email}</span>
    <button type="button" onClick={()=>void authClient.signOut().then(()=>{window.location.href="/auth/sign-in";})} style={{border:"1px solid #45617f",borderRadius:8,padding:"6px 9px",background:"#1a3551",color:"#fff",cursor:"pointer"}}>Sair</button>
  </div>;
}
