import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";
import {
  cancelAsaasSubscriptionIfPresent,
  createAsaasSubscription,
  ensureAsaasCustomer,
  getSubscriptionInvoiceUrl,
  isAsaasConfigured,
  isValidCpfOrCnpjLength,
  todayInSaoPaulo,
  type AsaasCycle,
} from "@/lib/asaas";
import type { BillingPlanRecord } from "@/lib/billing";

export const dynamic = "force-dynamic";

const checkoutSchema = z.object({
  planId: z.string().trim().min(2).max(80),
  billingType: z.enum(["UNDEFINED", "PIX", "BOLETO", "CREDIT_CARD"]).optional().default("UNDEFINED"),
});

const cycleToAsaas: Record<BillingPlanRecord["billing_cycle"], AsaasCycle> = {
  monthly: "MONTHLY",
  quarterly: "QUARTERLY",
  yearly: "YEARLY",
};

const cycleLabel: Record<BillingPlanRecord["billing_cycle"], string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
};

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin"]);
  if ("response" in access) return access.response;

  if (!isAsaasConfigured()) {
    return Response.json(
      { error: "A integração com o Asaas ainda não foi ativada neste ambiente." },
      { status: 503 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json({ error: "Selecione um plano e forma de pagamento válidos." }, { status: 400 });
  }

  // Lê o plano, a organização e a assinatura exclusivamente do servidor (nunca confia em valor do frontend).
  const [{ data: plan }, { data: company }, { data: currentSub }] = await Promise.all([
    access.supabase
      .from("plans")
      .select("id, name, description, billing_cycle, price_cents, monthly_price_cents, discount_percent, sort_order, entitlements, active")
      .eq("id", parsed.data.planId)
      .eq("active", true)
      .maybeSingle(),
    access.supabase
      .from("organizations")
      .select("id, trade_name, legal_name, document, email, phone, whatsapp")
      .eq("id", access.organizationId)
      .single(),
    access.supabase
      .from("organization_subscriptions")
      .select("status, provider_customer_id, provider_subscription_id")
      .eq("organization_id", access.organizationId)
      .maybeSingle(),
  ]);

  const typedPlan = plan as BillingPlanRecord | null;
  if (!typedPlan || typedPlan.price_cents <= 0) {
    return Response.json({ error: "Plano indisponível para contratação." }, { status: 404 });
  }

  if (!company || !isValidCpfOrCnpjLength(company.document)) {
    return Response.json(
      {
        error: "Informe um CPF ou CNPJ válido em Gestão → Minha empresa antes de gerar a assinatura no Asaas.",
        code: "COMPANY_DOCUMENT_REQUIRED",
      },
      { status: 400 },
    );
  }

  try {
    const customerId = await ensureAsaasCustomer({
      existingCustomerId: currentSub?.provider_customer_id ?? null,
      name: company.legal_name || company.trade_name,
      cpfCnpj: company.document!,
      email: company.email || access.user.email || null,
      phone: company.whatsapp || company.phone || null,
      externalReference: access.organizationId,
    });

    // Evita cobranças duplicadas ao trocar de ciclo ou regerar uma assinatura ainda pendente.
    if (currentSub?.provider_subscription_id && currentSub.status !== "canceled") {
      await cancelAsaasSubscriptionIfPresent(currentSub.provider_subscription_id);
    }

    const asaasSubscription = await createAsaasSubscription({
      customerId,
      billingType: parsed.data.billingType,
      value: typedPlan.price_cents / 100,
      nextDueDate: todayInSaoPaulo(),
      cycle: cycleToAsaas[typedPlan.billing_cycle],
      description: `NexoFab · ${typedPlan.name} (${cycleLabel[typedPlan.billing_cycle]})`,
      externalReference: access.organizationId,
    });

    const checkoutUrl = await getSubscriptionInvoiceUrl(asaasSubscription.id);

    const { error: saveError } = await access.supabase.rpc("save_organization_checkout", {
      p_plan_id: typedPlan.id,
      p_provider_customer_id: customerId,
      p_provider_subscription_id: asaasSubscription.id,
      p_checkout_url: checkoutUrl ?? "",
    });
    if (saveError) {
      return Response.json({ error: "A cobrança foi criada no Asaas, mas não foi possível vinculá-la à empresa." }, { status: 500 });
    }

    return Response.json(
      {
        subscriptionId: asaasSubscription.id,
        checkoutUrl,
        planId: typedPlan.id,
        billingCycle: typedPlan.billing_cycle,
        priceCents: typedPlan.price_cents,
      },
      { status: 201 },
    );
  } catch (caught) {
    console.error("Asaas checkout creation failed", caught);
    const message = caught instanceof Error ? caught.message : "Não foi possível gerar a cobrança no Asaas.";
    return Response.json({ error: message }, { status: 502 });
  }
}
