import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FounderDashboard, type FounderDashboardData } from "./founder-dashboard";
import "./admin.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Painel do Fundador | NexoFab",
  robots: { index: false, follow: false },
};

export default async function FounderAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: isAdmin, error: checkError } = await supabase.rpc("is_platform_admin");
  if (checkError || !isAdmin) notFound();

  const { data, error } = await supabase.rpc("get_founder_dashboard");
  if (error || !data) notFound();

  return (
    <FounderDashboard
      founderEmail={user.email ?? "Fundador"}
      initialData={data as FounderDashboardData}
    />
  );
}
