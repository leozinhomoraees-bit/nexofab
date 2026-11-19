import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ManagementDashboard } from "./management-dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ManagementPage({ searchParams }: { searchParams: Promise<{ secao?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const requestedSection = (await searchParams).secao;
  return <ManagementDashboard userName={profile?.full_name || user.email || "Equipe"} initialSection={requestedSection || "visao-geral"} />;
}
