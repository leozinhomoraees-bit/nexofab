import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";
import { normalizeBrazilianPhone } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const createThreadSchema = z.object({
  contactName: z.string().trim().min(2, "Informe o nome do cliente.").max(120),
  phone: z.string().trim().min(8, "Informe um WhatsApp válido.").max(40),
  subject: z.string().trim().max(160).optional().default(""),
  message: z.string().trim().max(1800).optional().default(""),
});

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mark_replied"),
    threadId: z.string().uuid(),
    note: z.string().trim().max(500).optional().default(""),
  }),
  z.object({
    action: z.literal("snooze"),
    threadId: z.string().uuid(),
    nextContactAt: z.string().min(10),
  }),
  z.object({
    action: z.literal("reopen"),
    threadId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("close"),
    threadId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("quote_contact"),
    quoteId: z.string().uuid(),
    markContacted: z.boolean().optional().default(false),
    nextContactAt: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal("save_whatsapp_config"),
    enabled: z.boolean(),
    mode: z.enum(["monitor_only", "reply_24h_locked"]),
    phoneNumberId: z.string().trim().max(80).optional().default(""),
    displayPhone: z.string().trim().max(40).optional().default(""),
    alertAfterMinutes: z.coerce.number().int().min(5).max(1440).default(30),
    accessToken: z.string().trim().max(500).optional().default(""),
    appSecret: z.string().trim().max(200).optional().default(""),
    clearAccessToken: z.boolean().optional().default(false),
    clearAppSecret: z.boolean().optional().default(false),
  }),
]);

export async function GET(request: Request) {
  const access = await getManagementAccess(["admin", "comercial", "financeiro", "producao"]);
  if ("response" in access) return access.response;

  const url = new URL(request.url);
  const threadId = url.searchParams.get("threadId");
  const canReadConfig = ["admin", "comercial", "financeiro"].includes(access.role);

  const [threadsResult, quotesResult, configResult, messagesResult] = await Promise.all([
    access.supabase
      .from("whatsapp_threads")
      .select("id, customer_id, quote_id, phone, contact_name, subject, source, status, unread_count, last_message_preview, last_message_direction, last_customer_message_at, last_reply_at, next_contact_at, created_at, updated_at")
      .order("last_customer_message_at", { ascending: false })
      .limit(100),
    access.supabase
      .from("quotes")
      .select("id, number, customer_name, company, phone, service, status, estimated_value, created_at, updated_at, last_contact_at, next_contact_at")
      .in("status", ["novo", "em_analise", "aguardando_cliente"])
      .order("updated_at", { ascending: true })
      .limit(100),
    canReadConfig
      ? access.supabase.rpc("get_organization_whatsapp_config")
      : Promise.resolve({ data: null, error: null }),
    threadId && z.string().uuid().safeParse(threadId).success
      ? access.supabase
          .from("whatsapp_messages")
          .select("id, direction, body, sent_via, created_at")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: true })
          .limit(40)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (threadsResult.error) {
    if (["42P01", "PGRST205"].includes(threadsResult.error.code ?? "")) {
      return Response.json({ threads: [], quotes: [], messages: [], config: null, setupRequired: true });
    }
    return Response.json({ error: "Não foi possível carregar os atendimentos." }, { status: 500 });
  }

  return Response.json({
    threads: threadsResult.data ?? [],
    quotes: quotesResult.data ?? [],
    messages: messagesResult.data ?? [],
    config: configResult.data ?? null,
    canConfigureMeta: access.role === "admin",
    setupRequired: false,
  });
}

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "comercial", "financeiro"], {
    requireActiveSubscription: true,
  });
  if ("response" in access) return access.response;

  const parsed = createThreadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Revise os dados do atendimento." },
      { status: 400 },
    );
  }

  const normalizedPhone = normalizeBrazilianPhone(parsed.data.phone) || parsed.data.phone.replace(/\D/g, "");
  if (normalizedPhone.length < 8) {
    return Response.json({ error: "Informe um WhatsApp válido com DDD." }, { status: 400 });
  }

  const preview = (parsed.data.message || parsed.data.subject || "Atendimento iniciado manualmente").slice(0, 220);
  const nowIso = new Date().toISOString();

  const { data: thread, error } = await access.supabase
    .from("whatsapp_threads")
    .upsert(
      {
        phone: normalizedPhone,
        contact_name: parsed.data.contactName,
        subject: parsed.data.subject || null,
        source: "manual",
        status: "waiting_reply",
        unread_count: 1,
        last_message_preview: preview,
        last_message_direction: "inbound",
        last_customer_message_at: nowIso,
        next_contact_at: null,
      },
      { onConflict: "organization_id,phone" },
    )
    .select("id, contact_name, phone")
    .single();

  if (error || !thread) {
    return Response.json({ error: "Não foi possível registrar o atendimento." }, { status: 500 });
  }

  await access.supabase.from("whatsapp_messages").insert({
    thread_id: thread.id,
    direction: "inbound",
    body: parsed.data.message || parsed.data.subject || "Cliente iniciou atendimento.",
    sent_via: "manual",
    created_by: access.user.id,
  });

  return Response.json({ thread }, { status: 201 });
}

export async function PATCH(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Ação inválida." },
      { status: 400 },
    );
  }

  if (parsed.data.action === "save_whatsapp_config") {
    const access = await getManagementAccess(["admin"]);
    if ("response" in access) return access.response;
    const { data, error } = await access.supabase.rpc("save_organization_whatsapp_config", {
      p_enabled: parsed.data.enabled,
      p_mode: parsed.data.mode,
      p_phone_number_id: parsed.data.phoneNumberId || null,
      p_display_phone: parsed.data.displayPhone || null,
      p_alert_after_minutes: parsed.data.alertAfterMinutes,
      p_access_token: parsed.data.accessToken || null,
      p_app_secret: parsed.data.appSecret || null,
      p_clear_access_token: parsed.data.clearAccessToken,
      p_clear_app_secret: parsed.data.clearAppSecret,
    });
    if (error) {
      return Response.json({ error: error.message || "Não foi possível salvar a configuração." }, { status: 400 });
    }
    return Response.json({ config: data });
  }

  const access = await getManagementAccess(["admin", "comercial", "financeiro"], {
    requireActiveSubscription: true,
  });
  if ("response" in access) return access.response;

  const nowIso = new Date().toISOString();

  if (parsed.data.action === "quote_contact") {
    const updatePayload: Record<string, string | null> = {};
    if (parsed.data.markContacted) updatePayload.last_contact_at = nowIso;
    if (parsed.data.nextContactAt !== undefined) updatePayload.next_contact_at = parsed.data.nextContactAt;
    const { error } = await access.supabase
      .from("quotes")
      .update(updatePayload)
      .eq("id", parsed.data.quoteId);
    if (error) return Response.json({ error: "Não foi possível atualizar o acompanhamento do orçamento." }, { status: 500 });
    return Response.json({ saved: true });
  }

  if (parsed.data.action === "mark_replied") {
    const { error } = await access.supabase
      .from("whatsapp_threads")
      .update({
        status: "replied",
        unread_count: 0,
        last_reply_at: nowIso,
        last_message_direction: "outbound",
        ...(parsed.data.note ? { last_message_preview: parsed.data.note.slice(0, 220) } : {}),
      })
      .eq("id", parsed.data.threadId);
    if (error) return Response.json({ error: "Não foi possível marcar como respondido." }, { status: 500 });
    if (parsed.data.note) {
      await access.supabase.from("whatsapp_messages").insert({
        thread_id: parsed.data.threadId,
        direction: "outbound",
        body: parsed.data.note,
        sent_via: "whatsapp_web",
        created_by: access.user.id,
      });
    }
    return Response.json({ saved: true });
  }

  if (parsed.data.action === "snooze") {
    const target = new Date(parsed.data.nextContactAt);
    if (Number.isNaN(target.getTime())) {
      return Response.json({ error: "Data de retorno inválida." }, { status: 400 });
    }
    const { error } = await access.supabase
      .from("whatsapp_threads")
      .update({
        status: "snoozed",
        unread_count: 0,
        next_contact_at: target.toISOString(),
      })
      .eq("id", parsed.data.threadId);
    if (error) return Response.json({ error: "Não foi possível agendar o retorno." }, { status: 500 });
    return Response.json({ saved: true });
  }

  if (parsed.data.action === "reopen") {
    const { error } = await access.supabase
      .from("whatsapp_threads")
      .update({ status: "waiting_reply", unread_count: 1, next_contact_at: null })
      .eq("id", parsed.data.threadId);
    if (error) return Response.json({ error: "Não foi possível reabrir o atendimento." }, { status: 500 });
    return Response.json({ saved: true });
  }

  const { error } = await access.supabase
    .from("whatsapp_threads")
    .update({ status: "closed", unread_count: 0, next_contact_at: null })
    .eq("id", parsed.data.threadId);
  if (error) return Response.json({ error: "Não foi possível concluir o atendimento." }, { status: 500 });
  return Response.json({ saved: true });
}
