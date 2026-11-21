import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";
import { effectivePaidAmount, historicalContributionProjection, recurringValue } from "@/lib/break-even-projection";

export const dynamic = "force-dynamic";

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

const financialMonthSchema = z.object({
  month: z.string().regex(monthPattern),
  otherRevenue: z.coerce.number().min(0).max(999999999999),
  otherFixedCosts: z.coerce.number().min(0).max(999999999999),
  nonCashCosts: z.coerce.number().min(0).max(999999999999),
  otherVariableCosts: z.coerce.number().min(0).max(999999999999),
  desiredProfit: z.coerce.number().min(0).max(999999999999),
  businessDays: z.coerce.number().int().min(1).max(31),
});

export async function GET(request: Request) {
  const access = await getManagementAccess(["admin", "financeiro"]);
  if ("response" in access) return access.response;

  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!monthPattern.test(month)) return Response.json({ error: "Competência inválida" }, { status: 400 });

  const start = `${month}-01`;
  const nextDate = new Date(`${start}T12:00:00`);
  nextDate.setMonth(nextDate.getMonth() + 1);
  const end = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-01`;
  const historyStartDate = new Date(`${start}T12:00:00`);
  historyStartDate.setMonth(historyStartDate.getMonth() - 3);
  const historyStart = `${historyStartDate.getFullYear()}-${String(historyStartDate.getMonth() + 1).padStart(2, "0")}-01`;
  const [monthResult, paymentsResult, payablesResult, previousMonthResult, pricingFixedCostsResult, historicalMonthsResult, historicalPaymentsResult, historicalPayablesResult] = await Promise.all([
    access.supabase.from("financial_months")
      .select("competence_month, gross_revenue, fixed_costs, non_cash_costs, variable_costs, desired_profit, business_days, updated_at")
      .eq("competence_month", start).maybeSingle(),
    access.supabase.from("quote_payments").select("id, amount, payment_type, payment_method, received_on, quotes(number, customer_name)").gte("received_on", start).lt("received_on", end).order("received_on", { ascending: false }),
    access.supabase.from("payable_installments").select("id, amount, paid_amount, interest_amount, fine_amount, discount_amount, paid_on, payment_method, payables(description, document_number, suppliers(legal_name, trade_name), expense_categories(name, classification))").eq("status", "pago").gte("paid_on", start).lt("paid_on", end).order("paid_on", { ascending: false }),
    access.supabase.from("financial_months").select("competence_month, fixed_costs, non_cash_costs, desired_profit, business_days").lt("competence_month", start).order("competence_month", { ascending: false }).limit(1).maybeSingle(),
    access.supabase.from("pricing_fixed_costs").select("monthly_amount").eq("active", true),
    access.supabase.from("financial_months").select("competence_month, gross_revenue, variable_costs").gte("competence_month", historyStart).lt("competence_month", start),
    access.supabase.from("quote_payments").select("amount, received_on").gte("received_on", historyStart).lt("received_on", start),
    access.supabase.from("payable_installments").select("amount, paid_amount, interest_amount, fine_amount, discount_amount, paid_on, payables(expense_categories(classification))").eq("status", "pago").gte("paid_on", historyStart).lt("paid_on", start),
  ]);

  if (monthResult.error || paymentsResult.error || payablesResult.error || previousMonthResult.error || pricingFixedCostsResult.error || historicalMonthsResult.error || historicalPaymentsResult.error || historicalPayablesResult.error) return Response.json({ error: "Não foi possível consultar os dados financeiros." }, { status: 500 });
  const data = monthResult.data;
  const receivedRevenue = (paymentsResult.data ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const otherRevenue = Number(data?.gross_revenue ?? 0);
  const paidPayables = (payablesResult.data ?? []).map((item) => {
    const effectiveAmount = effectivePaidAmount(item);
    const payable = Array.isArray(item.payables) ? item.payables[0] : item.payables;
    const category = Array.isArray(payable?.expense_categories) ? payable?.expense_categories[0] : payable?.expense_categories;
    const supplier = Array.isArray(payable?.suppliers) ? payable?.suppliers[0] : payable?.suppliers;
    return { ...item, effectiveAmount, classification: category?.classification ?? "variavel", categoryName: category?.name ?? "Sem categoria", description: payable?.description ?? "Conta a pagar", documentNumber: payable?.document_number ?? null, supplierName: supplier?.trade_name || supplier?.legal_name || "Sem fornecedor" };
  });
  const paidFixedCosts = paidPayables.filter((item) => item.classification === "fixo").reduce((sum, item) => sum + item.effectiveAmount, 0);
  const paidVariableCosts = paidPayables.filter((item) => ["variavel", "imposto", "financeiro"].includes(item.classification)).reduce((sum, item) => sum + item.effectiveAmount, 0);
  const paidInvestments = paidPayables.filter((item) => item.classification === "investimento").reduce((sum, item) => sum + item.effectiveAmount, 0);
  const previousData = previousMonthResult.data;
  const pricingFixedCosts = (pricingFixedCostsResult.data ?? []).reduce((sum, item) => sum + Number(item.monthly_amount ?? 0), 0);
  const fixedConfig = recurringValue(data?.fixed_costs, previousData?.fixed_costs, pricingFixedCosts);
  const nonCashConfig = recurringValue(data?.non_cash_costs, previousData?.non_cash_costs);
  const profitConfig = recurringValue(data?.desired_profit, previousData?.desired_profit);
  const otherFixedCosts = fixedConfig.value, otherVariableCosts = Number(data?.variable_costs ?? 0);
  const historicVariableCosts = (historicalPayablesResult.data ?? []).flatMap((item) => {
    const payable = Array.isArray(item.payables) ? item.payables[0] : item.payables;
    const category = Array.isArray(payable?.expense_categories) ? payable.expense_categories[0] : payable?.expense_categories;
    return ["variavel", "imposto", "financeiro"].includes(category?.classification ?? "") && item.paid_on
      ? [{ date: item.paid_on, amount: effectivePaidAmount(item) }]
      : [];
  });
  const projection = historicalContributionProjection(
    (historicalMonthsResult.data ?? []).map((item) => ({ competenceMonth: item.competence_month, otherRevenue: Number(item.gross_revenue), otherVariableCosts: Number(item.variable_costs) })),
    (historicalPaymentsResult.data ?? []).map((item) => ({ date: item.received_on, amount: Number(item.amount) })),
    historicVariableCosts,
  );
  const grossRevenue = receivedRevenue + otherRevenue;
  const variableCosts = otherVariableCosts + paidVariableCosts;
  const calculationBasis = grossRevenue > 0 ? "realized" : projection.rate > 0 ? "projected" : "incomplete";

  return Response.json({ financialMonth: {
    month,
    grossRevenue,
    receivedRevenue,
    otherRevenue,
    fixedCosts: otherFixedCosts + paidFixedCosts,
    otherFixedCosts,
    paidFixedCosts,
    nonCashCosts: nonCashConfig.value,
    variableCosts,
    otherVariableCosts,
    paidVariableCosts,
    paidInvestments,
    desiredProfit: profitConfig.value,
    businessDays: data?.business_days ?? previousData?.business_days ?? 22,
    projectedContributionRate: projection.rate,
    historicalMonths: projection.months,
    calculationBasis,
    inheritance: {
      fixedCosts: fixedConfig.inherited,
      nonCashCosts: nonCashConfig.inherited,
      desiredProfit: profitConfig.inherited,
      source: fixedConfig.source,
      sourceMonth: fixedConfig.source === "previous" ? previousData?.competence_month ?? null : null,
    },
    updatedAt: data?.updated_at,
    payments: paymentsResult.data ?? [],
    payables: paidPayables,
  }, configured: Boolean(data || fixedConfig.value > 0) });
}

export async function PUT(request: Request) {
  const access = await getManagementAccess(["admin", "financeiro"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;

  const parsed = financialMonthSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Confira os valores informados." }, { status: 400 });
  }

  const input = parsed.data;
  const { data, error } = await access.supabase
    .from("financial_months")
    .upsert({
      organization_id: access.organizationId,
      competence_month: `${input.month}-01`,
      gross_revenue: input.otherRevenue,
      fixed_costs: input.otherFixedCosts,
      non_cash_costs: input.nonCashCosts,
      variable_costs: input.otherVariableCosts,
      desired_profit: input.desiredProfit,
      business_days: input.businessDays,
      created_by: access.user.id,
      updated_by: access.user.id,
    }, { onConflict: "organization_id,competence_month" })
    .select("updated_at")
    .single();

  if (error) return Response.json({ error: "Não foi possível salvar a competência financeira." }, { status: 500 });
  return Response.json({ saved: true, updatedAt: data.updated_at });
}
