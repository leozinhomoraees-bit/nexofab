import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";

const memberActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("role"),
    userId: z.string().uuid(),
    role: z.enum(["admin", "comercial", "producao", "estoque", "financeiro"]),
  }),
  z.object({
    action: z.literal("status"),
    userId: z.string().uuid(),
    status: z.enum(["active", "suspended"]),
  }),
]);

export async function PATCH(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = memberActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json({ error: "Parâmetros de membro inválidos." }, { status: 400 });
  }

  // Permite suspender mesmo em modo leitura por segurança; reativar ou alterar função exige assinatura ativa.
  const needsActiveSub = !(parsed.data.action === "status" && parsed.data.status === "suspended");
  const access = await getManagementAccess(["admin"], { requireActiveSubscription: needsActiveSub });
  if ("response" in access) return access.response;

  if (parsed.data.action === "role") {
    const { data, error } = await access.supabase.rpc("update_organization_member_role", {
      p_user_id: parsed.data.userId,
      p_role: parsed.data.role,
    });
    if (error) {
      return Response.json({ error: error.message || "Não foi possível alterar a função." }, { status: 400 });
    }
    return Response.json({ member: data });
  }

  const { data, error } = await access.supabase.rpc("set_organization_member_status", {
    p_user_id: parsed.data.userId,
    p_status: parsed.data.status,
  });
  if (error) {
    const status = error.message.includes("Limite de usuários") ? 403 : 400;
    return Response.json({ error: error.message || "Não foi possível alterar o status do membro." }, { status });
  }
  return Response.json({ member: data });
}
