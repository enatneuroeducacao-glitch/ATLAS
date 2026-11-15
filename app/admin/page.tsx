import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const user = session.user as typeof session.user & { role?: string };
  if (user.role !== "admin") {
    return (
      <main style={{ minHeight: "100vh", background: "#0b1220", color: "#e5edf8", padding: "48px 24px", fontFamily: "Arial, sans-serif" }}>
        <section style={{ maxWidth: 720, margin: "0 auto", border: "1px solid #334155", borderRadius: 16, padding: 32, background: "#111c2e" }}>
          <p style={{ color: "#fca5a5", fontWeight: 700 }}>ACESSO NEGADO · 403</p>
          <h1 style={{ fontSize: 28, margin: "12px 0" }}>Área administrativa do ATLAS</h1>
          <p>Sua conta não possui o papel administrativo necessário para acessar esta área.</p>
          <a href="/" style={{ display: "inline-block", marginTop: 24, color: "#93c5fd" }}>Voltar ao ATLAS</a>
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0b1220", color: "#e5edf8", padding: "48px 24px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap", marginBottom: 32 }}>
          <div>
            <p style={{ color: "#93c5fd", fontWeight: 700, letterSpacing: 2 }}>ATLAS II · CONTROLE</p>
            <h1 style={{ fontSize: 32, margin: "8px 0" }}>Painel administrativo</h1>
            <p style={{ color: "#94a3b8" }}>Área restrita a contas com papel administrativo.</p>
          </div>
          <a href="/" style={{ color: "#bfdbfe", border: "1px solid #475569", borderRadius: 10, padding: "10px 14px", textDecoration: "none" }}>Voltar ao ATLAS</a>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <article style={{ background: "#111c2e", border: "1px solid #334155", borderRadius: 14, padding: 22 }}>
            <p style={{ color: "#94a3b8", margin: 0 }}>SESSÃO ADMINISTRATIVA</p>
            <h2 style={{ fontSize: 22, margin: "12px 0 6px" }}>{user.name || "Administrador"}</h2>
            <p style={{ color: "#cbd5e1", overflowWrap: "anywhere" }}>{user.email}</p>
            <p style={{ color: "#86efac", fontWeight: 700 }}>Papel: ADMIN</p>
          </article>
          <article style={{ background: "#111c2e", border: "1px solid #334155", borderRadius: 14, padding: 22 }}>
            <p style={{ color: "#94a3b8", margin: 0 }}>SEGURANÇA</p>
            <h2 style={{ fontSize: 22, margin: "12px 0" }}>Verificação no servidor</h2>
            <p style={{ color: "#cbd5e1" }}>A autorização é validada no servidor a cada carregamento. Ocultar um botão no navegador não concede acesso administrativo.</p>
          </article>
        </section>

        <section style={{ marginTop: 20, background: "#111c2e", border: "1px solid #475569", borderRadius: 14, padding: 24 }}>
          <h2 style={{ fontSize: 22, marginTop: 0 }}>Gestão de usuários</h2>
          <p style={{ color: "#cbd5e1", lineHeight: 1.7 }}>A área está reservada, mas as operações de listar contas, bloquear, desbloquear e alterar papéis ainda não foram ativadas. O Neon Auth gerenciado usado pelo ATLAS não permite adicionar o plugin administrativo personalizado pelo código do aplicativo. Essas operações só serão liberadas quando houver uma integração administrativa suportada, sem expor credenciais privilegiadas ao navegador.</p>
          <p style={{ color: "#fbbf24", fontWeight: 700, marginBottom: 0 }}>Status: estrutura protegida; gestão de contas pendente de integração segura.</p>
        </section>
      </div>
    </main>
  );
}
