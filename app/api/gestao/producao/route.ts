import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";
import { ensureApprovedProductionOrders } from "@/lib/production-reminders";

const stageSchema = z.object({
  id: z.string().uuid(),
  stage: z.enum(["briefing", "arte", "aprovacao", "producao", "acabamento", "expedicao", "instalacao", "concluido", "cancelado"]).optional(),
  priority: z.enum(["baixa", "normal", "alta", "urgente"]).optional(),
  dueAt: z.string().nullable().optional(),
  scheduledStartAt: z.string().nullable().optional(),
  responsibleId: z.string().uuid().nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  allowNegativeStock: z.boolean().optional(),
  stockOverrideReason: z.string().trim().max(500).nullable().optional(),
}).refine((value) => value.stage !== undefined || value.priority !== undefined || value.dueAt !== undefined || value.scheduledStartAt !== undefined || value.responsibleId !== undefined || value.description !== undefined, { message: "Nenhuma alteração informada." });

const actualEntrySchema = z.object({
  orderId: z.string().uuid(),
  entryType: z.enum(["mao_obra", "maquina", "material", "perda", "retrabalho", "terceiro", "outro"]),
  description: z.string().trim().min(2).max(240),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().min(1).max(20),
  unitCost: z.coerce.number().min(0),
  notes: z.string().trim().max(500).optional(),
});

type StoredStockUsage = { materialId?: string; materialName?: string; quantity?: number; unit?: string; source?: string };
type StoredPricingSnapshot = {
  specialProjectKind?: string;
  projectInput?: { kind?: string; quantity?: number; widthMm?: number; heightMm?: number; adhesiveSides?: number; adhesiveLengthM?: number; wastePercent?: number };
  stockUsages?: StoredStockUsage[];
};
type RollMaterial = { id: string; name?: string | null; category?: string | null; format?: string | null; width_mm?: number | null; usable_width_mm?: number | null; default_waste_percent?: number | null };

function optimizedAdhesiveLength(snapshot: StoredPricingSnapshot | null, usage: StoredStockUsage, material?: RollMaterial, fallback?: { quantity?: number; width_mm?: number | null; height_mm?: number | null }) {
  const input = snapshot?.projectInput;
  const existing = Number(usage.quantity ?? 0);
  const materialFormat = String(material?.format ?? "").toLowerCase();
  const materialCategory = String(material?.category ?? "").toLowerCase();
  const isLinearVinyl = Boolean(material && /rolo|metro/.test(materialFormat) && (materialCategory === "vinil" || /adesivo|vinil|lamina|m[aá]scara/i.test(String(material.name ?? usage.materialName ?? ""))));
  if (!isLinearVinyl || usage.unit !== "m" || Number(input?.adhesiveLengthM) > 0 || !material) return existing;
  const rollWidth = Number(material.usable_width_mm || material.width_mm || 0);
  const width = Number(input?.widthMm || fallback?.width_mm || 0), height = Number(input?.heightMm || fallback?.height_mm || 0);
  const quantity = Math.max(1, Number(input?.quantity || fallback?.quantity || 1)) * Math.max(1, Math.min(2, Number(input?.adhesiveSides || 1)));
  if (!rollWidth || !width || !height) return existing;
  const layouts = [{ across: width, advance: height }, { across: height, advance: width }]
    .filter((layout) => layout.across <= rollWidth)
    .map((layout) => Math.ceil(quantity / Math.max(1, Math.floor(rollWidth / layout.across))) * layout.advance / 1000);
  if (!layouts.length) return existing;
  // A sobra lateral já está embutida no encaixe por faixa. Não some aqui a
  // "perda de precificação" do insumo: ela compõe custo, mas não representa
  // metros efetivamente retirados do rolo no chão de fábrica.
  const optimized = Math.min(...layouts);
  return existing > 0 ? Math.min(existing, optimized) : optimized;
}

export async function GET() {
  const access = await getManagementAccess();
  if ("response" in access) return access.response;
  if (["admin", "comercial", "producao"].includes(access.role)) await ensureApprovedProductionOrders(access.supabase, access.user.id);
  const detailed = await access.supabase.from("production_orders")
    .select("id, number, quote_id, title, description, stage, priority, due_at, scheduled_start_at, responsible_id, started_at, completed_at, created_at, updated_at, quotes(id, number, customer_name, company, phone, email, service, details, internal_notes, estimated_value, delivery_days, payment_terms, installation_included, quote_items(id, description, service_type, material, width_mm, height_mm, depth_mm, quantity, unit, production_notes, pricing_snapshot, sort_order, selected_by_customer)), production_material_reservations(id, inventory_item_id, planned_quantity, reserved_quantity, consumed_quantity, unit, status, inventory_items(id, name, current_quantity, unit, average_cost)), production_actual_entries(id, entry_type, description, quantity, unit, unit_cost, total_cost, notes, occurred_at)")
    .order("created_at", { ascending: false });
  let data: unknown[] | null = detailed.data;
  if (detailed.error && ["42P01", "PGRST200", "PGRST205"].includes(detailed.error.code)) {
    const fallback = await access.supabase.from("production_orders")
      .select("id, number, quote_id, title, description, stage, priority, due_at, started_at, completed_at, created_at, updated_at, quotes(id, number, customer_name, company, phone, email, service, details, internal_notes, estimated_value, delivery_days, payment_terms, installation_included, quote_items(id, description, service_type, material, width_mm, height_mm, depth_mm, quantity, unit, production_notes, pricing_snapshot, sort_order, selected_by_customer))")
      .order("created_at", { ascending: false });
    if (fallback.error) return Response.json({ error: "Não foi possível carregar a produção." }, { status: 500 });
    data = fallback.data;
  } else if (detailed.error) return Response.json({ error: "Não foi possível carregar a produção." }, { status: 500 });
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const snapshotMaterialIds = [...new Set(rows.flatMap((row) => {
    const relation = row.quotes as Record<string, unknown> | Array<Record<string, unknown>> | null;
    const quote = Array.isArray(relation) ? relation[0] : relation;
    const items = (quote?.quote_items ?? []) as Array<{ quantity?: number; width_mm?: number | null; height_mm?: number | null; pricing_snapshot?: StoredPricingSnapshot | null; selected_by_customer?: boolean | null }>;
    return items.filter((item) => item.selected_by_customer !== false).flatMap((item) => (item.pricing_snapshot?.stockUsages ?? []).map((usage) => usage.materialId).filter((id): id is string => Boolean(id)));
  }))];
  const { data: snapshotMaterials } = snapshotMaterialIds.length
    ? await access.supabase.from("pricing_materials").select("id, name, category, format, width_mm, usable_width_mm, default_waste_percent").in("id", snapshotMaterialIds)
    : { data: [] as RollMaterial[] };
  const snapshotMaterialById = new Map((snapshotMaterials ?? []).map((material) => [material.id, material as RollMaterial]));
  for (const row of rows) {
    const relation = row.quotes as Record<string, unknown> | Array<Record<string, unknown>> | null;
    const quote = Array.isArray(relation) ? relation[0] : relation;
    const items = (quote?.quote_items ?? []) as Array<{ quantity?: number; width_mm?: number | null; height_mm?: number | null; pricing_snapshot?: StoredPricingSnapshot | null; selected_by_customer?: boolean | null }>;
    const corrected = new Map<string, number>();
    for (const item of items.filter((entry) => entry.selected_by_customer !== false)) {
      const snapshot = item.pricing_snapshot ?? null;
      for (const usage of snapshot?.stockUsages ?? []) {
        if (!usage.materialId || !Number(usage.quantity)) continue;
        const quantity = optimizedAdhesiveLength(snapshot, usage, snapshotMaterialById.get(usage.materialId), item);
        corrected.set(usage.materialId, (corrected.get(usage.materialId) ?? 0) + quantity);
      }
    }
    const reservations = (row.production_material_reservations ?? []) as Array<Record<string, unknown>>;
    row.production_material_reservations = reservations.map((reservation) => {
      const materialId = String(reservation.inventory_item_id ?? "");
      const correctedQuantity = corrected.get(materialId);
      if (correctedQuantity === undefined || ["consumido", "liberado"].includes(String(reservation.status))) return reservation;
      const inventory = reservation.inventory_items as { current_quantity?: number } | null;
      const available = Number(inventory?.current_quantity ?? 0);
      return { ...reservation, planned_quantity: correctedQuantity, reserved_quantity: Math.min(correctedQuantity, Math.max(0, available)), status: available + .000001 >= correctedQuantity ? "reservado" : "insuficiente" };
    });
  }
  const orderIds = rows.map((item) => String(item.id));
  if (orderIds.length) {
    const { data: artworkApprovals } = await access.supabase.from("production_artwork_approvals").select("id, production_order_id, version, title, file_url, content_type, public_token, status, customer_notes, responded_at, created_at").in("production_order_id", orderIds).order("version", { ascending: false });
    const grouped = (artworkApprovals ?? []).reduce((map, item) => { const current = map.get(item.production_order_id) ?? []; current.push(item); map.set(item.production_order_id, current); return map; }, new Map<string, NonNullable<typeof artworkApprovals>>());
    for (const row of rows) row.production_artwork_approvals = grouped.get(String(row.id)) ?? [];
  }
  const { data: staff } = await access.supabase.from("profiles").select("id, full_name, role").eq("active", true).in("role", ["admin", "producao"]).order("full_name");
  return Response.json({ orders: rows, staff: staff ?? [], advancedControl: !detailed.error });
}

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "producao", "financeiro"]);
  if ("response" in access) return access.response;
  const parsed = actualEntrySchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Lançamento real inválido." }, { status: 400 });
  const input = parsed.data;
  const { error } = await access.supabase.from("production_actual_entries").insert({ production_order_id: input.orderId, entry_type: input.entryType, description: input.description, quantity: input.quantity, unit: input.unit, unit_cost: input.unitCost, notes: input.notes || null, created_by: access.user.id });
  if (error) return Response.json({ error: ["42P01", "PGRST205"].includes(error.code) ? "Aplique a migração de reservas e custos reais no Supabase." : "Não foi possível registrar o custo real." }, { status: 500 });
  return Response.json({ saved: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await getManagementAccess(["admin", "producao"]);
  if ("response" in access) return access.response;
  const parsed = stageSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Alteração inválida." }, { status: 400 });
  if (parsed.data.allowNegativeStock && (!parsed.data.stockOverrideReason || parsed.data.stockOverrideReason.length < 5)) return Response.json({ error: "Informe o motivo para concluir a OS com saldo negativo." }, { status: 400 });
  let stockDeducted = false;
  let negativeStockAllowed = false;
  const consumedTotals = new Map<string, number>();
  if (parsed.data.stage === "concluido") {
    const { data: order, error: orderError } = await access.supabase.from("production_orders").select("id, quote_id, stage").eq("id", parsed.data.id).single();
    if (orderError || !order) return Response.json({ error: "Ordem de produção não encontrada." }, { status: 404 });
    const { count, error: movementCheckError } = await access.supabase.from("stock_movements").select("id", { count: "exact", head: true }).eq("reference_type", "production_order").eq("reference_id", order.id);
    if (movementCheckError) return Response.json({ error: "Não foi possível verificar a baixa de estoque." }, { status: 500 });
    if (!count && order.quote_id) {
      const { data: quoteItems, error: itemsError } = await access.supabase.from("quote_items").select("quantity, width_mm, height_mm, pricing_source, pricing_snapshot, selected_by_customer").eq("quote_id", order.quote_id);
      if (itemsError) return Response.json({ error: "Não foi possível ler os consumos do orçamento." }, { status: 500 });
      const selectedItems = (quoteItems ?? []).filter((item) => item.selected_by_customer !== false);
      const missingSnapshots = selectedItems.some((item) => item.pricing_source === "calculado" && !(item.pricing_snapshot as { stockUsages?: unknown[] } | null)?.stockUsages);
      if (missingSnapshots) return Response.json({ error: "Este orçamento foi calculado antes do controle de estoque. Recalcule seus itens antes de concluir a produção." }, { status: 409 });
      const materialIds = [...new Set(selectedItems.flatMap((item) => ((item.pricing_snapshot as StoredPricingSnapshot | null)?.stockUsages ?? []).map((usage) => usage.materialId).filter((id): id is string => Boolean(id))))];
      const { data: rollMaterials, error: materialError } = materialIds.length
        ? await access.supabase.from("pricing_materials").select("id, name, category, format, width_mm, usable_width_mm, default_waste_percent").in("id", materialIds)
        : { data: [] as RollMaterial[], error: null };
      if (materialError) return Response.json({ error: "Não foi possível conferir as dimensões dos insumos calculados." }, { status: 500 });
      const rollMaterialById = new Map((rollMaterials ?? []).map((material) => [material.id, material as RollMaterial]));
      const totals = new Map<string, { name: string; quantity: number; unit: string }>();
      for (const item of selectedItems) {
        const snapshot = item.pricing_snapshot as StoredPricingSnapshot | null;
        const usages = snapshot?.stockUsages ?? [];
        for (const usage of usages) {
          if (!usage.materialId || !Number(usage.quantity)) continue;
          const correctedQuantity = optimizedAdhesiveLength(snapshot, usage, rollMaterialById.get(usage.materialId), item);
          const current = totals.get(usage.materialId);
          totals.set(usage.materialId, { name: usage.materialName || "Insumo", quantity: (current?.quantity ?? 0) + correctedQuantity, unit: usage.unit || current?.unit || "un" });
        }
      }
      if (totals.size) {
        const ids = [...totals.keys()];
        const { data: inventory, error: inventoryError } = await access.supabase.from("inventory_items").select("id, name, current_quantity, unit").in("id", ids);
        if (inventoryError) return Response.json({ error: "Não foi possível consultar o saldo dos insumos." }, { status: 500 });
        const inventoryById = new Map((inventory ?? []).map((item) => [item.id, item]));
        const unavailable = ids.filter((id) => !inventoryById.has(id));
        if (unavailable.length) {
          const names = unavailable.map((id) => totals.get(id)?.name).filter(Boolean).join(", ");
          return Response.json({ error: `Estoque não configurado para: ${names}. Edite esses insumos e informe o saldo disponível.` }, { status: 409 });
        }
        const insufficient = ids.filter((id) => Number(inventoryById.get(id)?.current_quantity ?? 0) + 0.000001 < Number(totals.get(id)?.quantity ?? 0));
        if (insufficient.length && !parsed.data.allowNegativeStock) {
          const descriptions = insufficient.map((id) => { const stock = inventoryById.get(id)!; const required = totals.get(id)!; return `${stock.name}: disponível ${Number(stock.current_quantity).toFixed(3)} ${stock.unit}, necessário ${required.quantity.toFixed(3)} ${required.unit}`; });
          return Response.json({ error: `Saldo insuficiente. ${descriptions.join("; ")}. Você pode corrigir o estoque ou usar a finalização excepcional com saldo negativo.`, insufficientStock: true }, { status: 409 });
        }
        negativeStockAllowed = insufficient.length > 0 && Boolean(parsed.data.allowNegativeStock);
        for (const id of ids) {
          const stock = inventoryById.get(id)!;
          const required = totals.get(id)!;
          const { error: updateError } = await access.supabase.from("inventory_items").update({ current_quantity: Number(stock.current_quantity) - required.quantity }).eq("id", id);
          if (updateError) return Response.json({ error: `Não foi possível baixar ${stock.name} do estoque.` }, { status: 500 });
          consumedTotals.set(id, required.quantity);
        }
        const movementNote = negativeStockAllowed ? `Baixa excepcional ao concluir a produção. Motivo: ${parsed.data.stockOverrideReason}` : "Baixa automática ao concluir a produção";
        const { error: movementError } = await access.supabase.from("stock_movements").insert(ids.map((id) => ({ inventory_item_id: id, movement_type: "saida", quantity: totals.get(id)!.quantity, reference_type: "production_order", reference_id: order.id, notes: movementNote, created_by: access.user.id })));
        if (movementError) return Response.json({ error: "Os saldos foram atualizados, mas o histórico da baixa não pôde ser gravado." }, { status: 500 });
        stockDeducted = true;
      }
    }
  }
  const now = new Date().toISOString();
  const changes: Record<string, string | null> = {};
  if (parsed.data.stage !== undefined) {
    changes.stage = parsed.data.stage;
    changes.completed_at = parsed.data.stage === "concluido" ? now : null;
    if (["producao", "acabamento", "expedicao", "instalacao"].includes(parsed.data.stage)) changes.started_at = now;
  }
  if (parsed.data.priority !== undefined) changes.priority = parsed.data.priority;
  if (parsed.data.dueAt !== undefined) changes.due_at = parsed.data.dueAt ? `${parsed.data.dueAt.slice(0, 10)}T23:59:59-03:00` : null;
  if (parsed.data.scheduledStartAt !== undefined) changes.scheduled_start_at = parsed.data.scheduledStartAt ? `${parsed.data.scheduledStartAt.slice(0, 10)}T08:00:00-03:00` : null;
  if (parsed.data.responsibleId !== undefined) changes.responsible_id = parsed.data.responsibleId;
  if (parsed.data.description !== undefined) changes.description = parsed.data.description;
  const { error } = await access.supabase.from("production_orders").update(changes).eq("id", parsed.data.id);
  if (error) return Response.json({ error: "Não foi possível atualizar a produção." }, { status: 500 });
  if (parsed.data.stage === "concluido") {
    const { data: reservations } = await access.supabase.from("production_material_reservations").select("id, inventory_item_id, reserved_quantity").eq("production_order_id", parsed.data.id).in("status", ["reservado", "insuficiente"]);
    for (const reservation of reservations ?? []) await access.supabase.from("production_material_reservations").update({ status: "consumido", consumed_quantity: consumedTotals.get(reservation.inventory_item_id) ?? reservation.reserved_quantity }).eq("id", reservation.id);
  }
  if (parsed.data.stage === "cancelado") await access.supabase.from("production_material_reservations").update({ status: "liberado" }).eq("production_order_id", parsed.data.id).in("status", ["reservado", "insuficiente"]);
  return Response.json({ saved: true, stockDeducted, negativeStockAllowed });
}
