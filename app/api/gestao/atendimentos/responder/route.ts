import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";

const replySchema = z.object({
  threadId: z.string().uuid("Atendimento inválido."),
  message: z.string().trim().min(1, "Digite uma mensagem.").max(1800, "Mensagem muito longa."),
});

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "comercial", "financeiro"], {
    requireActiveSubscription: true,
  });
  if ("response" in access) return access.response;

  const parsed = replySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  // Trava rígida de 24h aplicada no banco antes de qualquer chamada à Meta Cloud API
  const { data: prepared, error: prepError } = await access.supabase.rpc("prepare_meta_whatsapp_reply", {
    p_thread_id: parsed.data.threadId,
  });

  if (prepError || !prepared) {
    return Response.json(
      { error: prepError?.message || "Envio bloqueado pela trava de segurança de 24h." },
      { status: 409 },
    );
  }

  const config = prepared as {
    phoneNumberId: string;
    accessToken: string;
    toPhone: string;
  };

  // Envia EXCLUSIVAMENTE mensagem de texto livre dentro da janela de 24h (nunca templates pagos!)
  const metaResponse = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(config.phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: config.toPhone,
        type: "text",
        text: {
          preview_url: false,
          body: parsed.data.message,
        },
      }),
    },
  );

  const metaPayload = (await metaResponse.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };

  if (!metaResponse.ok) {
    return Response.json(
      { error: metaPayload.error?.message || "A Meta recusou o envio da mensagem. Tente pelo WhatsApp Web." },
      { status: 502 },
    );
  }

  const providerMessageId = metaPayload.messages?.[0]?.id ?? null;
  const nowIso = new Date().toISOString();

  await Promise.all([
    access.supabase.from("whatsapp_messages").insert({
      thread_id: parsed.data.threadId,
      provider_message_id: providerMessageId,
      direction: "outbound",
      body: parsed.data.message,
      sent_via: "meta_api",
      created_by: access.user.id,
    }),
    access.supabase
      .from("whatsapp_threads")
      .update({
        status: "replied",
        unread_count: 0,
        last_reply_at: nowIso,
        last_message_direction: "outbound",
        last_message_preview: parsed.data.message.slice(0, 220),
      })
      .eq("id", parsed.data.threadId),
  ]);

  return Response.json({ sent: true, providerMessageId });
}
