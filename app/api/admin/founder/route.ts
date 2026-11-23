import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const extendTrialSchema = z.object({
  action: z.literal("extend_trial"),
  organizationId: z.string().uuid("Organização inválida."),
  extraDays: z.coerce.number().int().min(1, "Mínimo de 1 dia.").max(90, "Máximo de 90 dias."),
  reason: z.string().trim().max(200, "Motivo muito longo.").optional().default(""),
});

async function requireFounderAccess() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { response: Response.json({ error: "Autenticação obrigatória." }, { status: 401 }) };
  }

  const { data: isAdmin, error } = await supabase.rpc("is_platform_admin");
  if (error || !isAdmin) {
    return { response: Response.json({ error: "Não encontrado." }, { status: 404 }) };
  }

  return { supabase, user };
}

export async function GET() {
  const access = await requireFounderAccess();
  if ("response" in access) return access.response;

  const { data, error } = await access.supabase.rpc("get_founder_dashboard");
  if (error || !data) {
    return Response.json({ error: "Não foi possível carregar o painel do fundador." }, { status: 500 });
  }

  return Response.json({ dashboard: data });
}

export async function POST(request: Request) {
  const access = await requireFounderAccess();
  if ("response" in access) return access.response;

  const parsed = extendTrialSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const { data, error } = await access.supabase.rpc("founder_extend_trial", {
    p_organization_id: parsed.data.organizationId,
    p_extra_days: parsed.data.extraDays,
    p_reason: parsed.data.reason || null,
  });

  if (error) {
    return Response.json(
      { error: error.message || "Não foi possível estender o período de teste." },
      { status: 400 },
    );
  }

  return Response.json({ updated: true, result: data });
}
