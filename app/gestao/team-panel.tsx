"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, LoaderCircle, Mail, RefreshCw, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Member = { user_id: string; full_name: string; role: string; status: string; created_at: string };
type Invitation = { id: string; email: string; role: string; status: string; expires_at: string; created_at: string };
const roleLabels: Record<string, string> = { owner: "Proprietário", admin: "Administrador", comercial: "Comercial", producao: "Produção", estoque: "Estoque", financeiro: "Financeiro" };

export function TeamPanel() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/organizations/invitations", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setMembers(payload.members); setInvitations(payload.invitations);
    } catch (caught) { setError((caught as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage(""); setInviteLink("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/organizations/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), role: form.get("role") }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      const link = `${window.location.origin}/convite/${payload.invitation.token}`;
      setInviteLink(link); setMessage("Convite criado. Copie o link e envie pelo canal de sua preferência.");
      await load();
    } catch (caught) { setError((caught as Error).message); }
    finally { setSaving(false); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(inviteLink); setMessage("Link copiado."); }
    catch { setMessage("Selecione o link e copie manualmente."); }
  }

  async function revoke(invitationId: string) {
    const response = await fetch("/api/organizations/invitations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invitationId }) });
    if (!response.ok) { const payload = await response.json(); setError(payload.error); return; }
    setMessage("Convite revogado."); await load();
  }

  return <section className="team-workspace"><header className="module-heading"><div><small>EQUIPE E ACESSOS</small><h1>Pessoas da empresa</h1><span>Convide cada pessoa com uma função específica. O acesso vale somente para a empresa ativa.</span></div><div className="team-heading-actions"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""}/>{loading ? "Carregando" : "Atualizar"}</Button><Button onClick={() => { setInviteOpen(true); setInviteLink(""); setMessage(""); }}><UserPlus/>Convidar pessoa</Button></div></header>
    {error && <div className="company-settings-message error">{error}</div>}{message && <div className="company-settings-message success"><Check/>{message}</div>}
    <div className="team-summary"><article><Users/><div><small>MEMBROS ATIVOS</small><b>{members.filter((member) => member.status === "active").length}</b></div></article><article><Mail/><div><small>CONVITES PENDENTES</small><b>{invitations.filter((invitation) => invitation.status === "pending").length}</b></div></article><article><ShieldCheck/><div><small>ISOLAMENTO</small><b>Por empresa</b></div></article></div>
    <div className="team-grid"><section className="team-card"><header><div><small>MEMBROS</small><h2>Acessos atuais</h2></div><Users/></header><div className="team-list">{members.map((member) => <article key={member.user_id}><span>{member.full_name.slice(0, 1).toUpperCase()}</span><div><b>{member.full_name}</b><small>Desde {new Date(member.created_at).toLocaleDateString("pt-BR")}</small></div><strong>{roleLabels[member.role] ?? member.role}</strong></article>)}{!members.length && !loading && <p>Nenhum membro encontrado.</p>}</div></section>
      <section className="team-card"><header><div><small>CONVITES</small><h2>Links recentes</h2></div><Link2/></header><div className="invitation-list">{invitations.map((invitation) => <article key={invitation.id}><div><b>{invitation.email}</b><small>{roleLabels[invitation.role] ?? invitation.role} · expira em {new Date(invitation.expires_at).toLocaleDateString("pt-BR")}</small></div><span className={invitation.status}>{invitation.status === "pending" ? "Pendente" : "Aceito"}</span>{invitation.status === "pending" && <Button size="icon" variant="ghost" aria-label="Revogar convite" onClick={() => void revoke(invitation.id)}><X/></Button>}</article>)}{!invitations.length && !loading && <p>Nenhum convite criado.</p>}</div></section></div>
    {inviteOpen && <div className="finance-modal"><form className="payable-composer team-invite-form" onSubmit={invite}><header><div><small>NOVO ACESSO</small><h2>Convidar pessoa</h2><p>O link expira em sete dias e só funciona para o e-mail informado.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setInviteOpen(false)}><X/></Button></header><div className="form-grid"><label className="span-2">E-mail<Input name="email" type="email" required autoComplete="email" placeholder="pessoa@empresa.com.br"/></label><label className="span-2">Função<select name="role" defaultValue="comercial"><option value="admin">Administrador</option><option value="comercial">Comercial</option><option value="producao">Produção</option><option value="estoque">Estoque</option><option value="financeiro">Financeiro</option></select></label></div>{inviteLink && <label className="invite-link-field">Link único<div><Input readOnly value={inviteLink}/><Button type="button" variant="outline" onClick={() => void copyLink()}><Copy/>Copiar</Button></div></label>}<footer><Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Fechar</Button><Button type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin"/> : <UserPlus/>}{saving ? "Criando..." : "Gerar convite"}</Button></footer></form></div>}
  </section>;
}
