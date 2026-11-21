import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

const itemSchema = z.object({ name: z.string().trim().min(2).max(160), sku: z.string().trim().max(60).optional(), category: z.string().trim().max(80).optional(), unit: z.string().trim().min(1).max(20), currentQuantity: z.coerce.number().min(0), minimumQuantity: z.coerce.number().min(0), averageCost: z.coerce.number().min(0) });
const adjustmentSchema = z.object({ id: z.string().uuid(), quantity: z.coerce.number().min(0), notes: z.string().trim().max(300).optional() });

export async function GET() {
  const access = await getManagementAccess();
  if ("response" in access) return access.response;
  const { data, error } = await access.supabase.from("inventory_items").select("id, sku, name, category, unit, current_quantity, minimum_quantity, average_cost").eq("active", true).order("name");
  if (error) return Response.json({ error: "Não foi possível carregar o estoque." }, { status: 500 });
  return Response.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "estoque"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;
  const parsed = itemSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Confira os dados do item." }, { status: 400 });
  const input = parsed.data;
  const { error } = await access.supabase.from("inventory_items").insert({ name: input.name, sku: input.sku || null, category: input.category || null, unit: input.unit, current_quantity: input.currentQuantity, minimum_quantity: input.minimumQuantity, average_cost: input.averageCost });
  if (error) return Response.json({ error: "Não foi possível cadastrar o item. Confira se o SKU já existe." }, { status: 500 });
  return Response.json({ saved: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await getManagementAccess(["admin", "estoque"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;
  const parsed = adjustmentSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Ajuste de estoque inválido." }, { status: 400 });
  const { data: item } = await access.supabase.from("inventory_items").select("current_quantity").eq("id", parsed.data.id).single();
  if (!item) return Response.json({ error: "Item não encontrado." }, { status: 404 });
  const difference = parsed.data.quantity - Number(item.current_quantity);
  const { error } = await access.supabase.from("inventory_items").update({ current_quantity: parsed.data.quantity }).eq("id", parsed.data.id);
  if (error) return Response.json({ error: "Não foi possível ajustar o estoque." }, { status: 500 });
  if (difference !== 0) await access.supabase.from("stock_movements").insert({ inventory_item_id: parsed.data.id, movement_type: "ajuste", quantity: Math.abs(difference), notes: parsed.data.notes || "Ajuste manual", created_by: access.user.id });
  return Response.json({ saved: true });
}
