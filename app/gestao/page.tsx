import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrganizationSubscriptionSummary } from "@/lib/billing";
import { ManagementDashboard } from "./management-dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ManagementPage({ searchParams }: { searchParams: Promise<{ secao?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, active_organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.active_organization_id) redirect("/onboarding");

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");
  const organizationIds = (memberships ?? []).map((membership) => membership.organization_id);
  const activeMembership = (memberships ?? []).find((membership) => membership.organization_id === profile.active_organization_id);
  const [{ data: organizations }, { summary: subscriptionSummary }] = await Promise.all([
    organizationIds.length
      ? supabase.from("organizations").select("id, trade_name").in("id", organizationIds).order("trade_name")
      : Promise.resolve({ data: [] }),
    getOrganizationSubscriptionSummary(supabase, profile.active_organization_id),
  ]);

  const requestedSection = (await searchParams).secao;
  return <ManagementDashboard
    userName={profile.full_name || user.email || "Equipe"}
    initialSection={requestedSection || "visao-geral"}
    activeOrganizationId={profile.active_organization_id}
    activeRole={activeMembership?.role ?? "member"}
    organizations={organizations ?? []}
    subscriptionSummary={subscriptionSummary}
  />;
}
