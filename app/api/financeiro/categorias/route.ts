import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";

const categorySchema = z.object({
  entity: z.literal("category"),
  name: z.string().trim().min(2, "Informe o nome da categoria.").max(80, "Nome muito longo."),
  classification: z.enum(["fixo", "variavel", "investimento", "imposto", "financeiro"]),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const costCenterSchema = z.object({
  entity: z.literal("costCenter"),
  name: z.string().trim().min(2, "Informe o nome do centro de custo.").max(80, "Nome muito longo."),
  code: z.string().trim().max(16, "Código muito longo.").optional().default(""),
});

const createCatalogSchema = z.discriminatedUnion("entity", [categorySchema, costCenterSchema]);

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "financeiro"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;

  const parsed = createCatalogSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos para o cadastro." },
      { status: 400 },
    );
  }

  if (parsed.data.entity === "category") {
    const { data, error } = await access.supabase
      .from("expense_categories")
      .insert({
        name: parsed.data.name,
        classification: parsed.data.classification,
        color: parsed.data.color ?? "#0e8b81",
        active: true,
      })
      .select("id, name, classification, color")
      .single();

    if (error) {
      if (error.code === "23505") {
        return Response.json({ error: "Já existe uma categoria com esse nome." }, { status: 409 });
      }
      return Response.json({ error: "Não foi possível criar a categoria." }, { status: 500 });
    }
    return Response.json({ category: data }, { status: 201 });
  }

  const normalizedCode = parsed.data.code.trim().toUpperCase() || null;
  const { data, error } = await access.supabase
    .from("cost_centers")
    .insert({
      name: parsed.data.name,
      code: normalizedCode,
      active: true,
    })
    .select("id, name, code")
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "Já existe um centro de custo com esse nome ou código." }, { status: 409 });
    }
    return Response.json({ error: "Não foi possível criar o centro de custo." }, { status: 500 });
  }
  return Response.json({ costCenter: data }, { status: 201 });
}
