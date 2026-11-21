import { getManagementAccess } from "@/lib/management-auth";
import { getOrganizationSubscriptionSummary, type BillingPlanRecord } from "@/lib/billing";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getManagementAccess();
  if ("response" in access) return access.response;

  const isAdmin = access.role === "admin";
  const [{ record, summary }, plansResult, membersResult, auditResult] = await Promise.all([
    getOrganizationSubscriptionSummary(access.supabase, access.organizationId),
    access.supabase
      .from("plans")
      .select("id, name, description, billing_cycle, price_cents, monthly_price_cents, discount_percent, sort_order, entitlements, active")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("price_cents", { ascending: true }),
    isAdmin
      ? access.supabase
        .from("organization_members")
        .select("user_id", { count: "exact", head: true })
        .eq("organization_id", access.organizationId)
        .eq("status", "active")
      : Promise.resolve({ count: null }),
    isAdmin
      ? access.supabase
        .from("subscription_audit_logs")
        .select("id, event_type, previous_status, next_status, details, created_at")
        .eq("organization_id", access.organizationId)
        .order("created_at", { ascending: false })
        .limit(15)
      : Promise.resolve({ data: [] }),
  ]);

  const plans = (plansResult.data ?? []) as BillingPlanRecord[];
  const currentPlan = record?.plan_id ? plans.find((plan) => plan.id === record.plan_id) ?? null : null;

  return Response.json({
    subscription: summary,
    rawSubscription: isAdmin ? record : null,
    currentPlan,
    plans: isAdmin ? plans : [],
    usage: {
      activeMembers: membersResult.count ?? null,
      maxUsers: currentPlan?.entitlements?.max_users ?? null,
    },
    auditLogs: isAdmin ? (auditResult.data ?? []) : [],
    provider: {
      id: "asaas",
      name: "Asaas",
      checkoutEnabled: false,
      paymentMethods: ["PIX", "Boleto bancário", "Cartão de crédito"],
    },
  });
}
