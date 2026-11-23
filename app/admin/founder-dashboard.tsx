"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarPlus,
  Check,
  Clock3,
  CreditCard,
  Download,
  ExternalLink,
  Globe,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv } from "@/lib/csv-export";

export type FounderOrganizationRow = {
  id: string;
  tradeName: string;
  publicSlug: string | null;
  publicPortalEnabled: boolean;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  activeMembers: number;
  quotesCount: number;
  customersCount: number;
  ordersCount: number;
  subscription: {
    status: string;
    planId: string | null;
    planName: string | null;
    billingCycle: string | null;
    monthlyPriceCents: number;
    trialEndsAt: string | null;
    currentPeriodEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    provider: string | null;
    hasActiveAccess: boolean;
  };
};

export type FounderDashboardData = {
  generatedAt: string;
  kpis: {
    totalOrganizations: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    expiringTrials48h: number;
    pastDueSubscriptions: number;
    expiredOrCanceled: number;
    mrrCents: number;
    arrCents: number;
    activePortals: number;
    newOrgs7d: number;
    newOrgs30d: number;
    confirmedUsers: number;
  };
  organizations: FounderOrganizationRow[];
  recentWebhooks: Array<{
    id: string;
    provider: string;
    providerEventId: string;
    eventType: string;
    organizationId: string | null;
    organizationName: string | null;
    processedAt: string | null;
    createdAt: string;
  }>;
  recentAuditLogs: Array<{
    id: string;
    organizationId: string;
    organizationName: string | null;
    eventType: string;
    previousStatus: string | null;
    nextStatus: string | null;
    createdAt: string;
  }>;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
const brDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

const cycleLabel: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
};

const statusLabel: Record<string, string> = {
  active: "Ativa",
  trialing: "Em trial",
  past_due: "Inadimplente",
  canceled: "Cancelada",
  suspended: "Suspensa",
  expired: "Expirada",
};

const auditLabel: Record<string, string> = {
  trial_started: "Trial iniciado",
  trial_initialized_backfill: "Trial inicial (backfill)",
  checkout_created: "Checkout Asaas gerado",
  subscription_cancel_requested: "Cancelamento solicitado",
  founder_trial_extended: "Trial estendido pelo fundador",
};

export function FounderDashboard({
  founderEmail,
  initialData,
}: {
  founderEmail: string;
  initialData: FounderDashboardData;
}) {
  const [data, setData] = useState<FounderDashboardData>(initialData);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "trialing" | "expiring48h" | "attention">("all");
  const [extendingOrg, setExtendingOrg] = useState<FounderOrganizationRow | null>(null);
  const [extraDays, setExtraDays] = useState("7");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const referenceMs = useMemo(() => new Date(data.generatedAt).getTime(), [data.generatedAt]);

  const isExpiring48h = useCallback(
    (org: FounderOrganizationRow) => {
      if (org.subscription.status !== "trialing" || !org.subscription.trialEndsAt) return false;
      const endsMs = new Date(org.subscription.trialEndsAt).getTime();
      return endsMs > referenceMs && endsMs <= referenceMs + 48 * 60 * 60 * 1000;
    },
    [referenceMs],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/founder", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar.");
      setData(payload.dashboard as FounderDashboardData);
    } catch (caught) {
      setFeedback({ kind: "error", text: (caught as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  const visibleOrgs = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return data.organizations.filter((org) => {
      const matchesFilter =
        filter === "all"
        || (filter === "active" && org.subscription.status === "active" && org.subscription.hasActiveAccess)
        || (filter === "trialing" && org.subscription.status === "trialing" && org.subscription.hasActiveAccess)
        || (filter === "expiring48h" && isExpiring48h(org))
        || (filter === "attention" && (!org.subscription.hasActiveAccess || org.subscription.status === "past_due"));
      if (!matchesFilter) return false;
      if (!query) return true;
      const haystack = `${org.tradeName} ${org.ownerName ?? ""} ${org.ownerEmail ?? ""} ${org.publicSlug ?? ""}`.toLocaleLowerCase("pt-BR");
      return haystack.includes(query);
    });
  }, [data.organizations, filter, isExpiring48h, search]);

  async function submitExtendTrial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!extendingOrg) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/founder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extend_trial",
          organizationId: extendingOrg.id,
          extraDays: Number.parseInt(extraDays, 10) || 7,
          reason,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível estender o trial.");
      const targetName = extendingOrg.tradeName;
      setExtendingOrg(null);
      setReason("");
      await refresh();
      setFeedback({
        kind: "success",
        text: `Trial de "${targetName}" estendido em +${extraDays} dia(s) com auditoria registrada.`,
      });
    } catch (caught) {
      setFeedback({ kind: "error", text: (caught as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  function exportOrganizationsCsv() {
    downloadCsv(
      `nexofab-empresas-${data.generatedAt.slice(0, 10)}`,
      ["Empresa", "Proprietário", "E-mail", "Status", "Plano", "Ciclo", "MRR (R$)", "Fim Trial", "Fim Período", "Membros", "Orçamentos", "Clientes", "OS", "Portal Público", "Criada em"],
      visibleOrgs.map((org) => [
        org.tradeName,
        org.ownerName ?? "",
        org.ownerEmail ?? "",
        statusLabel[org.subscription.status] ?? org.subscription.status,
        org.subscription.planName ?? "",
        org.subscription.billingCycle ? cycleLabel[org.subscription.billingCycle] ?? org.subscription.billingCycle : "",
        org.subscription.status === "active" && org.subscription.hasActiveAccess
          ? org.subscription.monthlyPriceCents / 100
          : 0,
        brDate(org.subscription.trialEndsAt),
        brDate(org.subscription.currentPeriodEndsAt),
        org.activeMembers,
        org.quotesCount,
        org.customersCount,
        org.ordersCount,
        org.publicPortalEnabled && org.publicSlug ? `/p/${org.publicSlug}` : "Desativado",
        brDate(org.createdAt),
      ]),
    );
    setFeedback({ kind: "success", text: `Exportadas ${visibleOrgs.length} empresa(s) em CSV.` });
  }

  const { kpis } = data;

  return (
    <main className="founder-page">
      <header className="founder-topbar">
        <div className="founder-brand">
          <Link href="/" className="founder-wordmark">
            <span>Nexo</span>Fab
          </Link>
          <span className="founder-role-pill">
            <ShieldCheck />
            Painel do Fundador
          </span>
        </div>
        <div className="founder-topbar-actions">
          <span className="founder-user-email">{founderEmail}</span>
          <Button variant="outline" size="sm" asChild>
            <Link href="/gestao">
              <ArrowLeft />
              Ir para Gestão
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={exportOrganizationsCsv} disabled={!visibleOrgs.length}>
            <Download />
            Exportar CSV
          </Button>
          <Button size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={loading ? "spin" : ""} />
            {loading ? "Atualizando..." : "Atualizar"}
          </Button>
        </div>
      </header>

      <div className="founder-container">
        <div className="founder-heading">
          <div>
            <small>TELEMETRIA SAAS · PRIVACIDADE PRESERVADA</small>
            <h1>Saúde do NexoFab em tempo real</h1>
            <p>
              Acompanhe receita recorrente, assinantes, trials próximos do vencimento e webhooks do Asaas sem expor dados operacionais dos clientes.
            </p>
          </div>
          <span className="founder-updated-at">Atualizado em {brDateTime(data.generatedAt)}</span>
        </div>

        {feedback && (
          <div className={`founder-feedback ${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>
            {feedback.kind === "error" ? <AlertTriangle /> : <Check />}
            <span>{feedback.text}</span>
          </div>
        )}

        <section className="founder-kpis">
          <article className="highlight">
            <div>
              <span>MRR (Receita Mensal)</span>
              <Wallet />
            </div>
            <strong>{currency.format(kpis.mrrCents / 100)}</strong>
            <small>ARR projetado: {currency.format(kpis.arrCents / 100)}/ano</small>
          </article>

          <article>
            <div>
              <span>Assinantes ativos</span>
              <CreditCard />
            </div>
            <strong>{kpis.activeSubscriptions}</strong>
            <small>Empresas pagantes com acesso ativo</small>
          </article>

          <article className={kpis.expiringTrials48h > 0 ? "warning" : ""}>
            <div>
              <span>Trials ativos</span>
              <Clock3 />
            </div>
            <strong>{kpis.trialingSubscriptions}</strong>
            <small>
              {kpis.expiringTrials48h > 0
                ? `${kpis.expiringTrials48h} vencendo nas próximas 48h`
                : "Nenhum vencendo em 48h"}
            </small>
          </article>

          <article>
            <div>
              <span>Empresas cadastradas</span>
              <Building2 />
            </div>
            <strong>{kpis.totalOrganizations}</strong>
            <small>
              +{kpis.newOrgs7d} em 7d · +{kpis.newOrgs30d} em 30d
            </small>
          </article>

          <article>
            <div>
              <span>Usuários e Portais</span>
              <Users />
            </div>
            <strong>{kpis.confirmedUsers}</strong>
            <small>{kpis.activePortals} portal(is) `/p/slug` ativo(s)</small>
          </article>

          <article className={kpis.pastDueSubscriptions > 0 ? "danger" : ""}>
            <div>
              <span>Atenção / Expiradas</span>
              <AlertTriangle />
            </div>
            <strong>{kpis.pastDueSubscriptions + kpis.expiredOrCanceled}</strong>
            <small>
              {kpis.pastDueSubscriptions} inadimplente(s) · {kpis.expiredOrCanceled} expirada(s)/cancelada(s)
            </small>
          </article>
        </section>

        <section className="founder-card">
          <header className="founder-card-head">
            <div>
              <small>BASE DE TENANTS</small>
              <h2>Empresas cadastradas ({visibleOrgs.length})</h2>
            </div>
            <div className="founder-controls">
              <label className="founder-search">
                <Search />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar empresa, dono, e-mail ou slug..."
                />
              </label>
              <div className="founder-filter-pills">
                {(
                  [
                    ["all", "Todas"],
                    ["active", "Pagantes"],
                    ["trialing", "Em trial"],
                    ["expiring48h", "Vencendo 48h"],
                    ["attention", "Expiradas"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={filter === key ? "active" : ""}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <div className="founder-table-wrap">
            <table className="founder-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Proprietário</th>
                  <th>Assinatura</th>
                  <th>Validade</th>
                  <th>Adoção (contagens)</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrgs.map((org) => {
                  const effectiveStatus =
                    org.subscription.status === "trialing" && !org.subscription.hasActiveAccess
                      ? "expired"
                      : org.subscription.status;
                  const expiringSoon = isExpiring48h(org);
                  return (
                    <tr key={org.id}>
                      <td>
                        <div className="founder-org-cell">
                          <b>{org.tradeName}</b>
                          <small>Criada em {brDate(org.createdAt)}</small>
                          {org.publicPortalEnabled && org.publicSlug && (
                            <a
                              href={`/p/${org.publicSlug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="founder-portal-link"
                            >
                              <Globe />/p/{org.publicSlug}
                              <ExternalLink />
                            </a>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="founder-org-cell">
                          <b>{org.ownerName || "Sem nome"}</b>
                          <small>{org.ownerEmail || "—"}</small>
                        </div>
                      </td>
                      <td>
                        <div className="founder-org-cell">
                          <span className={`founder-status ${effectiveStatus}`}>
                            {statusLabel[effectiveStatus] ?? effectiveStatus}
                          </span>
                          <small>
                            {org.subscription.planName
                              ? `${org.subscription.planName} · ${cycleLabel[org.subscription.billingCycle ?? ""] ?? ""}`
                              : "Sem plano pago"}
                          </small>
                          {org.subscription.cancelAtPeriodEnd && (
                            <small className="founder-cancel-note">Renovação cancelada</small>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="founder-org-cell">
                          <b>
                            {org.subscription.status === "active"
                              ? brDate(org.subscription.currentPeriodEndsAt)
                              : brDate(org.subscription.trialEndsAt)}
                          </b>
                          <small>
                            {expiringSoon
                              ? "Vence em < 48h"
                              : org.subscription.status === "active"
                                ? "Fim do período pago"
                                : "Fim do trial"}
                          </small>
                        </div>
                      </td>
                      <td>
                        <div className="founder-usage-chips">
                          <span>{org.activeMembers}/10 usuários</span>
                          <span>{org.quotesCount} orç.</span>
                          <span>{org.customersCount} cli.</span>
                          <span>{org.ordersCount} OS</span>
                        </div>
                      </td>
                      <td>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setExtendingOrg(org);
                            setExtraDays("7");
                            setReason("");
                          }}
                        >
                          <CalendarPlus />
                          Estender trial
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!visibleOrgs.length && (
                  <tr>
                    <td colSpan={6} className="founder-empty-row">
                      Nenhuma empresa encontrada neste filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="founder-telemetry-grid">
          <article className="founder-card">
            <header className="founder-card-head compact">
              <div>
                <small>BILLING ASAAS</small>
                <h2>
                  <Activity />
                  Últimos webhooks recebidos
                </h2>
              </div>
              <span className="founder-count-badge">{data.recentWebhooks.length}</span>
            </header>
            <div className="founder-log-list">
              {data.recentWebhooks.map((event) => (
                <div key={event.id} className="founder-log-item">
                  <div>
                    <b>{event.eventType}</b>
                    <small>
                      {event.organizationName || "Organização não vinculada"} · {event.providerEventId}
                    </small>
                  </div>
                  <span>
                    <em className={event.processedAt ? "ok" : "pending"}>
                      {event.processedAt ? "Processado" : "Pendente"}
                    </em>
                    <small>{brDateTime(event.createdAt)}</small>
                  </span>
                </div>
              ))}
              {!data.recentWebhooks.length && (
                <p className="founder-empty-log">Nenhum webhook do Asaas registrado ainda.</p>
              )}
            </div>
          </article>

          <article className="founder-card">
            <header className="founder-card-head compact">
              <div>
                <small>TRILHA DE SEGURANÇA</small>
                <h2>
                  <History />
                  Auditoria de assinaturas
                </h2>
              </div>
              <span className="founder-count-badge">{data.recentAuditLogs.length}</span>
            </header>
            <div className="founder-log-list">
              {data.recentAuditLogs.map((log) => (
                <div key={log.id} className="founder-log-item">
                  <div>
                    <b>{auditLabel[log.eventType] ?? log.eventType}</b>
                    <small>
                      {log.organizationName || "Empresa"} · {log.previousStatus ?? "novo"} → {log.nextStatus ?? "—"}
                    </small>
                  </div>
                  <span>
                    <small>{brDateTime(log.createdAt)}</small>
                  </span>
                </div>
              ))}
              {!data.recentAuditLogs.length && (
                <p className="founder-empty-log">Nenhum evento de auditoria registrado ainda.</p>
              )}
            </div>
          </article>
        </section>
      </div>

      {extendingOrg && (
        <div
          className="founder-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) setExtendingOrg(null);
          }}
        >
          <form
            className="founder-modal"
            role="dialog"
            aria-modal="true"
            onSubmit={submitExtendTrial}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <small>CORTESIA AUDITADA</small>
                <h2>Estender trial — {extendingOrg.tradeName}</h2>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={submitting}
                onClick={() => setExtendingOrg(null)}
              >
                <X />
              </Button>
            </header>
            <div className="founder-modal-body">
              <div className="founder-day-presets">
                {["7", "15", "30"].map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={extraDays === days ? "active" : ""}
                    onClick={() => setExtraDays(days)}
                  >
                    +{days} dias
                  </button>
                ))}
              </div>
              <label>
                Dias adicionais (1 a 90)
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={extraDays}
                  onChange={(event) => setExtraDays(event.target.value)}
                  required
                />
              </label>
              <label>
                Motivo (gravado na auditoria)
                <Input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ex.: Cliente piloto em implantação inicial"
                  maxLength={200}
                />
              </label>
            </div>
            <footer>
              <Button type="button" variant="outline" disabled={submitting} onClick={() => setExtendingOrg(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                <Check />
                {submitting ? "Salvando..." : "Confirmar extensão"}
              </Button>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
}
