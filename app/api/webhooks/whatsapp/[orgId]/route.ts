import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: Array<{
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
          button?: { text?: string };
          interactive?: {
            button_reply?: { title?: string };
            list_reply?: { title?: string };
          };
          image?: { caption?: string };
          document?: { caption?: string; filename?: string };
        }>;
        message_echoes?: Array<{
          id?: string;
          to?: string;
          type?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
};

function describeMetaMessage(message: {
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  image?: { caption?: string };
  document?: { caption?: string; filename?: string };
}): string {
  if (message.text?.body) return message.text.body;
  if (message.button?.text) return message.button.text;
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title;
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title;
  if (message.image?.caption) return `[Imagem] ${message.image.caption}`;
  if (message.document?.caption) return `[Documento] ${message.document.caption}`;
  if (message.document?.filename) return `[Documento] ${message.document.filename}`;
  const kindLabels: Record<string, string> = {
    image: "[Imagem enviada pelo cliente]",
    audio: "[Áudio enviado pelo cliente]",
    video: "[Vídeo enviado pelo cliente]",
    document: "[Documento enviado pelo cliente]",
    sticker: "[Figurinha]",
    location: "[Localização compartilhada]",
  };
  return kindLabels[message.type ?? ""] ?? "[Mensagem recebida no WhatsApp]";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const orgId = (await context.params).orgId ?? "";
  if (!z.string().uuid().safeParse(orgId).success) {
    return new Response("Invalid organization", { status: 400 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  if (mode !== "subscribe" || !challenge || !verifyToken) {
    return new Response("Forbidden", { status: 403 });
  }

  const { data: verified, error } = await createPublicClient().rpc("verify_meta_whatsapp_webhook", {
    p_organization_id: orgId,
    p_verify_token: verifyToken,
  });

  if (error || !verified) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const orgId = (await context.params).orgId ?? "";
  if (!z.string().uuid().safeParse(orgId).success) {
    return Response.json({ error: "Invalid organization" }, { status: 400 });
  }

  const rawBody = await request.text();
  if (!rawBody || rawBody.length > 512_000) {
    return Response.json({ error: "Payload inválido" }, { status: 400 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  let phoneNumberId = "";
  const events: Array<{
    phone: string;
    contactName: string;
    body: string;
    direction: "inbound" | "outbound";
    messageId: string;
  }> = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      if (value.metadata?.phone_number_id) {
        phoneNumberId = value.metadata.phone_number_id;
      }

      const contactNames = new Map<string, string>();
      for (const contact of value.contacts ?? []) {
        if (contact.wa_id && contact.profile?.name) {
          contactNames.set(contact.wa_id, contact.profile.name);
        }
      }

      for (const message of value.messages ?? []) {
        if (!message.from) continue;
        events.push({
          phone: message.from,
          contactName: contactNames.get(message.from) ?? message.from,
          body: describeMetaMessage(message),
          direction: "inbound",
          messageId: message.id ?? "",
        });
      }

      for (const echo of value.message_echoes ?? []) {
        if (!echo.to) continue;
        events.push({
          phone: echo.to,
          contactName: echo.to,
          body: echo.text?.body || "[Resposta enviada pelo WhatsApp Business]",
          direction: "outbound",
          messageId: echo.id ?? "",
        });
      }
    }
  }

  if (events.length === 0) {
    return Response.json({ received: true, processed: 0 });
  }

  const signature = request.headers.get("x-hub-signature-256") ?? null;
  const { data, error } = await createPublicClient().rpc("process_meta_whatsapp_webhook", {
    p_organization_id: orgId,
    p_phone_number_id: phoneNumberId || null,
    p_signature_256: signature,
    p_raw_body: rawBody,
    p_events: events,
  });

  if (error) {
    const status = error.message?.includes("Assinatura") ? 401 : 400;
    return Response.json({ error: error.message || "Falha ao processar webhook" }, { status });
  }

  return Response.json({ received: true, ...(typeof data === "object" && data ? data : {}) });
}
