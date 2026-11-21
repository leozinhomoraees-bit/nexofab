import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((value) => value.from <= value.to, { message: "Período inválido." });
const correctionSchema = z.object({
  itemId: z.string().uuid(),
  commissionPercent: z.coerce.number().min(0).max(100),
  taxPercent: z.coerce.number().min(0).max(100),
}).refine((value) => value.commissionPercent + value.taxPercent < 100, { message: "A soma dos percentuais deve ser menor que 100%." });

type Snapshot = {
  commissionPercent?: number;
  taxPercent?: number;
  totalCost?: number;
  suggestedPrice?: number;
  averageSuggestedPrice?: number;
  expectedGrossProfit?: number;
};
type QuoteItem = { id: string; description: string; quantity: number; unit_price: number; unit_cost: number; pricing_snapshot?: Snapshot | null; selected_by_customer?: boolean | null };
type QuoteRow = { id: string; number: number; customer_name: string; company?: string | null; service: string; subtotal: number; discount: number; freight: number; estimated_value: number; status: "aprovado" | "convertido"; updated_at: string; quote_items?: QuoteItem[]; quote_approval_versions?: Array<{ approved_at: string }>; production_orders?: Array<{ created_at: string }> };
type CommercialRates = { commissionPercent: number; taxPercent: number; recovered: boolean };

function nextDay(value: string) {
  const result = new Date(`${value}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + 1);
  return result.toISOString().slice(0, 10);
}

function recoverCommercialRates(snapshot: Snapshot | null | undefined, defaults: { commissionPercent: number; taxPercent: number }): CommercialRates | null {
  if (!snapshot) return null;
  if ("commissionPercent" in snapshot || "taxPercent" in snapshot) {
    return { commissionPercent: Number(snapshot.commissionPercent ?? 0), taxPercent: Number(snapshot.taxPercent ?? 0), recovered: false };
  }

  // Configuradores antigos gravavam custo, venda e lucro líquido, mas não os dois
  // percentuais. A diferença entre esses valores conserva a dedução comercial total.
  const sale = Number(snapshot.averageSuggestedPrice ?? snapshot.suggestedPrice ?? 0);
  const cost = Number(snapshot.totalCost ?? 0);
  const profit = Number(snapshot.expectedGrossProfit ?? 0);
  if (sale <= 0 || cost < 0 || !Number.isFinite(profit)) return null;
  const totalPercent = Math.max(0, Math.min(100, (sale - cost - profit) / sale * 100));
  if (totalPercent < 0.05) return { commissionPercent: 0, taxPercent: 0, recovered: true };

  const candidates = [
    defaults.commissionPercent > 0 ? { commissionPercent: defaults.commissionPercent, taxPercent: 0 } : null,
    defaults.taxPercent > 0 ? { commissionPercent: 0, taxPercent: defaults.taxPercent } : null,
    defaults.commissionPercent > 0 && defaults.taxPercent > 0
      ? { commissionPercent: defaults.commissionPercent, taxPercent: defaults.taxPercent }
      : null,
  ].filter((candidate): candidate is { commissionPercent: number; taxPercent: number } => Boolean(candidate));
  const closest = candidates.sort((a, b) =>
    Math.abs(a.commissionPercent + a.taxPercent - totalPercent) - Math.abs(b.commissionPercent + b.taxPercent - totalPercent)
  )[0];
  if (!closest || Math.abs(closest.commissionPercent + closest.taxPercent - totalPercent) > 0.5) return null;
  return { ...closest, recovered: true };
}

export async function GET(request: Request) {
  const access = await getManagementAccess(["admin", "financeiro", "comercial"]);
  if ("response" in access) return access.response;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ from: url.searchParams.get("from"), to: url.searchParams.get("to") });
  if (!parsed.success) return Response.json({ error: "Informe um período válido." }, { status: 400 });

  const [{ data, error }, { data: settings }] = await Promise.all([
    access.supabase
    .from("quotes")
    .select("id, number, customer_name, company, service, subtotal, discount, freight, estimated_value, status, updated_at, quote_items(id, description, quantity, unit_price, unit_cost, pricing_snapshot, selected_by_customer), quote_approval_versions(approved_at), production_orders(created_at)")
    .in("status", ["aprovado", "convertido"])
    .order("updated_at", { ascending: false }),
    access.supabase.from("pricing_settings").select("commission_percent, tax_percent").eq("id", "default").maybeSingle(),
  ]);
  if (error) return Response.json({ error: "Não foi possível calcular o relatório de comissões." }, { status: 500 });

  let missingCommercialMemory = 0;
  let recoveredCommercialMemory = 0;
  const unresolvedItems: Array<{ itemId: string; quoteNumber: number; customerName: string; description: string; base: number }> = [];
  const defaults = {
    commissionPercent: Number(settings?.commission_percent ?? 0),
    taxPercent: Number(settings?.tax_percent ?? 0),
  };
  const rangeStart = `${parsed.data.from}T00:00:00-03:00`;
  const rangeEnd = `${nextDay(parsed.data.to)}T00:00:00-03:00`;
  const rows = ((data ?? []) as QuoteRow[]).map((quote) => {
    const approvals = [...(quote.quote_approval_versions ?? [])].sort((a, b) => b.approved_at.localeCompare(a.approved_at));
    const production = [...(quote.production_orders ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const commercialAt = approvals[0]?.approved_at ?? production[0]?.created_at ?? quote.updated_at;
    const items = (quote.quote_items ?? []).filter((item) => item.selected_by_customer !== false);
    const lineSubtotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
    const discountFactor = lineSubtotal > 0 ? Math.max(lineSubtotal - Number(quote.discount ?? 0), 0) / lineSubtotal : 1;
    let commission = 0, tax = 0, cost = 0, commissionBase = 0;
    const details = items.map((item) => {
      const snapshot = item.pricing_snapshot;
      const base = Number(item.quantity) * Number(item.unit_price) * discountFactor;
      const rates = recoverCommercialRates(snapshot, defaults);
      const commissionPercent = rates?.commissionPercent ?? 0;
      const taxPercent = rates?.taxPercent ?? 0;
      if (!rates) {
        missingCommercialMemory += 1;
        unresolvedItems.push({ itemId: item.id, quoteNumber: quote.number, customerName: quote.company || quote.customer_name, description: item.description, base });
      }
      else if (rates.recovered) recoveredCommercialMemory += 1;
      const itemCommission = base * commissionPercent / 100;
      const itemTax = base * taxPercent / 100;
      commission += itemCommission;
      tax += itemTax;
      cost += Number(item.quantity) * Number(item.unit_cost);
      if (commissionPercent > 0) commissionBase += base;
      return { description: item.description, base, commissionPercent, commission: itemCommission, taxPercent, tax: itemTax, recovered: rates?.recovered ?? false };
    }).filter((item) => item.commission > 0 || item.tax > 0);
    const sale = Number(quote.estimated_value ?? 0);
    return { id: quote.id, number: quote.number, customerName: quote.company || quote.customer_name, service: quote.service, status: quote.status, commercialAt, sale, commissionBase, commission, tax, cost, estimatedResult: sale - cost - commission - tax, details };
  }).filter((row) => row.commercialAt >= rangeStart && row.commercialAt < rangeEnd && row.commission > 0);

  const summary = rows.reduce((result, row) => ({
    sales: result.sales + row.sale,
    commissionBase: result.commissionBase + row.commissionBase,
    commission: result.commission + row.commission,
    tax: result.tax + row.tax,
    estimatedResult: result.estimatedResult + row.estimatedResult,
  }), { sales: 0, commissionBase: 0, commission: 0, tax: 0, estimatedResult: 0 });

  return Response.json({
    period: parsed.data,
    summary: { ...summary, closedQuotes: rows.length, averageCommissionPercent: summary.commissionBase > 0 ? summary.commission / summary.commissionBase * 100 : 0 },
    rows,
    missingCommercialMemory,
    recoveredCommercialMemory,
    unresolvedItems,
    suggestedRates: defaults,
  });
}

export async function PATCH(request: Request) {
  const access = await getManagementAccess(["admin", "financeiro", "comercial"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;
  const parsed = correctionSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Percentuais inválidos." }, { status: 400 });

  const { data: item, error: itemError } = await access.supabase
    .from("quote_items")
    .select("id, pricing_snapshot, quotes!inner(status)")
    .eq("id", parsed.data.itemId)
    .single();
  if (itemError || !item) return Response.json({ error: "Item do orçamento não encontrado." }, { status: 404 });
  const quote = Array.isArray(item.quotes) ? item.quotes[0] : item.quotes;
  if (!quote || !["aprovado", "convertido"].includes(quote.status)) return Response.json({ error: "A correção é permitida somente em orçamentos aprovados ou fechados." }, { status: 409 });

  const snapshot = item.pricing_snapshot && typeof item.pricing_snapshot === "object" ? item.pricing_snapshot as Record<string, unknown> : {};
  const { error: updateError } = await access.supabase.from("quote_items").update({
    pricing_snapshot: {
      ...snapshot,
      commissionPercent: parsed.data.commissionPercent,
      taxPercent: parsed.data.taxPercent,
      commercialRatesCorrectedAt: new Date().toISOString(),
    },
  }).eq("id", parsed.data.itemId);
  if (updateError) return Response.json({ error: "Não foi possível salvar os percentuais no item." }, { status: 500 });
  return Response.json({ ok: true });
}
