import { getManagementAccess } from "@/lib/management-auth";
import { effectivePaidAmount, historicalContributionProjection, recurringValue } from "@/lib/break-even-projection";

export const dynamic = "force-dynamic";

const openStatuses = ["novo", "em_analise", "aguardando_cliente", "aprovado"];

export async function GET() {
  const access = await getManagementAccess();
  if ("response" in access) return access.response;

  const now = new Date();
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(now);
  const monthStart = `${month}-01`;
  const nextMonthDate = new Date(`${monthStart}T12:00:00`);
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const monthEnd = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  const historyStartDate = new Date(`${monthStart}T12:00:00`);
  historyStartDate.setMonth(historyStartDate.getMonth() - 3);
  const historyStart = `${historyStartDate.getFullYear()}-${String(historyStartDate.getMonth() + 1).padStart(2, "0")}-01`;
  const canViewFinance = ["admin", "financeiro"].includes(access.role);
  const canViewReceivables = ["admin", "financeiro", "comercial"].includes(access.role);
  const emptyList = Promise.resolve({ data: [] as never[], error: null });
  const emptySingle = Promise.resolve({ data: null, error: null });

  const canManageDemo = access.role === "admin";
  const [payments, quotes, production, inventory, customers, financialMonth, paidPayables, openReceivables, previousFinancialMonth, pricingFixedCosts, historicalFinancialMonths, historicalPayments, historicalPayables, organizationRow, pricingSettingsRow, demoCustomerRow] = await Promise.all([
    canViewFinance ? access.supabase.from("quote_payments").select("amount").gte("received_on", monthStart).lt("received_on", monthEnd) : emptyList,
    access.supabase.from("quotes").select("id, number, customer_name, service, status, estimated_value, valid_until, created_at, updated_at").order("created_at", { ascending: false }).limit(100),
    access.supabase.from("production_orders").select("id, number, title, stage, priority, due_at, created_at").not("stage", "in", "(concluido,cancelado)").order("created_at", { ascending: false }).limit(100),
    access.supabase.from("inventory_items").select("id, name, unit, current_quantity, minimum_quantity").eq("active", true),
    access.supabase.from("customers").select("id", { count: "exact", head: true }).eq("active", true),
    canViewFinance ? access.supabase.from("financial_months").select("gross_revenue, fixed_costs, non_cash_costs, variable_costs, desired_profit, business_days").eq("competence_month", monthStart).maybeSingle() : emptySingle,
    canViewFinance ? access.supabase.from("payable_installments").select("amount, paid_amount, interest_amount, fine_amount, discount_amount, payables(expense_categories(classification))").eq("status", "pago").gte("paid_on", monthStart).lt("paid_on", monthEnd) : emptyList,
    canViewReceivables ? access.supabase.from("receivable_installments").select("quote_id, amount, due_date, status, quotes!inner(id, status)").in("status", ["pendente", "agendado"]) : emptyList,
    canViewFinance ? access.supabase.from("financial_months").select("competence_month, fixed_costs, non_cash_costs, desired_profit, business_days").lt("competence_month", monthStart).order("competence_month", { ascending: false }).limit(1).maybeSingle() : emptySingle,
    canViewFinance ? access.supabase.from("pricing_fixed_costs").select("monthly_amount").eq("active", true) : emptyList,
    canViewFinance ? access.supabase.from("financial_months").select("competence_month, gross_revenue, variable_costs").gte("competence_month", historyStart).lt("competence_month", monthStart) : emptyList,
    canViewFinance ? access.supabase.from("quote_payments").select("amount, received_on").gte("received_on", historyStart).lt("received_on", monthStart) : emptyList,
    canViewFinance ? access.supabase.from("payable_installments").select("amount, paid_amount, interest_amount, fine_amount, discount_amount, paid_on, payables(expense_categories(classification))").eq("status", "pago").gte("paid_on", historyStart).lt("paid_on", monthStart) : emptyList,
    access.supabase.from("organizations").select("logo_url, whatsapp, document, public_slug, public_portal_enabled").eq("id", access.organizationId).maybeSingle(),
    access.supabase.from("pricing_settings").select("id").eq("id", "default").maybeSingle(),
    canManageDemo ? access.supabase.from("customers").select("id").ilike("name", "%[Exemplo]%").limit(1) : emptyList,
  ]);

  const error = payments.error || quotes.error || production.error || inventory.error || customers.error || financialMonth.error || paidPayables.error || openReceivables.error || previousFinancialMonth.error || pricingFixedCosts.error || historicalFinancialMonths.error || historicalPayments.error || historicalPayables.error;
  if (error) return Response.json({ error: "Não foi possível carregar o resumo da operação." }, { status: 500 });

  const quoteRows = quotes.data ?? [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  const followUpLimit = new Date(now); followUpLimit.setDate(followUpLimit.getDate() - 2);
  const followUpQuotes = quoteRows.filter((quote) => quote.status === "aguardando_cliente" && new Date(quote.updated_at ?? quote.created_at) <= followUpLimit);
  const expiringLimit = new Date(now); expiringLimit.setDate(expiringLimit.getDate() + 2);
  const expiringDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(expiringLimit);
  const expiringQuotes = quoteRows.filter((quote) => ["novo", "em_analise", "aguardando_cliente"].includes(quote.status) && quote.valid_until && quote.valid_until >= today && quote.valid_until <= expiringDate);
  const activeQuotes = quoteRows.filter((quote) => openStatuses.includes(quote.status));
  const approvedPendingProduction = quoteRows.filter((quote) => quote.status === "aprovado").length;
  const outstandingRows = (openReceivables.data ?? []).filter((item) => {
    const quote = Array.isArray(item.quotes) ? item.quotes[0] : item.quotes;
    return quote?.status === "convertido";
  });
  const unpaidClosedQuotes = new Set(outstandingRows.map((item) => item.quote_id)).size;
  const unpaidClosedValue = outstandingRows.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const overdueRows = outstandingRows.filter((item) => item.due_date < today);
  const overdueReceivableQuotes = new Set(overdueRows.map((item) => item.quote_id)).size;
  const overdueReceivableValue = overdueRows.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const productionRows = production.data ?? [];
  const inventoryRows = inventory.data ?? [];
  const allCriticalItems = inventoryRows
    .filter((item) => Number(item.minimum_quantity) > 0 && Number(item.current_quantity) <= Number(item.minimum_quantity))
    .sort((a, b) => Number(a.current_quantity) - Number(b.current_quantity));
  const criticalItems = allCriticalItems.slice(0, 5);
  const productionByStage = Object.entries(productionRows.reduce<Record<string, number>>((result, order) => {
    result[order.stage] = (result[order.stage] ?? 0) + 1;
    return result;
  }, {})).map(([stage, count]) => ({ stage, count }));
  const receivedRevenue = (payments.data ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const paidCosts = (paidPayables.data ?? []).reduce((result, item) => {
    const payable = Array.isArray(item.payables) ? item.payables[0] : item.payables;
    const category = Array.isArray(payable?.expense_categories) ? payable.expense_categories[0] : payable?.expense_categories;
    const amount = Number(item.paid_amount ?? item.amount) + Number(item.interest_amount ?? 0) + Number(item.fine_amount ?? 0) - Number(item.discount_amount ?? 0);
    if (category?.classification === "fixo") result.fixed += amount;
    else if (["variavel", "imposto", "financeiro"].includes(category?.classification ?? "variavel")) result.variable += amount;
    return result;
  }, { fixed: 0, variable: 0 });
  const historicVariableCosts = (historicalPayables.data ?? []).flatMap((item) => {
    const payable = Array.isArray(item.payables) ? item.payables[0] : item.payables;
    const category = Array.isArray(payable?.expense_categories) ? payable.expense_categories[0] : payable?.expense_categories;
    return ["variavel", "imposto", "financeiro"].includes(category?.classification ?? "") && item.paid_on
      ? [{ date: item.paid_on, amount: effectivePaidAmount(item) }]
      : [];
  });
  const historicalProjection = historicalContributionProjection(
    (historicalFinancialMonths.data ?? []).map((item) => ({ competenceMonth: item.competence_month, otherRevenue: Number(item.gross_revenue), otherVariableCosts: Number(item.variable_costs) })),
    (historicalPayments.data ?? []).map((item) => ({ date: item.received_on, amount: Number(item.amount) })),
    historicVariableCosts,
  );
  const finance = financialMonth.data;
  const previousFinance = previousFinancialMonth.data;
  const pricingFixedMonthly = (pricingFixedCosts.data ?? []).reduce((sum, item) => sum + Number(item.monthly_amount ?? 0), 0);
  const recurringFixed = recurringValue(finance?.fixed_costs, previousFinance?.fixed_costs, pricingFixedMonthly);
  const recurringNonCash = recurringValue(finance?.non_cash_costs, previousFinance?.non_cash_costs);
  const recurringProfit = recurringValue(finance?.desired_profit, previousFinance?.desired_profit);
  const grossRevenue = receivedRevenue + Number(finance?.gross_revenue ?? 0);
  const fixedCosts = paidCosts.fixed + recurringFixed.value;
  const variableCosts = paidCosts.variable + Number(finance?.variable_costs ?? 0);
  const realizedContributionRate = grossRevenue > 0 ? (grossRevenue - variableCosts) / grossRevenue : 0;
  const calculationBasis = grossRevenue > 0 ? "realized" : historicalProjection.rate > 0 ? "projected" : "incomplete";
  const contributionRate = calculationBasis === "projected" ? historicalProjection.rate : realizedContributionRate;
  const accountingBreakEven = contributionRate > 0 ? fixedCosts / contributionRate : 0;
  const financialBreakEven = contributionRate > 0 ? Math.max(fixedCosts - recurringNonCash.value, 0) / contributionRate : 0;
  const economicBreakEven = contributionRate > 0 ? (fixedCosts + recurringProfit.value) / contributionRate : 0;

  return Response.json({ dashboard: {
    permissions: { finance: canViewFinance, receivables: canViewReceivables },
    onboarding: {
      companyConfigured: Boolean(organizationRow.data?.logo_url || organizationRow.data?.whatsapp || organizationRow.data?.document),
      pricingConfigured: Boolean(pricingSettingsRow.data?.id),
      portalEnabled: Boolean(organizationRow.data?.public_portal_enabled && organizationRow.data?.public_slug),
      hasQuote: quoteRows.length > 0,
      canManageDemo,
      hasDemoData: Boolean((demoCustomerRow.data ?? []).length > 0 || quoteRows.some((quote) => quote.service.includes("[Exemplo]"))),
    },
    revenue: receivedRevenue,
    openQuotes: activeQuotes.length,
    openQuoteValue: activeQuotes.reduce((sum, quote) => sum + Number(quote.estimated_value ?? 0), 0),
    approvedQuotes: activeQuotes.filter((quote) => quote.status === "aprovado").length,
    approvedPendingProduction,
    unpaidClosedQuotes,
    unpaidClosedValue,
    overdueReceivableQuotes,
    overdueReceivableValue,
    followUpQuotesDue: followUpQuotes.length,
    expiringQuotes: expiringQuotes.length,
    productionOrders: productionRows.length,
    overdueProduction: productionRows.filter((order) => order.due_at && new Date(order.due_at) < now).length,
    criticalStock: allCriticalItems.length,
    customerCount: customers.count ?? 0,
    recentQuotes: quoteRows.slice(0, 5).map((quote) => ({ id: quote.id, number: quote.number, customerName: quote.customer_name, service: quote.service, status: quote.status, value: Number(quote.estimated_value ?? 0), createdAt: quote.created_at, validUntil: quote.valid_until })),
    productionByStage,
    criticalItems: criticalItems.map((item) => ({ id: item.id, name: item.name, unit: item.unit, current: Number(item.current_quantity), minimum: Number(item.minimum_quantity) })),
    breakEven: {
      configured: Boolean(finance || recurringFixed.value > 0),
      grossRevenue,
      fixedCosts,
      variableCosts,
      contribution: grossRevenue - variableCosts,
      accounting: accountingBreakEven,
      financial: financialBreakEven,
      economic: economicBreakEven,
      remaining: Math.max(accountingBreakEven - grossRevenue, 0),
      progress: accountingBreakEven > 0 ? grossRevenue / accountingBreakEven * 100 : 0,
      contributionRate: contributionRate * 100,
      dailyTarget: accountingBreakEven / Math.max(Number(finance?.business_days ?? previousFinance?.business_days ?? 22), 1),
      calculationBasis,
      historicalMonths: historicalProjection.months,
      recurringSource: recurringFixed.source,
      recurringSourceMonth: recurringFixed.source === "previous" ? previousFinance?.competence_month ?? null : null,
    },
  } });
}
