import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";

const templateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional().default(""),
  category: z.string().trim().min(2).max(80).optional().default("personalizado"),
  itemPayload: z.record(z.string(), z.unknown()),
}).superRefine((data, context) => {
  if (JSON.stringify(data.itemPayload).length > 180000) context.addIssue({ code: "custom", path: ["itemPayload"], message: "A composição é grande demais para ser salva como modelo." });
});

export async function GET() {
  const access = await getManagementAccess(["admin", "comercial", "financeiro", "producao", "estoque"]);
  if ("response" in access) return access.response;
  const { data, error } = await access.supabase.from("quote_composition_templates").select("id, name, description, category, item_payload, updated_at").eq("active", true).order("name");
  if (error) return Response.json({ error: "Aplique a migração de modelos de orçamento no Supabase para liberar esta função." }, { status: 500 });
  return Response.json({ templates: data ?? [] });
}

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "comercial"]);
  if ("response" in access) return access.response;
  const parsed = templateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Confira os dados do modelo." }, { status: 400 });
  const { data, error } = await access.supabase.from("quote_composition_templates").insert({
    name: parsed.data.name,
    description: parsed.data.description || null,
    category: parsed.data.category,
    item_payload: parsed.data.itemPayload,
    created_by: access.user.id,
  }).select("id, name, description, category, item_payload, updated_at").single();
  if (error) return Response.json({ error: error.code === "23505" ? "Já existe um modelo ativo com esse nome." : "Não foi possível salvar o modelo de composição." }, { status: 500 });
  return Response.json({ template: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const access = await getManagementAccess(["admin", "comercial"]);
  if ("response" in access) return access.response;
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Modelo inválido." }, { status: 400 });
  const { error } = await access.supabase.from("quote_composition_templates").update({ active: false }).eq("id", parsed.data.id);
  if (error) return Response.json({ error: "Não foi possível remover o modelo." }, { status: 500 });
  return Response.json({ removed: true });
}
