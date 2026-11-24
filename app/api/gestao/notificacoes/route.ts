import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";
import { ensureApprovedProductionOrders } from "@/lib/production-reminders";

export const dynamic = "force-dynamic";

const updateSchema = z.union([
  z.object({ id: z.string().uuid() }),
  z.object({ all: z.literal(true) }),
]);

function formatElapsed(ms: number): string {
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days} dia${days > 1 ? "s" : ""}`;
}

export async function GET() {
  const access = await getManagementAccess();
  if ("response" in access) return access.response;

  const canFollowUp = ["admin", "comercial", "financeiro"].includes(access.role);
  if (["admin", "comercial", "producao"].includes(access.role)) {
    await ensureApprovedProductionOrders(access.supabase, access.user.id);
  }

  const [storedResult, productionResult, threadsResult, openQuotesResult, waConfigResult] = await Promise.all([
    access.supabase
      .from("management_notifications")
      .select("id, type, title, message, quote_id, metadata, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    access.supabase
      .from("production_orders")
      .select("id, number, quote_id, title, stage, due_at, updated_at, created_at, quotes(number, customer_name, company, service)")
      .not("stage", "in", "(concluido,cancelado)")
      .order("updated_at", { ascending: false })
      .limit(100),
    canFollowUp
      ? access.supabase
          .from("whatsapp_threads")
          .select("id, phone, contact_name, subject, status, last_message_preview, last_customer_message_at, next_contact_at, updated_at")
          .in("status", ["waiting_reply", "snoozed"])
          .order("last_customer_message_at", { ascending: true })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
    canFollowUp
      ? access.supabase
          .from("quotes")
          .select("id, number, customer_name, company, phone, service, status, created_at, updated_at, last_contact_at, next_contact_at")
          .in("status", ["novo", "em_analise", "aguardando_cliente"])
          .order("updated_at", { ascending: true })
          .limit(60)
      : Promise.resolve({ data: [], error: null }),
    canFollowUp
      ? access.supabase.rpc("get_organization_whatsapp_config")
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (storedResult.error) {
    if (["42P01", "PGRST205"].includes(storedResult.error.code)) {
      return Response.json({ notifications: [], unread: 0, setupRequired: true });
    }
    return Response.json({ error: "Não foi possível carregar as notificações." }, { status: 500 });
  }

  const now = new Date();
  const nowMs = now.getTime();
  const dueLimit = new Date(now);
  dueLimit.setDate(dueLimit.getDate() + 2);

  const productionAlerts = (productionResult.data ?? []).flatMap((order) => {
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
      message: overdue
        ? `${customer} · ${quote?.service || order.title}. Abra a produção e atualize o andamento.`
        : dueSoon
          ? `${customer} · ${quote?.service || order.title}. Confira se o serviço está dentro do cronograma.`
          : `${customer} aceitou o orçamento. Confira arquivos, entrada, materiais e programe a execução.`,
      quote_id: order.quote_id,
      metadata: {
        quoteNumber: quote?.number,
        customer,
        service: quote?.service || order.title,
        status: order.stage,
        productionOrderId: order.id,
        dueAt: order.due_at,
        virtual: true,
      },
      read_at: null,
      created_at: order.updated_at || order.created_at,
    }];
  });

  const waConfig = waConfigResult.data as { alertAfterMinutes?: number } | null;
  const alertAfterMs = Math.max(5, Number(waConfig?.alertAfterMinutes ?? 30)) * 60_000;

  const threadRows = threadsResult.error ? [] : (threadsResult.data ?? []);
  const attendanceAlerts = threadRows.flatMap((thread) => {
    if (thread.status === "snoozed") {
      if (!thread.next_contact_at || new Date(thread.next_contact_at).getTime() > nowMs) return [];
      return [{
        id: `attendance:${thread.id}:followup`,
        type: "followup_due",
        title: `Retorno agendado: ${thread.contact_name}`,
        message: `${thread.subject || thread.last_message_preview || "Retorno pendente"} · hora de chamar o cliente.`,
        quote_id: null,
        metadata: {
          threadId: thread.id,
          customer: thread.contact_name,
          phone: thread.phone,
          service: thread.subject || undefined,
          virtual: true,
        },
        read_at: null,
        created_at: thread.next_contact_at,
      }];
    }

    const waitingMs = nowMs - new Date(thread.last_customer_message_at).getTime();
    if (waitingMs < alertAfterMs) return [];
    return [{
      id: `attendance:${thread.id}:unanswered`,
      type: "customer_unanswered",
      title: `Sem resposta há ${formatElapsed(waitingMs)}: ${thread.contact_name}`,
      message: thread.last_message_preview || thread.subject || "Cliente aguardando resposta no WhatsApp.",
      quote_id: null,
      metadata: {
        threadId: thread.id,
        customer: thread.contact_name,
        phone: thread.phone,
        service: thread.subject || undefined,
        virtual: true,
      },
      read_at: null,
      created_at: thread.last_customer_message_at,
    }];
  });

  const quoteRows = openQuotesResult.error ? [] : (openQuotesResult.data ?? []);
  const quoteFollowupAlerts = quoteRows.flatMap((quote) => {
    const customer = quote.company || quote.customer_name || "Cliente";
    if (quote.next_contact_at && new Date(quote.next_contact_at).getTime() <= nowMs) {
      return [{
        id: `quote:${quote.id}:scheduled`,
        type: "followup_due",
        title: `Retorno agendado — Orçamento #${quote.number}`,
        message: `${customer} · ${quote.service}. Lembrete programado para contato hoje.`,
        quote_id: quote.id,
        metadata: {
          quoteNumber: quote.number,
          customer,
          phone: quote.phone,
          service: quote.service,
          status: quote.status,
          virtual: true,
        },
        read_at: null,
        created_at: quote.next_contact_at,
      }];
    }

    const lastTouch = new Date(quote.last_contact_at || quote.updated_at || quote.created_at).getTime();
    const idleMs = nowMs - lastTouch;

    if (quote.status === "novo" && idleMs >= 4 * 3600_000) {
      return [{
        id: `quote:${quote.id}:new_idle`,
        type: "customer_unanswered",
        title: `Novo pedido #${quote.number} sem resposta há ${formatElapsed(idleMs)}`,
        message: `${customer} aguarda retorno sobre ${quote.service}.`,
        quote_id: quote.id,
        metadata: {
          quoteNumber: quote.number,
          customer,
          phone: quote.phone,
          service: quote.service,
          status: quote.status,
          virtual: true,
        },
        read_at: null,
        created_at: quote.created_at,
      }];
    }

    if (quote.status === "em_analise" && idleMs >= 24 * 3600_000) {
      return [{
        id: `quote:${quote.id}:stalled`,
        type: "customer_unanswered",
        title: `Orçamento #${quote.number} parado há ${formatElapsed(idleMs)}`,
        message: `${customer} · ${quote.service}. Ainda em montagem sem envio ao cliente.`,
        quote_id: quote.id,
        metadata: {
          quoteNumber: quote.number,
          customer,
          phone: quote.phone,
          service: quote.service,
          status: quote.status,
          virtual: true,
        },
        read_at: null,
        created_at: quote.updated_at || quote.created_at,
      }];
    }

    if (quote.status === "aguardando_cliente" && idleMs >= 48 * 3600_000) {
      return [{
        id: `quote:${quote.id}:followup`,
        type: "followup_due",
        title: `Proposta #${quote.number} sem retorno há ${formatElapsed(idleMs)}`,
        message: `${customer} · ${quote.service}. Faça um acompanhamento rápido no WhatsApp.`,
        quote_id: quote.id,
        metadata: {
          quoteNumber: quote.number,
          customer,
          phone: quote.phone,
          service: quote.service,
          status: quote.status,
          virtual: true,
        },
        read_at: null,
        created_at: quote.last_contact_at || quote.updated_at || quote.created_at,
      }];
    }

    return [];
  });

  const storedNotifications = storedResult.data ?? [];
  const virtualAlerts = [...attendanceAlerts, ...quoteFollowupAlerts, ...productionAlerts];
  const notifications = [...virtualAlerts, ...storedNotifications]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 40);

  return Response.json({
    notifications,
    unread: storedNotifications.filter((item) => !item.read_at).length + virtualAlerts.length,
    setupRequired: false,
  });
}

export async function PATCH(request: Request) {
  const access = await getManagementAccess();
  if ("response" in access) return access.response;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Notificação inválida." }, { status: 400 });

  let query = access.supabase
    .from("management_notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if ("id" in parsed.data) query = query.eq("id", parsed.data.id);
  const { error } = await query;
  if (error) return Response.json({ error: "Não foi possível atualizar a notificação." }, { status: 500 });
  return Response.json({ saved: true });
}
