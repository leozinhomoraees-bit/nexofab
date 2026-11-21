"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, CreditCard, ExternalLink, History, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BillingCycle, BillingPlanRecord, SubscriptionAccessSummary } from "@/lib/billing";

type AuditLog = {
  id: string;
  event_type: string;
  previous_status: string | null;
  next_status: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

type BillingPayload = {
  subscription: SubscriptionAccessSummary;
  currentPlan: BillingPlanRecord | null;
  plans: BillingPlanRecord[];
  usage: { activeMembers: number | null; maxUsers: number | null };
  companyReady?: { hasDocument: boolean; hasEmail: boolean };
  auditLogs: AuditLog[];
  provider: {
    id: string;
    name: string;
    environment?: "sandbox" | "production";
    checkoutEnabled: boolean;
    paymentMethods: string[];
  };
};

const cycleLabels: Record<BillingCycle, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
};

const cycleDescriptions: Record<BillingCycle, string> = {
  monthly: "Flexibilidade mês a mês sem fidelidade.",
  quarterly: "Cobrança a cada 3 meses com 14% de desconto.",
  yearly: "Cobrança anual com 31% de desconto (melhor custo-benefício).",
};

const auditLabels: Record<string, string> = {
  trial_started: "Período de teste de 7 dias iniciado",
  trial_initialized_backfill: "Período de teste de 7 dias atribuído à organização",
  checkout_created: "Cobrança gerada no Asaas",
  subscription_activated: "Assinatura ativada via pagamento confirmado",
  payment_overdue: "Pagamento em atraso registrado",
  subscription_canceled: "Assinatura cancelada",
};

function formatCurrencyCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function BillingPanel() {
  const [data, setData] = useState<BillingPayload | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("quarterly");
  const [loading, setLoading] = useState(true);
  const [submittingPlanId, setSubmittingPlanId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/gestao/assinatura", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar os dados de assinatura.");
      setData(payload as BillingPayload);
      setCheckoutUrl((payload as BillingPayload).subscription.checkoutUrl ?? null);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function startCheckout(planId: string) {
    setSubmittingPlanId(planId);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/gestao/assinatura/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingType: "UNDEFINED" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível gerar a cobrança no Asaas.");
      if (payload.checkoutUrl) {
        setCheckoutUrl(payload.checkoutUrl as string);
        setMessage("Fatura criada no Asaas! Clique no botão ao lado para concluir o pagamento por PIX, boleto ou cartão.");
      } else {
        setMessage("Assinatura criada no Asaas. Aguarde a emissão da primeira fatura ou clique em Atualizar.");
      }
      await load();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSubmittingPlanId(null);
    }
  }

  const plansForCycle = useMemo(
    () => (data?.plans ?? []).filter((plan) => plan.billing_cycle === selectedCycle),
    [data, selectedCycle],
  );

  const summary = data?.subscription;
  const activeCheckoutUrl = checkoutUrl || summary?.checkoutUrl;

  return (
    <section className="team-workspace billing-workspace">
      <header className="module-heading">
        <div>
          <small>ASSINATURA E PLANO</small>
          <h1>Plano da empresa</h1>
          <span>Acompanhe o período de teste de 7 dias, os ciclos de assinatura e o histórico da conta.</span>
        </div>
        <div className="team-heading-actions">
          {activeCheckoutUrl && (
            <Button asChild variant="outline">
              <a href={activeCheckoutUrl} target="_blank" rel="noreferrer">
                <ExternalLink />
                Abrir fatura no Asaas
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "spin" : ""} />
            {loading ? "Carregando" : "Atualizar"}
          </Button>
        </div>
      </header>

      {error && <div className="company-settings-message error">{error}</div>}
      {message && (
        <div className="billing-checkout-ready">
          <div>
            <CheckCircle2 />
            <span>{message}</span>
          </div>
          {activeCheckoutUrl && (
            <Button asChild size="sm">
              <a href={activeCheckoutUrl} target="_blank" rel="noreferrer">
                <ExternalLink />
                Abrir fatura no Asaas
              </a>
            </Button>
          )}
        </div>
      )}

      {summary?.isReadOnly && (
        <div className="billing-alert blocked">
          <AlertTriangle />
          <div>
            <b>Modo somente leitura ativo</b>
            <p>O período de teste terminou ou há pagamento pendente. Todos os seus registros continuam preservados, mas novas gravações serão liberadas após ativar a assinatura.</p>
          </div>
        </div>
      )}

      {data?.companyReady && !data.companyReady.hasDocument && (
        <div className="billing-banner warning">
          <span>
            <strong>CPF ou CNPJ necessário para emitir cobrança:</strong> preencha o documento em <strong>Gestão → Minha empresa</strong> antes de gerar a fatura no Asaas.
          </span>
        </div>
      )}

      <div className="team-summary billing-summary">
        <article>
          <ShieldCheck />
          <div>
            <small>SITUAÇÃO ATUAL</small>
            <b>{summary?.label ?? "Carregando..."}</b>
          </div>
        </article>
        <article>
          <CalendarClock />
          <div>
            <small>{summary?.status === "trialing" ? "FIM DO TESTE GRÁTIS" : "VIGÊNCIA ATUAL"}</small>
            <b>{formatDate(summary?.endsAt ?? null)}</b>
          </div>
        </article>
        <article>
          <Users />
          <div>
            <small>USUÁRIOS ATIVOS</small>
            <b>
              {data?.usage.activeMembers ?? "—"}
              {data?.usage.maxUsers ? ` / ${data.usage.maxUsers}` : ""}
            </b>
          </div>
        </article>
      </div>

      <section className="team-card billing-plans-card">
        <header>
          <div>
            <small>CICLOS DISPONÍVEIS {data?.provider.environment === "sandbox" ? "· SANDBOX" : ""}</small>
            <h2>Plano Completo · Mensal, Trimestral ou Anual</h2>
          </div>
          <div className="billing-cycle-tabs" role="tablist" aria-label="Ciclo de cobrança">
            {(["monthly", "quarterly", "yearly"] as BillingCycle[]).map((cycle) => (
              <button
                key={cycle}
                type="button"
                role="tab"
                aria-selected={selectedCycle === cycle}
                className={selectedCycle === cycle ? "active" : ""}
                onClick={() => setSelectedCycle(cycle)}
              >
                {cycleLabels[cycle]}
              </button>
            ))}
          </div>
        </header>

        <div className="billing-plans-body">
          <p className="billing-cycle-note">
            <Sparkles />
            <span>
              <strong>{cycleLabels[selectedCycle]}:</strong> {cycleDescriptions[selectedCycle]} Pagamento seguro via{" "}
              <strong>{data?.provider.name ?? "Asaas"}</strong>: {(data?.provider.paymentMethods ?? ["PIX", "Boleto bancário", "Cartão de crédito"]).join(", ")}.
            </span>
          </p>

          {plansForCycle.length > 0 ? (
            <div className="billing-plan-grid">
              {plansForCycle.map((plan) => {
                const isSubmitting = submittingPlanId === plan.id;
                return (
                  <article key={plan.id} className="billing-plan-option">
                    <div className="billing-plan-head">
                      <h3>{plan.name}</h3>
                      {plan.discount_percent > 0 && <span className="billing-discount-badge">-{plan.discount_percent}%</span>}
                    </div>
                    {plan.description && <p>{plan.description}</p>}
                    <div className="billing-price-line">
                      <strong>{formatCurrencyCents(plan.price_cents)}</strong>
                      <small>
                        / {plan.billing_cycle === "monthly" ? "mês" : plan.billing_cycle === "quarterly" ? "trimestre" : "ano"}
                      </small>
                    </div>
                    {plan.billing_cycle !== "monthly" && plan.monthly_price_cents > 0 && (
                      <small className="billing-monthly-equiv">Equivalente a {formatCurrencyCents(plan.monthly_price_cents)}/mês · até {plan.entitlements?.max_users ?? 10} usuários</small>
                    )}
                    {plan.billing_cycle === "monthly" && (
                      <small className="billing-monthly-equiv">Inclui até {plan.entitlements?.max_users ?? 10} usuários ativos</small>
                    )}
                    <Button
                      type="button"
                      disabled={!data?.provider.checkoutEnabled || Boolean(submittingPlanId)}
                      onClick={() => void startCheckout(plan.id)}
                    >
                      {isSubmitting ? <LoaderCircle className="spin" /> : <CreditCard />}
                      {isSubmitting
                        ? "Gerando fatura..."
                        : data?.provider.checkoutEnabled
                          ? "Assinar com Asaas"
                          : "Configure ASAAS_API_KEY no servidor"}
                    </Button>
                    {activeCheckoutUrl && (
                      <Button asChild variant="outline">
                        <a href={activeCheckoutUrl} target="_blank" rel="noreferrer">
                          <ExternalLink />
                          Abrir fatura gerada no Asaas
                        </a>
                      </Button>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="billing-empty-plans">
              <CheckCircle2 />
              <div>
                <b>Oferta comercial em preparação</b>
                <p>
                  Aplique a migration de planos e configure as credenciais do Asaas para liberar a contratação dos ciclos{" "}
                  <strong>Mensal</strong>, <strong>Trimestral</strong> e <strong>Anual</strong>.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="team-card">
        <header>
          <div>
            <small>AUDITORIA</small>
            <h2>Histórico da assinatura</h2>
          </div>
          <History />
        </header>
        <div className="invitation-list">
          {(data?.auditLogs ?? []).map((entry) => (
            <article key={entry.id}>
              <div>
                <b>{auditLabels[entry.event_type] ?? entry.event_type}</b>
                <small>{new Date(entry.created_at).toLocaleString("pt-BR")}</small>
              </div>
              {entry.next_status && <span className={entry.next_status === "active" || entry.next_status === "trialing" ? "accepted" : "pending"}>{entry.next_status}</span>}
            </article>
          ))}
          {!(data?.auditLogs ?? []).length && !loading && <p>Nenhum evento de assinatura registrado ainda.</p>}
        </div>
      </section>
    </section>
  );
}
