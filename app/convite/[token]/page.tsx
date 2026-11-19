import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcceptInvitation } from "./accept-invitation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aceitar convite | NexoFab", robots: { index: false, follow: false } };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/i.test(token)) redirect("/login");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/convite/${token}`)}`);
  return <AcceptInvitation token={token} email={user.email || "sua conta"}/>;
}
