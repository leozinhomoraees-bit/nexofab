import type { SupabaseClient } from "@supabase/supabase-js";

type ApprovedQuote = {
  id: string;
  customer_id?: string | null;
  customer_name: string;
  company?: string | null;
  service: string;
  details?: string | null;
  delivery_days?: number | null;
  updated_at?: string | null;
  created_at: string;
};

function productionDeadline(quote: ApprovedQuote) {
  if (!Number(quote.delivery_days)) return null;
  const date = new Date(quote.updated_at || quote.created_at);
  date.setDate(date.getDate() + Number(quote.delivery_days));
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

export async function ensureApprovedProductionOrders(supabase: SupabaseClient, createdBy?: string | null) {
  const [quotes, orders] = await Promise.all([
    supabase.from("quotes").select("id, customer_id, customer_name, company, service, details, delivery_days, updated_at, created_at").eq("status", "aprovado").limit(200),
    supabase.from("production_orders").select("quote_id").not("quote_id", "is", null).limit(1000),
  ]);
  if (quotes.error || orders.error) return { created: 0, error: quotes.error ?? orders.error };

  const existing = new Set((orders.data ?? []).map((order) => order.quote_id).filter(Boolean));
  let created = 0;
  for (const quote of (quotes.data ?? []) as ApprovedQuote[]) {
    if (existing.has(quote.id)) continue;
    const { error } = await supabase.from("production_orders").insert({
      quote_id: quote.id,
      customer_id: quote.customer_id || null,
      title: `${quote.service} — ${quote.company || quote.customer_name}`,
      description: quote.details || "Orçamento aceito pelo cliente. Conferir briefing, arquivos, entrada e programar a produção.",
      stage: "briefing",
      priority: "normal",
      due_at: productionDeadline(quote),
      created_by: createdBy || null,
    });
    if (!error) created += 1;
    else if (error.code !== "23505") return { created, error };
  }
  return { created, error: null };
}
