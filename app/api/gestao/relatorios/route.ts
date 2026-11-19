import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const amountPaid = (item: Record<string, unknown>) => Number(item.paid_amount ?? item.amount ?? 0) + Number(item.interest_amount ?? 0) + Number(item.fine_amount ?? 0) - Number(item.discount_amount ?? 0);
const add = (date: string, days: number) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10); };
const daysBetween = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000) + 1;
const relation = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;

export async function GET(request: Request) {
  const access = await getManagementAccess(["admin", "financeiro"]);
  if ("response" in access) return access.response;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ from: url.searchParams.get("from"), to: url.searchParams.get("to") });
  if (!parsed.success || parsed.data.from > parsed.data.to) return Response.json({ error: "Período inválido." }, { status: 400 });

  const { from, to } = parsed.data;
  const toExclusive = add(to, 1);
  const duration = daysBetween(from, to);
  const previousTo = add(from, -1);
  const previousFrom = add(previousTo, -(duration - 1));
  const previousExclusive = add(previousTo, 1);

  const [payments, expenses, quotes, production, openReceivables, openPayables, inventory, previousPayments, previousExpenses, previousQuotes] = await Promise.all([
    access.supabase.from("quote_payments").select("id, amount, received_on, payment_method, quotes(number, customer_name, company, service)").gte("received_on", from).lt("received_on", toExclusive).order("received_on"),
    access.supabase.from("payable_installments").select("id, amount, paid_amount, interest_amount, fine_amount, discount_amount, paid_on, payment_method, payables(description, expense_categories(name, classification), suppliers(legal_name, trade_name), cost_centers(name))").eq("status", "pago").gte("paid_on", from).lt("paid_on", toExclusive).order("paid_on"),
    access.supabase.from("quotes").select("id, number, customer_name, company, service, status, estimated_value, subtotal, discount, created_at, quote_items(quantity, unit_cost, unit_price, option_group, selected_by_customer, pricing_snapshot)").gte("created_at", `${from}T00:00:00`).lt("created_at", `${toExclusive}T00:00:00`).order("created_at"),
    access.supabase.from("production_orders").select("id, stage, priority, due_at, created_at, quotes(number, customer_name, company, service, estimated_value)").gte("created_at", `${from}T00:00:00`).lt("created_at", `${toExclusive}T00:00:00`).order("created_at"),
    access.supabase.from("receivable_installments").select("amount, due_date, status").in("status", ["pendente", "agendado"]).gte("due_date", from).lt("due_date", toExclusive),
    access.supabase.from("payable_installments").select("amount, due_date, status").in("status", ["pendente", "agendado"]).gte("due_date", from).lt("due_date", toExclusive),
    access.supabase.from("inventory_items").select("id, name, category, unit, current_quantity, minimum_quantity, average_cost").eq("active", true),
    access.supabase.from("quote_payments").select("amount").gte("received_on", previousFrom).lt("received_on", previousExclusive),
    access.supabase.from("payable_installments").select("amount, paid_amount, interest_amount, fine_amount, discount_amount").eq("status", "pago").gte("paid_on", previousFrom).lt("paid_on", previousExclusive),
    access.supabase.from("quotes").select("id, status, estimated_value").gte("created_at", `${previousFrom}T00:00:00`).lt("created_at", `${previousExclusive}T00:00:00`),
  ]);
  const error = payments.error || expenses.error || quotes.error || production.error || openReceivables.error || openPayables.error || inventory.error || previousPayments.error || previousExpenses.error || previousQuotes.error;
  if (error) return Response.json({ error: "Não foi possível consolidar os relatórios. Verifique seu acesso financeiro." }, { status: 500 });

  const paymentRows = payments.data ?? [];
  const expenseRows = (expenses.data ?? []).map((item) => {
    const payable = relation(item.payables);
    const category = relation(payable?.expense_categories);
    const supplier = relation(payable?.suppliers);
    const center = relation(payable?.cost_centers);
    return { id: item.id, date: item.paid_on, amount: amountPaid(item), description: payable?.description ?? "Conta paga", category: category?.name ?? "Sem categoria", classification: category?.classification ?? "variavel", supplier: supplier?.trade_name || supplier?.legal_name || "Sem fornecedor", costCenter: center?.name ?? "Sem centro de custo" };
  });
  const quoteRows = (quotes.data ?? []).map((quote) => {
    const allItems = quote.quote_items ?? [];
    const fixedItems = allItems.filter((item) => !item.option_group);
    const grouped = allItems.filter((item) => item.option_group).reduce((map, item) => { const key = item.option_group!.trim().toLocaleLowerCase("pt-BR"); map.set(key, [...(map.get(key) ?? []), item]); return map; }, new Map<string, typeof allItems>());
    const selectedItems = [...fixedItems, ...[...grouped.values()].map((entries) => entries.find((item) => item.selected_by_customer === true) ?? [...entries].sort((a, b) => Number(a.quantity) * Number(a.unit_price) - Number(b.quantity) * Number(b.unit_price))[0])];
    const cost = selectedItems.reduce((sum, item) => {
      const snapshot = item.pricing_snapshot as Record<string, unknown> | null;
      const rememberedTotal = Number(snapshot?.totalCost);
      const quantity = Number(item.quantity), rawCost = Number(item.unit_cost), unitPrice = Number(item.unit_price);
      const legacyTotalCost = quantity > 1 && rawCost > unitPrice;
      const saleTotal = quantity * unitPrice;
      const suspiciousRememberedTotal = Number.isFinite(rememberedTotal) && rememberedTotal > Math.max(saleTotal * 5, rawCost * 5);
      const manualLegacy = (snapshot?.pricingMode === "manual" && legacyTotalCost) || suspiciousRememberedTotal;
      return sum + (manualLegacy ? rawCost : Number.isFinite(rememberedTotal) && rememberedTotal >= 0 ? rememberedTotal : legacyTotalCost ? rawCost : quantity * rawCost);
    }, 0);
    const deductions = selectedItems.reduce((sum, item) => {
      const snapshot = item.pricing_snapshot as Record<string, unknown> | null;
      const sale = Number(item.quantity) * Number(item.unit_price);
      return sum + sale * (Number(snapshot?.taxPercent ?? 0) + Number(snapshot?.commissionPercent ?? 0)) / 100;
    }, 0);
    return { id: quote.id, number: quote.number, customer: quote.company || quote.customer_name, service: quote.service, status: quote.status, value: Number(quote.estimated_value ?? 0), cost, estimatedProfit: Number(quote.estimated_value ?? 0) - cost - deductions, createdAt: quote.created_at };
  });

  const revenue = paymentRows.reduce((sum, item) => sum + Number(item.amount), 0);
  const expenseTotal = expenseRows.reduce((sum, item) => sum + item.amount, 0);
  const variableExpenses = expenseRows.filter((item) => item.classification === "variavel").reduce((sum, item) => sum + item.amount, 0);
  const fixedExpenses = expenseTotal - variableExpenses;
  const quoteValue = quoteRows.reduce((sum, item) => sum + item.value, 0);
  const converted = quoteRows.filter((item) => item.status === "convertido");
  const approved = quoteRows.filter((item) => ["aprovado", "convertido"].includes(item.status));
  const previousRevenue = (previousPayments.data ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
  const previousExpense = (previousExpenses.data ?? []).reduce((sum, item) => sum + amountPaid(item), 0);
  const previousQuoteValue = (previousQuotes.data ?? []).reduce((sum, item) => sum + Number(item.estimated_value ?? 0), 0);

  const group = <T,>(rows: T[], label: (row: T) => string, value: (row: T) => number) => [...rows.reduce((map, row) => { const key = label(row) || "Não informado"; map.set(key, (map.get(key) ?? 0) + value(row)); return map; }, new Map<string, number>()).entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  const quoteStatuses = [...quoteRows.reduce((map, item) => { const current = map.get(item.status) ?? { count: 0, total: 0 }; current.count += 1; current.total += item.value; map.set(item.status, current); return map; }, new Map<string, { count: number; total: number }>()).entries()].map(([status, values]) => ({ status, ...values }));
  const productionStages = [...(production.data ?? []).reduce((map, item) => { map.set(item.stage, (map.get(item.stage) ?? 0) + 1); return map; }, new Map<string, number>()).entries()].map(([stage, count]) => ({ stage, count }));
  const stockRows = inventory.data ?? [];
  const stockValue = stockRows.reduce((sum, item) => sum + Number(item.current_quantity) * Number(item.average_cost), 0);
  const criticalStock = stockRows.filter((item) => Number(item.minimum_quantity) > 0 && Number(item.current_quantity) <= Number(item.minimum_quantity));
  const forecastMap = new Map<string, { date: string; receivable: number; payable: number }>();
  for (const item of openReceivables.data ?? []) { const row = forecastMap.get(item.due_date) ?? { date: item.due_date, receivable: 0, payable: 0 }; row.receivable += Number(item.amount); forecastMap.set(item.due_date, row); }
  for (const item of openPayables.data ?? []) { const row = forecastMap.get(item.due_date) ?? { date: item.due_date, receivable: 0, payable: 0 }; row.payable += Number(item.amount); forecastMap.set(item.due_date, row); }
  let accumulated = revenue - expenseTotal;
  const cashForecast = [...forecastMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map((item) => { accumulated += item.receivable - item.payable; return { ...item, balance: item.receivable - item.payable, accumulated }; });

  return Response.json({ report: {
    period: { from, to, previousFrom, previousTo },
    summary: {
      revenue, expenses: expenseTotal, cashResult: revenue - expenseTotal,
      openReceivables: (openReceivables.data ?? []).reduce((sum, item) => sum + Number(item.amount), 0),
      openPayables: (openPayables.data ?? []).reduce((sum, item) => sum + Number(item.amount), 0),
      quoteCount: quoteRows.length, quoteValue, approvedCount: approved.length, convertedCount: converted.length,
      conversionRate: quoteRows.length ? converted.length / quoteRows.length * 100 : 0,
      averageTicket: converted.length ? converted.reduce((sum, item) => sum + item.value, 0) / converted.length : 0,
      estimatedCommercialProfit: quoteRows.reduce((sum, item) => sum + item.estimatedProfit, 0),
      productionCount: (production.data ?? []).length,
      stockValue, criticalStock: criticalStock.length,
    },
    comparison: { revenue: previousRevenue, expenses: previousExpense, cashResult: previousRevenue - previousExpense, quoteCount: (previousQuotes.data ?? []).length, quoteValue: previousQuoteValue },
    dre: { grossRevenue: revenue, variableExpenses, contributionMargin: revenue - variableExpenses, fixedExpenses, operatingResult: revenue - variableExpenses - fixedExpenses },
    cashForecast,
    expensesByCategory: group(expenseRows, (item) => item.category, (item) => item.amount),
    expensesBySupplier: group(expenseRows, (item) => item.supplier, (item) => item.amount).slice(0, 10),
    revenueByCustomer: group(paymentRows, (item) => { const quote = relation(item.quotes); return quote?.company || quote?.customer_name || "Cliente não informado"; }, (item) => Number(item.amount)).slice(0, 10),
    quoteStatuses,
    topServices: group(quoteRows, (item) => item.service, (item) => item.value).slice(0, 10),
    productionStages,
    criticalItems: criticalStock.map((item) => ({ id: item.id, name: item.name, category: item.category, unit: item.unit, current: Number(item.current_quantity), minimum: Number(item.minimum_quantity) })),
    cashEntries: paymentRows.map((item) => { const quote = relation(item.quotes); return { id: item.id, date: item.received_on, customer: quote?.company || quote?.customer_name || "Cliente", description: quote?.service || `Orçamento #${quote?.number ?? "—"}`, method: item.payment_method, amount: Number(item.amount) }; }),
    cashExpenses: expenseRows,
    quotes: quoteRows,
  } });
}
