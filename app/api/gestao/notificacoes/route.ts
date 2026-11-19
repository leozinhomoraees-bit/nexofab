import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";
import { ensureApprovedProductionOrders } from "@/lib/production-reminders";

export const dynamic = "force-dynamic";

const updateSchema = z.union([
  z.object({ id: z.string().uuid() }),
  z.object({ all: z.literal(true) }),
]);

export async function GET() {
  const access = await getManagementAccess();
  if ("response" in access) return access.response;

  if (["admin", "comercial", "producao"].includes(access.role)) await ensureApprovedProductionOrders(access.supabase, access.user.id);
  const { data, error } = await access.supabase
    .from("management_notifications")
    .select("id, type, title, message, quote_id, metadata, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    if (["42P01", "PGRST205"].includes(error.code)) return Response.json({ notifications: [], unread: 0, setupRequired: true });
    return Response.json({ error: "Não foi possível carregar as notificações." }, { status: 500 });
  }

  const { data: productionOrders } = await access.supabase.from("production_orders")
    .select("id, number, quote_id, title, stage, due_at, updated_at, created_at, quotes(number, customer_name, company, service)")
    .not("stage", "in", "(concluido,cancelado)")
    .order("updated_at", { ascending: false })
    .limit(100);
  const now = new Date();
  const dueLimit = new Date(now); dueLimit.setDate(dueLimit.getDate() + 2);
  const productionAlerts = (productionOrders ?? []).flatMap((order) => {
    const quote = Array.isArray(order.quotes) ? order.quotes[0] : order.quotes;
    const due = order.due_at ? new Date(order.due_at) : null;
    const overdue = Boolean(due && due < now);
    const dueSoon = Boolean(due && due >= now && due <= dueLimit);
    const awaitingProgramming = order.stage === "briefing";
    if (!overdue && !dueSoon && !awaitingProgramming) return [];
    const type = overdue ? "production_overdue" : dueSoon ? "production_due" : "production_pending";
    const customer = quote?.company || quote?.customer_name || "Cliente";
    return [{
      id: `production:${order.id}:${type}`,
      type,
      title: overdue ? `OS-${order.number} com prazo vencido` : dueSoon ? `OS-${order.number} próxima do prazo` : `OS-${order.number} aguardando programação`,
      message: overdue ? `${customer} · ${quote?.service || order.title}. Abra a produção e atualize o andamento.` : dueSoon ? `${customer} · ${quote?.service || order.title}. Confira se o serviço está dentro do cronograma.` : `${customer} aceitou o orçamento. Confira arquivos, entrada, materiais e programe a execução.`,
      quote_id: order.quote_id,
      metadata: { quoteNumber: quote?.number, customer, service: quote?.service || order.title, status: order.stage, productionOrderId: order.id, dueAt: order.due_at, virtual: true },
      read_at: null,
      created_at: order.updated_at || order.created_at,
    }];
  });
  const storedNotifications = data ?? [];
  const notifications = [...productionAlerts, ...storedNotifications]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 30);
  return Response.json({ notifications, unread: storedNotifications.filter((item) => !item.read_at).length + productionAlerts.length, setupRequired: false });
}

export async function PATCH(request: Request) {
  const access = await getManagementAccess();
  if ("response" in access) return access.response;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Notificação inválida." }, { status: 400 });

  let query = access.supabase.from("management_notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if ("id" in parsed.data) query = query.eq("id", parsed.data.id);
  const { error } = await query;
  if (error) return Response.json({ error: "Não foi possível atualizar a notificação." }, { status: 500 });
  return Response.json({ saved: true });
}

