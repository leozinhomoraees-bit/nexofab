import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";
const optional = (max: number) => z.string().trim().max(max).optional().default("");
const itemSchema = z.object({
  id: z.string().uuid().optional(), code: optional(80), category: optional(120),
  description: z.string().trim().min(2).max(300), specification: optional(3000),
  unit: z.string().trim().min(1).max(20), referenceCost: z.coerce.number().min(0).max(99999999),
  marginPercent: z.coerce.number().min(0).max(94), taxPercent: z.coerce.number().min(0).max(94),
  referencePrice: z.coerce.number().min(0).max(99999999), sourceNote: optional(500),
}).refine((value) => value.marginPercent + value.taxPercent < 95, { message: "Margem e impostos somados devem ser menores que 95%." });

const row = (input: z.infer<typeof itemSchema>, userId?: string) => ({
  code: input.code || null, category: input.category || null, description: input.description,
  specification: input.specification || null, unit: input.unit, reference_cost: input.referenceCost,
  margin_percent: input.marginPercent, tax_percent: input.taxPercent, reference_price: input.referencePrice,
  source_note: input.sourceNote || null, ...(userId ? { created_by: userId } : {}),
});

export async function GET() {
  const access = await getManagementAccess(["admin", "comercial", "financeiro"]);
  if ("response" in access) return access.response;
  const { data, error } = await access.supabase.from("tender_items").select("*").eq("active", true).order("category").order("description");
  if (error) return Response.json({ error: "Não foi possível carregar os itens de licitação. Aplique a nova migração no Supabase." }, { status: 500 });
  return Response.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "comercial"]);
  if ("response" in access) return access.response;
  const parsed = itemSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Confira os dados do item." }, { status: 400 });
  const { error } = await access.supabase.from("tender_items").insert(row(parsed.data, access.user.id));
  if (error) return Response.json({ error: error.code === "23505" ? "Já existe um item com este código." : "Não foi possível cadastrar o item." }, { status: 500 });
  return Response.json({ saved: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await getManagementAccess(["admin", "comercial"]);
  if ("response" in access) return access.response;
  const parsed = itemSchema.safeParse(await request.json());
  if (!parsed.success || !parsed.data.id) return Response.json({ error: parsed.success ? "Item inválido." : parsed.error.issues[0]?.message }, { status: 400 });
  const { error } = await access.supabase.from("tender_items").update(row(parsed.data)).eq("id", parsed.data.id);
  if (error) return Response.json({ error: "Não foi possível atualizar o item." }, { status: 500 });
  return Response.json({ saved: true });
}

export async function DELETE(request: Request) {
  const access = await getManagementAccess(["admin", "comercial"]);
  if ("response" in access) return access.response;
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) return Response.json({ error: "Item inválido." }, { status: 400 });
  const { error } = await access.supabase.from("tender_items").update({ active: false }).eq("id", id);
  if (error) return Response.json({ error: "Não foi possível arquivar o item." }, { status: 500 });
  return Response.json({ saved: true });
}
