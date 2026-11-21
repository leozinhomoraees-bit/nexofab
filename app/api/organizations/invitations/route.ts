import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";

const inviteSchema = z.object({
  email: z.string().trim().email().max(180),
  role: z.enum(["admin", "comercial", "producao", "estoque", "financeiro"]),
});
const revokeSchema = z.object({ invitationId: z.string().uuid() });

export async function GET() {
  const access = await getManagementAccess(["admin"]);
  if ("response" in access) return access.response;

  const [{ data: memberships, error: memberError }, { data: invitations, error: invitationError }] = await Promise.all([
    access.supabase.from("organization_members").select("user_id, role, status, created_at").eq("organization_id", access.organizationId).order("created_at"),
    access.supabase.from("organization_invitations").select("id, email, role, status, expires_at, created_at").eq("organization_id", access.organizationId).in("status", ["pending", "accepted"]).order("created_at", { ascending: false }),
  ]);
  if (memberError || invitationError) return Response.json({ error: "Não foi possível carregar a equipe." }, { status: 500 });

  const userIds = (memberships ?? []).map((membership) => membership.user_id);
  const { data: profiles } = userIds.length
    ? await access.supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return Response.json({
    currentUserId: access.user.id,
    maxUsers: 10,
    members: (memberships ?? []).map((membership) => ({
      ...membership,
      full_name: profileById.get(membership.user_id)?.full_name ?? "Usuário",
    })),
    invitations: invitations ?? [],
  });
}

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;
  const parsed = inviteSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Revise o e-mail e a função do convite." }, { status: 400 });

  const { data, error } = await access.supabase.rpc("create_organization_invitation", {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error || !data) {
    if (error?.message.includes("Limite de usuários")) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    return Response.json({ error: "Não foi possível criar o convite." }, { status: 500 });
  }
  return Response.json({ invitation: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const access = await getManagementAccess(["admin"]);
  if ("response" in access) return access.response;
  const parsed = revokeSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Convite inválido." }, { status: 400 });

  const { error } = await access.supabase.rpc("revoke_organization_invitation", { p_invitation_id: parsed.data.invitationId });
  if (error) return Response.json({ error: "Não foi possível revogar o convite." }, { status: 500 });
  return Response.json({ revoked: true });
}
