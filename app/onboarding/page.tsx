import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configurar empresa | NexoFab", robots: { index: false, follow: false } };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const { data: profile } = await supabase.from("profiles").select("full_name, active_organization_id").eq("id", user.id).maybeSingle();
  if (profile?.active_organization_id) redirect("/gestao");

  const { data: memberships } = await supabase.from("organization_members").select("organization_id, role").eq("user_id", user.id).eq("status", "active");
  const ids = (memberships ?? []).map((membership) => membership.organization_id);
  const { data: organizations } = ids.length
    ? await supabase.from("organizations").select("id, trade_name").in("id", ids).order("trade_name")
    : { data: [] };

  return <OnboardingForm userName={profile?.full_name || user.email || "Você"} organizations={organizations ?? []}/>;
}
