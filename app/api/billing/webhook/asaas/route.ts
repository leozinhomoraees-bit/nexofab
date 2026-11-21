import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

const webhookSchema = z.object({
  id: z.string().trim().min(1).max(160).optional(),
  event: z.string().trim().min(2).max(100),
  payment: z.object({
    id: z.string().trim().max(120).optional(),
    customer: z.string().trim().max(120).optional(),
    subscription: z.string().trim().max(120).nullable().optional(),
    externalReference: z.string().trim().max(120).nullable().optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    invoiceUrl: z.string().url().max(500).nullable().optional(),
    bankSlipUrl: z.string().url().max(500).nullable().optional(),
  }).passthrough().optional(),
  subscription: z.object({
    id: z.string().trim().max(120).optional(),
    customer: z.string().trim().max(120).optional(),
    externalReference: z.string().trim().max(120).nullable().optional(),
  }).passthrough().optional(),
}).passthrough();

function tokensMatch(expected: string, provided: string) {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!expectedToken) {
    return Response.json({ error: "Webhook não configurado." }, { status: 503 });
  }

  const providedToken = request.headers.get("asaas-access-token")?.trim() ?? "";
  if (!providedToken || !tokensMatch(expectedToken, providedToken)) {
    return Response.json({ error: "Assinatura do webhook inválida." }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json({ error: "Formato de evento Asaas inválido." }, { status: 400 });
  }

  const payload = parsed.data;
  const providerEventId =
    payload.id ||
    `${payload.event}:${payload.payment?.id ?? payload.subscription?.id ?? "unknown"}:${payload.payment?.dueDate ?? ""}`;

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("process_asaas_webhook_event", {
    p_webhook_token: providedToken,
    p_provider_event_id: providerEventId,
    p_event_type: payload.event,
    p_provider_subscription_id: payload.payment?.subscription ?? payload.subscription?.id ?? null,
    p_provider_customer_id: payload.payment?.customer ?? payload.subscription?.customer ?? null,
    p_external_reference: payload.payment?.externalReference ?? payload.subscription?.externalReference ?? null,
    p_payment_due_date: payload.payment?.dueDate ?? null,
    p_invoice_url: payload.payment?.invoiceUrl ?? payload.payment?.bankSlipUrl ?? null,
    p_payload: rawBody,
  });

  if (error) {
    console.error("Asaas webhook RPC failed", error.message);
    const status = error.message.includes("não autorizado") ? 401 : 500;
    return Response.json({ error: "Não foi possível processar o evento." }, { status });
  }

  return Response.json({ received: true, result: data });
}
