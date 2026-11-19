import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const createSchema = z.object({ tradeName: z.string().trim().min(2).max(120) });
const switchSchema = z.object({ organizationId: z.string().uuid() });

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await authenticatedClient();
  if (!user) return Response.json({ error: "Acesso não autorizado" }, { status: 401 });

  const [{ data: profile }, { data: memberships, error }] = await Promise.all([
    supabase.from("profiles").select("active_organization_id").eq("id", user.id).maybeSingle(),
    supabase.from("organization_members").select("organization_id, role, status").eq("user_id", user.id).eq("status", "active"),
  ]);
  if (error) return Response.json({ error: "Não foi possível carregar suas empresas." }, { status: 500 });

  const ids = (memberships ?? []).map((membership) => membership.organization_id);
  const { data: organizations } = ids.length
    ? await supabase.from("organizations").select("id, trade_name, logo_url").in("id", ids).order("trade_name")
    : { data: [] };
  const organizationById = new Map((organizations ?? []).map((organization) => [organization.id, organization]));

  return Response.json({
    activeOrganizationId: profile?.active_organization_id ?? null,
    organizations: (memberships ?? []).map((membership) => ({
      ...organizationById.get(membership.organization_id),
      id: membership.organization_id,
      role: membership.role,
    })).filter((organization) => organization.trade_name),
  });
}

export async function POST(request: Request) {
  const { supabase, user } = await authenticatedClient();
  if (!user) return Response.json({ error: "Acesso não autorizado" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Informe um nome de empresa válido." }, { status: 400 });

  const { data, error } = await supabase.rpc("create_organization", { p_trade_name: parsed.data.tradeName });
  if (error || !data) return Response.json({ error: "Não foi possível criar a empresa." }, { status: 500 });
  return Response.json({ organizationId: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await authenticatedClient();
  if (!user) return Response.json({ error: "Acesso não autorizado" }, { status: 401 });
  const parsed = switchSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Empresa inválida." }, { status: 400 });

  const { error } = await supabase.rpc("set_active_organization", { p_organization_id: parsed.data.organizationId });
  if (error) return Response.json({ error: "Você não possui acesso a esta empresa." }, { status: 403 });
  return Response.json({ activeOrganizationId: parsed.data.organizationId });
}
