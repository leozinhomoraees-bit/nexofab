import type { SupabaseClient } from "@supabase/supabase-js";

export type BillingCycle = "monthly" | "quarterly" | "yearly";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "suspended";

export type PlanEntitlements = {
  max_users?: number | null;
  max_monthly_quotes?: number | null;
  features?: string[];
};

export type BillingPlanRecord = {
  id: string;
  name: string;
  description: string | null;
  billing_cycle: BillingCycle;
  price_cents: number;
  monthly_price_cents: number;
  discount_percent: number;
  sort_order: number;
  entitlements: PlanEntitlements;
  active: boolean;
};

export type OrganizationSubscriptionRecord = {
  organization_id: string;
  plan_id: string | null;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle | null;
  provider: string | null;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  grace_until: string | null;
  cancel_at_period_end: boolean;
  provider_checkout_url: string | null;
  updated_at: string;
};

export type SubscriptionAccessSummary = {
  status: SubscriptionStatus | "missing";
  effectiveStatus: "trialing" | "active" | "past_due" | "trial_expired" | "canceled" | "suspended" | "missing";
  canWrite: boolean;
  isReadOnly: boolean;
  daysRemaining: number | null;
  endsAt: string | null;
  planId: string | null;
  billingCycle: BillingCycle | null;
  provider: string | null;
  checkoutUrl: string | null;
  label: string;
  tone: "ok" | "warning" | "blocked";
};

const DAY_MS = 24 * 60 * 60 * 1000;

function remainingDays(isoDate: string | null | undefined, nowMs: number) {
  if (!isoDate) return null;
  const target = Date.parse(isoDate);
  if (Number.isNaN(target)) return null;
  return Math.max(0, Math.ceil((target - nowMs) / DAY_MS));
}

export function evaluateSubscription(
  subscription: OrganizationSubscriptionRecord | null,
  now = new Date(),
): SubscriptionAccessSummary {
  const nowMs = now.getTime();
  if (!subscription) {
    return {
      status: "missing",
      effectiveStatus: "missing",
      canWrite: false,
      isReadOnly: true,
      daysRemaining: 0,
      endsAt: null,
      planId: null,
      billingCycle: null,
      provider: "asaas",
      checkoutUrl: null,
      label: "Assinatura pendente",
      tone: "blocked",
    };
  }

  if (subscription.status === "active") {
    const endsMs = subscription.current_period_ends_at ? Date.parse(subscription.current_period_ends_at) : null;
    const isStillValid = endsMs === null || Number.isNaN(endsMs) || endsMs > nowMs;
    const days = remainingDays(subscription.current_period_ends_at, nowMs);
    return {
      status: "active",
      effectiveStatus: isStillValid ? "active" : "past_due",
      canWrite: isStillValid,
      isReadOnly: !isStillValid,
      daysRemaining: days,
      endsAt: subscription.current_period_ends_at,
      planId: subscription.plan_id,
      billingCycle: subscription.billing_cycle,
      provider: subscription.provider,
      checkoutUrl: subscription.provider_checkout_url,
      label: isStillValid ? "Assinatura ativa" : "Renovação pendente",
      tone: isStillValid ? "ok" : "blocked",
    };
  }

  if (subscription.status === "trialing") {
    const endsMs = subscription.trial_ends_at ? Date.parse(subscription.trial_ends_at) : 0;
    const isTrialActive = endsMs > nowMs;
    const days = remainingDays(subscription.trial_ends_at, nowMs);
    return {
      status: "trialing",
      effectiveStatus: isTrialActive ? "trialing" : "trial_expired",
      canWrite: isTrialActive,
      isReadOnly: !isTrialActive,
      daysRemaining: days,
      endsAt: subscription.trial_ends_at,
      planId: subscription.plan_id,
      billingCycle: subscription.billing_cycle,
      provider: subscription.provider,
      checkoutUrl: subscription.provider_checkout_url,
      label: isTrialActive
        ? days === 1
          ? "Teste grátis · último dia"
          : `Teste grátis · ${days ?? 0} dias restantes`
        : "Período de teste encerrado",
      tone: isTrialActive ? (days !== null && days <= 2 ? "warning" : "ok") : "blocked",
    };
  }

  if (subscription.status === "past_due") {
    const graceMs = subscription.grace_until ? Date.parse(subscription.grace_until) : 0;
    const inGrace = graceMs > nowMs;
    const days = remainingDays(subscription.grace_until, nowMs);
    return {
      status: "past_due",
      effectiveStatus: "past_due",
      canWrite: inGrace,
      isReadOnly: !inGrace,
      daysRemaining: days,
      endsAt: subscription.grace_until ?? subscription.current_period_ends_at,
      planId: subscription.plan_id,
      billingCycle: subscription.billing_cycle,
      provider: subscription.provider,
      checkoutUrl: subscription.provider_checkout_url,
      label: inGrace ? "Pagamento em atraso (período de carência)" : "Pagamento pendente · modo leitura",
      tone: inGrace ? "warning" : "blocked",
    };
  }

  const canceled = subscription.status === "canceled";
  return {
    status: subscription.status,
    effectiveStatus: canceled ? "canceled" : "suspended",
    canWrite: false,
    isReadOnly: true,
    daysRemaining: 0,
    endsAt: subscription.current_period_ends_at ?? subscription.trial_ends_at,
    planId: subscription.plan_id,
    billingCycle: subscription.billing_cycle,
    provider: subscription.provider,
    checkoutUrl: subscription.provider_checkout_url,
    label: canceled ? "Assinatura cancelada · modo leitura" : "Assinatura suspensa · modo leitura",
    tone: "blocked",
  };
}

export async function getOrganizationSubscriptionSummary(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ record: OrganizationSubscriptionRecord | null; summary: SubscriptionAccessSummary }> {
  const { data } = await supabase
    .from("organization_subscriptions")
    .select("organization_id, plan_id, status, billing_cycle, provider, trial_ends_at, current_period_ends_at, grace_until, cancel_at_period_end, provider_checkout_url, updated_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const record = (data as OrganizationSubscriptionRecord | null) ?? null;
  return { record, summary: evaluateSubscription(record) };
}

export function subscriptionBlockedResponse(summary: SubscriptionAccessSummary) {
  const message = summary.effectiveStatus === "trial_expired"
    ? "Seu período de teste de 7 dias terminou. A empresa está em modo somente leitura até a ativação de um plano em Gestão → Assinatura."
    : "Sua assinatura precisa ser regularizada para criar ou alterar registros. Seus dados continuam seguros em modo leitura em Gestão → Assinatura.";
  return Response.json({ error: message, code: "SUBSCRIPTION_REQUIRED", subscription: summary }, { status: 402 });
}
