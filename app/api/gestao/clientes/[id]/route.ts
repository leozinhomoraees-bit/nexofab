import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await getManagementAccess();
  if ("response" in access) return access.response;

  const parsedId = z.string().uuid().safeParse((await context.params).id);
  if (!parsedId.success) {
    return Response.json({ error: "Cliente inválido." }, { status: 400 });
  }
  const customerId = parsedId.data;
  const canViewReceivables = ["admin", "financeiro", "comercial"].includes(access.role);

  const { data: customer, error: customerError } = await access.supabase
    .from("customers")
    .select("id, person_type, name, company_name, document, phone, whatsapp, email, address, notes, billing_cycle, billing_weekday, billing_day, credit_limit, billing_notes, active, created_at")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError) {
    return Response.json({ error: "Não foi possível carregar o cliente." }, { status: 500 });
  }
  if (!customer) {
    return Response.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const { data: quotes, error: quotesError } = await access.supabase
    .from("quotes")
    .select("id, number, service, status, source, estimated_value, valid_until, created_at, updated_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (quotesError) {
    return Response.json({ error: "Não foi possível carregar o histórico de orçamentos." }, { status: 500 });
  }

  const quoteRows = quotes ?? [];
  const quoteIds = quoteRows.map((quote) => quote.id);

  const [ordersResult, receivablesResult] = await Promise.all([
    quoteIds.length
      ? access.supabase
          .from("production_orders")
          .select("id, number, quote_id, title, stage, priority, due_at, created_at")
          .in("quote_id", quoteIds)
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as Array<{ id: string; number: number; quote_id: string | null; title: string; stage: string; priority: string; due_at: string | null; created_at: string }>, error: null }),
    quoteIds.length && canViewReceivables
      ? access.supabase
          .from("receivable_installments")
          .select("id, quote_id, installment_number, due_date, amount, received_amount, received_on, status, payment_method")
          .in("quote_id", quoteIds)
          .order("due_date", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as Array<{ id: string; quote_id: string; installment_number: number; due_date: string; amount: number; received_amount: number | null; received_on: string | null; status: string; payment_method: string }>, error: null }),
  ]);

  const orderRows = ordersResult.data ?? [];
  const receivableRows = receivablesResult.data ?? [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  const closedQuotes = quoteRows.filter((quote) => ["aprovado", "convertido"].includes(quote.status));
  const totalBought = closedQuotes.reduce((sum, quote) => sum + Number(quote.estimated_value ?? 0), 0);
  const openInstallments = receivableRows.filter((item) => ["pendente", "agendado"].includes(item.status));
  const openReceivables = openInstallments.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const overdueReceivables = openInstallments
    .filter((item) => item.due_date < today)
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const activeOrders = orderRows.filter((order) => !["concluido", "cancelado"].includes(order.stage)).length;

  return Response.json({
    customer,
    canViewReceivables,
    summary: {
      totalQuotes: quoteRows.length,
      closedQuotes: closedQuotes.length,
      totalBought,
      openReceivables,
      overdueReceivables,
      activeOrders,
    },
    quotes: quoteRows,
    orders: orderRows,
    receivables: receivableRows,
  });
}
