import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";
import { cancelAsaasSubscriptionIfPresent, isAsaasConfigured } from "@/lib/asaas";

export const dynamic = "force-dynamic";

const cancelSchema = z.object({
  reason: z.string().trim().max(240).optional().default(""),
});

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin"]);
  if ("response" in access) return access.response;

  let rawBody: unknown = {};
  try {
    rawBody = await request.json();
  } catch {
    rawBody = {};
  }

  const parsed = cancelSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json({ error: "Motivo de cancelamento inválido." }, { status: 400 });
  }

  const { data: currentSub } = await access.supabase
    .from("organization_subscriptions")
    .select("provider_subscription_id, status, cancel_at_period_end")
    .eq("organization_id", access.organizationId)
    .maybeSingle();

  if (!currentSub) {
    return Response.json({ error: "Assinatura não encontrada." }, { status: 404 });
  }

  if (currentSub.provider_subscription_id && isAsaasConfigured()) {
    await cancelAsaasSubscriptionIfPresent(currentSub.provider_subscription_id);
  }

  const { data, error } = await access.supabase.rpc("mark_organization_subscription_canceled", {
    p_reason: parsed.data.reason || null,
  });

  if (error) {
    return Response.json({ error: error.message || "Não foi possível cancelar a renovação." }, { status: 400 });
  }

  return Response.json({ canceled: true, subscription: data });
}
