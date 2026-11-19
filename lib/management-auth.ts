import { createClient } from "@/lib/supabase/server";

export async function getManagementAccess(roles?: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: Response.json({ error: "Acesso não autorizado" }, { status: 401 }) };

  const { data: profile } = await supabase.from("profiles").select("active, active_organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.active || !profile.active_organization_id) {
    return { response: Response.json({ error: "Selecione uma empresa ativa para continuar" }, { status: 403 }) };
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", profile.active_organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = membership?.role === "owner" ? "admin" : membership?.role;
  if (membership?.status !== "active" || !role || (roles && !roles.includes(role))) {
    return { response: Response.json({ error: "Seu perfil não possui acesso a esta área" }, { status: 403 }) };
  }

  return { supabase, user, role, organizationId: profile.active_organization_id as string };
}
