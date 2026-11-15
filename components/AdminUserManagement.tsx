"use client";

import { useCallback, useEffect, useState } from "react";

type AdminUser = {
  id: string;
  name?: string | null;
  email: string;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  createdAt?: string | null;
};

type ListUsersResponse = {
  users?: AdminUser[];
  total?: number;
  limit?: number;
  offset?: number;
};

const PAGE_SIZE = 20;

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/auth/admin/${path}`, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init?.headers || {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Falha na operação (HTTP ${response.status}).`);
  }
  return payload as T;
}

export default function AdminUserManagement({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadUsers = useCallback(async (nextOffset = 0, term = activeSearch) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
      if (term.trim()) {
        params.set("searchValue", term.trim());
        params.set("searchField", "email");
        params.set("searchOperator", "contains");
      }
      const result = await adminRequest<ListUsersResponse>(`list-users?${params.toString()}`);
      setUsers(Array.isArray(result.users) ? result.users : []);
      setTotal(Number(result.total || 0));
      setOffset(nextOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }, [activeSearch]);

  useEffect(() => {
    void loadUsers(0, "");
  }, [loadUsers]);

  async function changeRole(user: AdminUser, role: "user" | "admin") {
    if (user.id === currentUserId) return;
    const action = role === "admin" ? "promover" : "retirar o papel administrativo de";
    if (!window.confirm(`Confirma ${action} ${user.email}?`)) return;
    setBusyUserId(user.id);
    setMessage("");
    setError("");
    try {
      await adminRequest("set-role", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, role }),
      });
      setMessage(`Papel atualizado para ${user.email}.`);
      await loadUsers(offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar o papel.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function toggleBan(user: AdminUser) {
    if (user.id === currentUserId) return;
    const banning = !user.banned;
    const action = banning ? "bloquear" : "desbloquear";
    if (!window.confirm(`Confirma ${action} a conta ${user.email}?`)) return;
    setBusyUserId(user.id);
    setMessage("");
    setError("");
    try {
      await adminRequest(banning ? "ban-user" : "unban-user", {
        method: "POST",
        body: JSON.stringify(banning
          ? { userId: user.id, banReason: "Bloqueio realizado pela administração do ATLAS" }
          : { userId: user.id }),
      });
      setMessage(`Conta de ${user.email} ${banning ? "bloqueada" : "desbloqueada"}.`);
      await loadUsers(offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar o status da conta.");
    } finally {
      setBusyUserId(null);
    }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveSearch(search.trim());
    void loadUsers(0, search.trim());
  }

  return (
    <section style={{ marginTop: 20, background: "#111c2e", border: "1px solid #475569", borderRadius: 14, padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 22, margin: 0 }}>Gestão de usuários</h2>
          <p style={{ color: "#94a3b8", marginBottom: 0 }}>Contas cadastradas no Neon Auth · {total} registro(s)</p>
        </div>
        <button type="button" onClick={() => void loadUsers(offset)} disabled={loading} style={buttonStyle}>
          Atualizar lista
        </button>
      </div>

      <form onSubmit={submitSearch} style={{ display: "flex", gap: 8, margin: "20px 0", flexWrap: "wrap" }}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar por e-mail" aria-label="Pesquisar usuários por e-mail" style={{ flex: "1 1 240px", minWidth: 0, padding: "11px 12px", borderRadius: 9, border: "1px solid #475569", background: "#0b1220", color: "#e5edf8" }} />
        <button type="submit" disabled={loading} style={buttonStyle}>Pesquisar</button>
      </form>

      {message && <p role="status" style={{ color: "#86efac" }}>{message}</p>}
      {error && <p role="alert" style={{ color: "#fca5a5" }}>{error}</p>}

      {loading ? <p style={{ color: "#cbd5e1" }}>Carregando usuários...</p> : users.length === 0 ? (
        <p style={{ color: "#cbd5e1" }}>Nenhum usuário encontrado.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650, fontSize: 14 }}>
            <thead>
              <tr style={{ color: "#94a3b8", textAlign: "left" }}>
                <th style={cellStyle}>Usuário</th>
                <th style={cellStyle}>Papel</th>
                <th style={cellStyle}>Situação</th>
                <th style={cellStyle}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                const busy = busyUserId === user.id;
                const isAdmin = (user.role || "").split(",").includes("admin");
                return (
                  <tr key={user.id} style={{ borderTop: "1px solid #334155" }}>
                    <td style={cellStyle}>
                      <strong>{user.name || "Sem nome"}</strong>
                      <div style={{ color: "#94a3b8", overflowWrap: "anywhere" }}>{user.email}</div>
                      {isSelf && <small style={{ color: "#93c5fd" }}>Sua conta</small>}
                    </td>
                    <td style={cellStyle}>{isAdmin ? "Administrador" : "Usuário"}</td>
                    <td style={cellStyle}>
                      <span style={{ color: user.banned ? "#fca5a5" : "#86efac" }}>{user.banned ? "Bloqueado" : "Ativo"}</span>
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button type="button" disabled={isSelf || busy} onClick={() => void changeRole(user, isAdmin ? "user" : "admin")} style={smallButtonStyle}>
                          {isAdmin ? "Retirar admin" : "Tornar admin"}
                        </button>
                        <button type="button" disabled={isSelf || busy} onClick={() => void toggleBan(user)} style={smallButtonStyle}>
                          {user.banned ? "Desbloquear" : "Bloquear"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, gap: 12 }}>
        <span style={{ color: "#94a3b8", fontSize: 13 }}>Exibindo {users.length ? offset + 1 : 0}–{Math.min(offset + users.length, total)} de {total}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" disabled={loading || offset === 0} onClick={() => void loadUsers(Math.max(0, offset - PAGE_SIZE))} style={buttonStyle}>Anterior</button>
          <button type="button" disabled={loading || offset + PAGE_SIZE >= total} onClick={() => void loadUsers(offset + PAGE_SIZE)} style={buttonStyle}>Próxima</button>
        </div>
      </div>
      <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6, marginBottom: 0 }}>
        Por segurança, não é permitido alterar ou bloquear a própria conta nesta tela. O Neon Auth valida novamente o papel administrativo em cada operação.
      </p>
    </section>
  );
}

const buttonStyle: React.CSSProperties = {
  border: "1px solid #45617f", borderRadius: 8, padding: "9px 12px",
  background: "#1a3551", color: "#fff", cursor: "pointer",
};

const smallButtonStyle: React.CSSProperties = {
  ...buttonStyle, padding: "7px 9px", fontSize: 12,
};

const cellStyle: React.CSSProperties = {
  padding: "12px 10px", verticalAlign: "top",
};
