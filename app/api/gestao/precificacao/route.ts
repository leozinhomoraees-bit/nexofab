import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const nullablePositive = z.union([z.coerce.number().positive(), z.literal(""), z.null()]).optional().transform((value) => value === "" || value === undefined ? null : value);

const materialData = z.object({
  sku: optionalText(60),
  name: z.string().trim().min(2).max(160),
  category: z.enum(["lona", "vinil", "mascara", "papel", "tecido", "chapa", "tinta", "filamento", "acabamento", "fixacao", "estrutura", "metal", "solda", "acrilico", "led", "eletrica", "embalagem", "consumivel", "terceirizado", "outro"]),
  format: z.enum(["rolo", "chapa", "barra", "unidade", "litro", "kg", "metro", "servico"]),
  vinylType: z.union([z.enum(["imprimivel", "cor", "ambos", "laminacao", "mascara"]), z.literal("")]).optional().default(""),
  supplier: optionalText(160),
  packageCost: z.coerce.number().min(0).max(999999999),
  purchaseQuantity: z.coerce.number().positive().max(999999999).default(1),
  widthMm: nullablePositive,
  usableWidthMm: nullablePositive,
  heightMm: nullablePositive,
  lengthM: nullablePositive,
  thicknessMm: nullablePositive,
  defaultWastePercent: z.coerce.number().min(0).max(100).default(0),
  currentQuantity: z.coerce.number().min(0).max(999999999).default(0),
  minimumQuantity: z.coerce.number().min(0).max(999999999).default(0),
  notes: optionalText(1000),
});

const consumableData = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  materialId: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  calculationBasis: z.enum(["hora", "m2", "mes"]),
  replacementCost: z.coerce.number().min(0).max(999999999).default(0),
  usefulLifeHours: nullablePositive,
  usefulLifeMonths: nullablePositive,
  consumptionPerM2: z.union([z.coerce.number().min(0), z.literal(""), z.null()]).optional().transform((value) => value === "" || value === undefined ? null : value),
}).superRefine((data, context) => {
  if (data.calculationBasis === "m2" && !data.materialId && data.replacementCost <= 0) context.addIssue({ code: "custom", path: ["replacementCost"], message: `${data.name}: informe o preço por litro/unidade ou vincule um insumo.` });
  if (data.calculationBasis === "m2" && Number(data.consumptionPerM2 ?? 0) <= 0) context.addIssue({ code: "custom", path: ["consumptionPerM2"], message: `${data.name}: informe o consumo por m².` });
  if ((data.calculationBasis === "hora" || data.calculationBasis === "mes") && data.replacementCost <= 0) context.addIssue({ code: "custom", path: ["replacementCost"], message: `${data.name}: informe o custo de reposição.` });
  if (data.calculationBasis === "hora" && !data.usefulLifeHours) context.addIssue({ code: "custom", path: ["usefulLifeHours"], message: `${data.name}: informe a vida útil em horas.` });
  if (data.calculationBasis === "mes" && !data.usefulLifeMonths) context.addIssue({ code: "custom", path: ["usefulLifeMonths"], message: `${data.name}: informe a vida útil em meses.` });
});

const machineData = z.object({
  name: z.string().trim().min(2).max(160),
  machineType: z.enum(["grandes_formatos", "router_cnc", "laser", "impressora_3d", "plotter", "laminadora", "acabamento", "outro"]),
  purchaseCost: z.coerce.number().min(0).max(999999999),
  residualValue: z.coerce.number().min(0).max(999999999).default(0),
  usefulLifeMonths: z.coerce.number().int().positive().max(600).default(60),
  productiveHoursMonth: z.coerce.number().positive().max(744).default(120),
  maintenanceMonthly: z.coerce.number().min(0).max(999999999).default(0),
  powerKw: z.coerce.number().min(0).max(1000).default(0),
  setupMinutes: z.coerce.number().min(0).max(10000).default(0),
  speedM2Hour: nullablePositive,
  minimumMinutes: z.coerce.number().min(0).max(10000).default(0),
  costCenterId: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  notes: optionalText(1000),
  consumables: z.array(consumableData).max(50).default([]),
}).refine((data) => data.residualValue <= data.purchaseCost, { message: "O valor residual não pode superar o valor de compra.", path: ["residualValue"] });

const settingsData = z.object({
  electricityPriceKwh: z.coerce.number().min(0).max(10000),
  laborCostHour: z.coerce.number().min(0).max(999999),
  overheadHour: z.coerce.number().min(0).max(999999),
  productiveHoursMonth: z.coerce.number().positive().max(744),
  taxPercent: z.coerce.number().min(0).max(100),
  commissionPercent: z.coerce.number().min(0).max(100),
  contingencyPercent: z.coerce.number().min(0).max(100),
  targetMarginPercent: z.coerce.number().min(0).max(90),
  maximumMarginPercent: z.coerce.number().min(0).max(90),
  minimumOrderValue: z.coerce.number().min(0).max(999999999),
  roundingIncrement: z.coerce.number().positive().max(10000),
}).refine((data) => data.taxPercent + data.commissionPercent + data.maximumMarginPercent < 95, { message: "Impostos, comissão e margem máxima somados precisam ficar abaixo de 95%." })
  .refine((data) => data.maximumMarginPercent >= data.targetMarginPercent, { message: "A margem máxima deve ser igual ou maior que a margem média." });

const componentData = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
  materialId: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  calculationBasis: z.enum(["net_m2", "width_m", "height_m", "unit", "fixed"]),
  quantityFactor: z.coerce.number().min(0).max(999999).default(1),
  extraQuantity: z.coerce.number().min(0).max(999999).default(0),
  wastePercent: z.coerce.number().min(0).max(100).default(0),
  optional: z.boolean().optional().default(false),
});

const fixedCostData = z.object({
  name: z.string().trim().min(2).max(160),
  monthlyAmount: z.coerce.number().min(0).max(999999999),
  costCenterId: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  notes: optionalText(1000),
});

const costCenterData = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(60).regex(/^[a-z0-9_-]+$/, "O código deve usar letras minúsculas, números, hífen ou sublinhado."),
  productiveHoursMonth: z.coerce.number().positive().max(10000),
  isDefault: z.boolean().optional().default(false),
  notes: optionalText(1000),
});

const productData = z.object({
  code: z.string().trim().min(2).max(60).regex(/^[a-z0-9_-]+$/, "O código deve usar letras minúsculas, números, hífen ou sublinhado."),
  name: z.string().trim().min(2).max(160),
  category: optionalText(100),
  pricingMethod: z.enum(["cost_margin", "table", "higher_of"]),
  profitCalculationMode: z.enum(["margin", "markup"]).default("margin"),
  rateBasis: z.enum(["m2", "linear_meter", "unit", "fixed"]),
  saleRate: z.coerce.number().min(0).max(999999999),
  minimumPrice: z.coerce.number().min(0).max(999999999).default(0),
  roundingIncrement: z.coerce.number().positive().max(10000).default(0.01),
  defaultLaborMinutes: z.coerce.number().min(0).max(100000).default(0),
  defaultMaterialId: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  defaultMachineId: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  notes: optionalText(1000),
  components: z.array(componentData).max(100).default([]),
});

const createSchema = z.discriminatedUnion("entity", [
  z.object({ entity: z.literal("material"), data: materialData }),
  z.object({ entity: z.literal("machine"), data: machineData }),
  z.object({ entity: z.literal("settings"), data: settingsData }),
  z.object({ entity: z.literal("product"), data: productData }),
  z.object({ entity: z.literal("fixedCost"), data: fixedCostData }),
  z.object({ entity: z.literal("costCenter"), data: costCenterData }),
]);
const updateSchema = z.discriminatedUnion("entity", [
  z.object({ entity: z.literal("material"), id: z.string().uuid(), data: materialData }),
  z.object({ entity: z.literal("machine"), id: z.string().uuid(), data: machineData }),
  z.object({ entity: z.literal("product"), id: z.string().uuid(), data: productData }),
  z.object({ entity: z.literal("fixedCost"), id: z.string().uuid(), data: fixedCostData }),
  z.object({ entity: z.literal("costCenter"), id: z.string().uuid(), data: costCenterData }),
]);
const deleteSchema = z.object({ entity: z.enum(["material", "machine", "product", "fixedCost", "costCenter"]), id: z.string().uuid() });

const fieldLabels: Record<string, string> = {
  name: "Nome comercial", category: "Categoria", format: "Formato de compra", vinylType: "Finalidade do vinil", packageCost: "Valor da embalagem / peça",
  purchaseQuantity: "Quantidade comprada", widthMm: "Largura nominal", usableWidthMm: "Largura útil",
  heightMm: "Altura", lengthM: "Comprimento", thicknessMm: "Espessura", defaultWastePercent: "Perda técnica",
  currentQuantity: "Saldo disponível", minimumQuantity: "Estoque mínimo", supplier: "Fornecedor",
};

function validationFailure(error: z.ZodError) {
  const issue = error.issues[0];
  const field = String(issue?.path.at(-1) ?? "");
  const label = fieldLabels[field];
  const raw = issue?.message ?? "Confira os dados informados.";
  const message = raw === "Invalid input: expected number, received NaN" || raw.toLowerCase().includes("expected number")
    ? "informe um número válido"
    : raw;
  return label ? `${label}: ${message}.` : message;
}

function databaseFailure(error: unknown, fallback: string) {
  const databaseError = error as { code?: string; message?: string; details?: string } | null;
  if (!databaseError) return fallback;
  if (databaseError.code === "23505") return "Já existe um insumo com este SKU ou referência.";
  if (databaseError.code === "23514" && /pricing_materials_category_check/i.test(databaseError.message ?? "")) return "A categoria escolhida ainda não está habilitada no banco. Execute a migração mais recente do Supabase e tente novamente.";
  if (databaseError.code === "23514") return "Um dos valores não é aceito pelo cadastro. Revise categoria, formato de compra, quantidades e dimensões.";
  if (databaseError.code === "23502") return "Um campo obrigatório não chegou ao banco. Revise os campos destacados e tente novamente.";
  if (databaseError.code === "42501") return "Seu usuário não possui permissão para cadastrar este insumo.";
  const reason = (databaseError.details || databaseError.message || "").replace(/\s+/g, " ").trim().slice(0, 240);
  return reason ? `${fallback} Motivo: ${reason}` : fallback;
}

const materialColumns = "id, sku, name, category, format, vinyl_type, supplier, package_cost, purchase_quantity, width_mm, usable_width_mm, height_mm, length_m, thickness_mm, default_waste_percent, notes, active, updated_at";
const legacyMaterialColumns = "id, sku, name, category, format, supplier, package_cost, purchase_quantity, width_mm, usable_width_mm, height_mm, length_m, thickness_mm, default_waste_percent, notes, active, updated_at";
const machineColumns = "id, name, machine_type, purchase_cost, residual_value, useful_life_months, productive_hours_month, maintenance_monthly, power_kw, setup_minutes, speed_m2_hour, minimum_minutes, cost_center_id, notes, active, updated_at, pricing_machine_consumables(id, name, material_id, calculation_basis, replacement_cost, useful_life_hours, useful_life_months, consumption_per_m2, active, pricing_materials(id, name, format, package_cost, purchase_quantity, width_mm, usable_width_mm, height_mm, length_m, default_waste_percent, category))";
const legacyMachineColumns = "id, name, machine_type, purchase_cost, residual_value, useful_life_months, productive_hours_month, maintenance_monthly, power_kw, setup_minutes, speed_m2_hour, minimum_minutes, notes, active, updated_at, pricing_machine_consumables(id, name, material_id, calculation_basis, replacement_cost, useful_life_hours, useful_life_months, consumption_per_m2, active, pricing_materials(id, name, format, package_cost, purchase_quantity, width_mm, usable_width_mm, height_mm, length_m, default_waste_percent, category))";
const productColumns = "id, code, name, category, pricing_method, profit_calculation_mode, rate_basis, sale_rate, minimum_price, rounding_increment, default_labor_minutes, default_material_id, default_machine_id, notes, active, updated_at, pricing_product_components(id, name, material_id, calculation_basis, quantity_factor, extra_quantity, waste_percent, optional, sort_order, pricing_materials(id, name, format, package_cost, purchase_quantity))";
const legacyProductColumns = "id, code, name, category, pricing_method, rate_basis, sale_rate, minimum_price, rounding_increment, default_labor_minutes, default_material_id, default_machine_id, notes, active, updated_at, pricing_product_components(id, name, material_id, calculation_basis, quantity_factor, extra_quantity, waste_percent, optional, sort_order, pricing_materials(id, name, format, package_cost, purchase_quantity))";

function materialRow(data: z.infer<typeof materialData>, userId?: string) {
  const category = data.category === "mascara" ? "vinil" : data.category;
  return {
    sku: data.sku || null, name: data.name, category, format: data.format, vinyl_type: data.category === "mascara" ? "mascara" : data.category === "vinil" ? data.vinylType || "imprimivel" : null, supplier: data.supplier || null,
    package_cost: data.packageCost, purchase_quantity: data.purchaseQuantity, width_mm: data.widthMm,
    usable_width_mm: data.usableWidthMm, height_mm: data.heightMm, length_m: data.lengthM, thickness_mm: data.thicknessMm,
    default_waste_percent: data.defaultWastePercent, notes: data.notes || null, ...(userId ? { created_by: userId } : {}),
  };
}

function inventoryUnit(format: z.infer<typeof materialData>["format"]) {
  if (format === "rolo" || format === "metro") return "m";
  if (format === "barra") return "un";
  if (format === "litro") return "L";
  if (format === "kg") return "kg";
  if (format === "servico") return "serviço";
  return "un";
}

function inventoryRow(id: string, data: z.infer<typeof materialData>) {
  const divisor = data.format === "rolo" ? Number(data.lengthM || 1) : Number(data.purchaseQuantity || 1);
  return {
    id,
    sku: data.sku || null,
    name: data.name,
    category: data.category === "mascara" ? "vinil" : data.category,
    unit: inventoryUnit(data.format),
    current_quantity: data.currentQuantity,
    minimum_quantity: data.minimumQuantity,
    average_cost: Number(data.packageCost) / Math.max(divisor, 0.000001),
    supplier: data.supplier || null,
    active: true,
  };
}

function machineRow(data: z.infer<typeof machineData>, userId?: string) {
  return {
    name: data.name, machine_type: data.machineType, purchase_cost: data.purchaseCost, residual_value: data.residualValue,
    useful_life_months: data.usefulLifeMonths, productive_hours_month: data.productiveHoursMonth,
    maintenance_monthly: data.maintenanceMonthly, power_kw: data.powerKw, setup_minutes: data.setupMinutes,
    speed_m2_hour: data.speedM2Hour, minimum_minutes: data.minimumMinutes, cost_center_id: data.costCenterId || null, notes: data.notes || null,
    ...(userId ? { created_by: userId } : {}),
  };
}

function consumableRows(machineId: string, items: z.infer<typeof consumableData>[]) {
  return items.map((item) => ({
    id: item.id ?? crypto.randomUUID(),
    machine_id: machineId, material_id: item.materialId || null, name: item.name,
    calculation_basis: item.calculationBasis, replacement_cost: item.replacementCost,
    useful_life_hours: item.usefulLifeHours, useful_life_months: item.usefulLifeMonths, consumption_per_m2: item.consumptionPerM2,
  }));
}

function componentRows(productId: string, items: z.infer<typeof componentData>[]) {
  return items.map((item, index) => ({
    id: item.id ?? crypto.randomUUID(),
    product_id: productId, material_id: item.materialId || null, name: item.name,
    calculation_basis: item.calculationBasis, quantity_factor: item.quantityFactor,
    extra_quantity: item.extraQuantity, waste_percent: item.wastePercent,
    optional: item.optional, sort_order: index,
  }));
}

function productRow(data: z.infer<typeof productData>, userId?: string) {
  return {
    code: data.code, name: data.name, category: data.category || null, pricing_method: data.pricingMethod, profit_calculation_mode: data.profitCalculationMode,
    rate_basis: data.rateBasis, sale_rate: data.saleRate, minimum_price: data.minimumPrice,
    rounding_increment: data.roundingIncrement, default_labor_minutes: data.defaultLaborMinutes,
    default_material_id: data.defaultMaterialId || null, default_machine_id: data.defaultMachineId || null,
    notes: data.notes || null, ...(userId ? { created_by: userId } : {}),
  };
}

export async function GET() {
  const access = await getManagementAccess();
  if ("response" in access) return access.response;
  const materialsPromise = (async () => {
    const current = await access.supabase.from("pricing_materials").select(materialColumns).eq("active", true).order("category").order("name");
    if (!current.error || !/vinyl_type/i.test(current.error.message ?? "")) return current;
    return access.supabase.from("pricing_materials").select(legacyMaterialColumns).eq("active", true).order("category").order("name");
  })();
  const productsPromise = (async () => {
    const current = await access.supabase.from("pricing_products").select(productColumns).eq("active", true).order("name");
    if (!current.error || !/profit_calculation_mode/i.test(current.error.message ?? "")) return current;
    return access.supabase.from("pricing_products").select(legacyProductColumns).eq("active", true).order("name");
  })();
  const machinesPromise = (async () => {
    const current = await access.supabase.from("pricing_machines").select(machineColumns).eq("active", true).order("name");
    if (!current.error || !/cost_center_id/i.test(current.error.message ?? "")) return current;
    return access.supabase.from("pricing_machines").select(legacyMachineColumns).eq("active", true).order("name");
  })();
  const fixedCostsPromise = (async () => {
    const current = await access.supabase.from("pricing_fixed_costs").select("id, name, monthly_amount, cost_center_id, notes, active, updated_at").eq("active", true).order("name");
    if (!current.error || !/cost_center_id/i.test(current.error.message ?? "")) return current;
    return access.supabase.from("pricing_fixed_costs").select("id, name, monthly_amount, notes, active, updated_at").eq("active", true).order("name");
  })();
  const costCentersPromise = (async () => {
    const result = await access.supabase.from("pricing_cost_centers").select("id, name, code, productive_hours_month, is_default, notes, active, updated_at").eq("active", true).order("name");
    if (result.error && ["42P01", "PGRST205"].includes(result.error.code ?? "")) return { data: [], error: null, setupRequired: true };
    return { ...result, setupRequired: false };
  })();
  const [materialsResult, machinesResult, settingsResult, productsResult, fixedCostsResult, inventoryResult, suppliersResult, costCentersResult] = await Promise.all([
    materialsPromise,
    machinesPromise,
    access.supabase.from("pricing_settings").select("*").eq("id", "default").maybeSingle(),
    productsPromise,
    fixedCostsPromise,
    access.supabase.from("inventory_items").select("id, current_quantity, minimum_quantity, unit").eq("active", true),
    access.supabase.from("suppliers").select("id, legal_name, trade_name, document, active").eq("active", true).order("legal_name"),
    costCentersPromise,
  ]);
  if (materialsResult.error || machinesResult.error || settingsResult.error || productsResult.error || fixedCostsResult.error || inventoryResult.error || costCentersResult.error) return Response.json({ error: "Não foi possível carregar a central de custos." }, { status: 500 });
  const fixedCostsMonthly = (fixedCostsResult.data ?? []).reduce((sum, item) => sum + Number(item.monthly_amount), 0);
  const inventoryById = new Map((inventoryResult.data ?? []).map((item) => [item.id, item]));
  const materials = (materialsResult.data ?? []).map((material) => ({ ...material, inventory: inventoryById.get(material.id) ?? null }));
  const products = (productsResult.data ?? []).map((product) => {
    const compatible = product as typeof product & { profit_calculation_mode?: "margin" | "markup" };
    return { ...product, profit_calculation_mode: compatible.profit_calculation_mode ?? (String(product.name).toLocaleLowerCase("pt-BR").includes("faixa") ? "markup" : "margin") };
  });
  return Response.json({ materials, machines: machinesResult.data ?? [], products, fixedCosts: fixedCostsResult.data ?? [], fixedCostsMonthly, costCenters: costCentersResult.data ?? [], costCentersSetupRequired: costCentersResult.setupRequired, suppliers: suppliersResult.data ?? [], settings: settingsResult.data, configured: Boolean(settingsResult.data) });
}

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "estoque", "producao", "comercial"]);
  if ("response" in access) return access.response;
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: validationFailure(parsed.error) }, { status: 400 });
  if (parsed.data.entity === "material") {
    if (!["admin", "estoque"].includes(access.role)) return Response.json({ error: "Apenas administração ou estoque podem cadastrar insumos." }, { status: 403 });
    const { data: material, error } = await access.supabase.from("pricing_materials").insert(materialRow(parsed.data.data, access.user.id)).select("id").single();
    if (error || !material) return Response.json({ error: databaseFailure(error, "Não foi possível cadastrar o insumo.") }, { status: 500 });
    const { error: inventoryError } = await access.supabase.from("inventory_items").insert(inventoryRow(material.id, parsed.data.data));
    if (inventoryError) {
      await access.supabase.from("pricing_materials").delete().eq("id", material.id);
      return Response.json({ error: databaseFailure(inventoryError, "O insumo não pôde ser criado no estoque.") }, { status: 500 });
    }
  } else if (parsed.data.entity === "machine") {
    if (!["admin", "producao"].includes(access.role)) return Response.json({ error: "Apenas administração ou produção podem cadastrar máquinas." }, { status: 403 });
    let machineResult = await access.supabase.from("pricing_machines").insert(machineRow(parsed.data.data, access.user.id)).select("id").single();
    if (machineResult.error?.code === "42703") {
      const { cost_center_id: _ignored, ...legacyRow } = machineRow(parsed.data.data, access.user.id);
      void _ignored;
      machineResult = await access.supabase.from("pricing_machines").insert(legacyRow).select("id").single();
    }
    const { data: machine, error } = machineResult;
    if (error || !machine) return Response.json({ error: "Não foi possível cadastrar a máquina." }, { status: 500 });
    if (parsed.data.data.consumables.length) {
      const { error: componentError } = await access.supabase.from("pricing_machine_consumables").insert(consumableRows(machine.id, parsed.data.data.consumables));
      if (componentError) { await access.supabase.from("pricing_machines").delete().eq("id", machine.id); return Response.json({ error: "A máquina foi validada, mas os consumíveis não puderam ser salvos." }, { status: 500 }); }
    }
  } else if (parsed.data.entity === "settings") {
    if (access.role !== "admin") return Response.json({ error: "Apenas o administrador pode alterar regras comerciais." }, { status: 403 });
    const data = parsed.data.data;
    const { error } = await access.supabase.from("pricing_settings").upsert({
      id: "default", electricity_price_kwh: data.electricityPriceKwh, labor_cost_hour: data.laborCostHour,
      overhead_hour: data.overheadHour, productive_hours_month: data.productiveHoursMonth,
      tax_percent: data.taxPercent, commission_percent: data.commissionPercent,
      contingency_percent: data.contingencyPercent, target_margin_percent: data.targetMarginPercent, maximum_margin_percent: data.maximumMarginPercent,
      minimum_order_value: data.minimumOrderValue, rounding_increment: data.roundingIncrement, updated_by: access.user.id,
    });
    if (error) return Response.json({ error: "Não foi possível salvar as regras de preço." }, { status: 500 });
  } else if (parsed.data.entity === "product") {
    if (!["admin", "comercial"].includes(access.role)) return Response.json({ error: "Apenas administração ou comercial podem cadastrar produtos." }, { status: 403 });
    const { data: product, error } = await access.supabase.from("pricing_products").insert(productRow(parsed.data.data, access.user.id)).select("id").single();
    if (error || !product) return Response.json({ error: error?.code === "23505" ? "Já existe um produto com este código." : "Não foi possível cadastrar o produto." }, { status: 500 });
    if (parsed.data.data.components.length) {
      const { error: componentError } = await access.supabase.from("pricing_product_components").insert(componentRows(product.id, parsed.data.data.components));
      if (componentError) return Response.json({ error: "Produto salvo, mas não foi possível salvar sua ficha técnica." }, { status: 500 });
    }
  } else if (parsed.data.entity === "fixedCost") {
    if (access.role !== "admin") return Response.json({ error: "Apenas o administrador pode cadastrar custos fixos." }, { status: 403 });
    const data = parsed.data.data;
    let { error } = await access.supabase.from("pricing_fixed_costs").insert({ name: data.name, monthly_amount: data.monthlyAmount, cost_center_id: data.costCenterId || null, notes: data.notes || null, created_by: access.user.id });
    if (error?.code === "42703") ({ error } = await access.supabase.from("pricing_fixed_costs").insert({ name: data.name, monthly_amount: data.monthlyAmount, notes: data.notes || null, created_by: access.user.id }));
    if (error) return Response.json({ error: "Não foi possível cadastrar o custo fixo." }, { status: 500 });
  } else {
    if (access.role !== "admin") return Response.json({ error: "Apenas o administrador pode cadastrar centros de custo." }, { status: 403 });
    const data = parsed.data.data;
    if (data.isDefault) await access.supabase.from("pricing_cost_centers").update({ is_default: false }).eq("active", true);
    const { error } = await access.supabase.from("pricing_cost_centers").insert({ name: data.name, code: data.code, productive_hours_month: data.productiveHoursMonth, is_default: data.isDefault, notes: data.notes || null, created_by: access.user.id });
    if (error) return Response.json({ error: error.code === "23505" ? "Já existe um centro com este código ou outro centro está marcado como padrão." : "Não foi possível cadastrar o centro de custo. Aplique a migração mais recente do Supabase." }, { status: 500 });
  }
  return Response.json({ saved: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await getManagementAccess(["admin", "estoque", "producao", "comercial"]);
  if ("response" in access) return access.response;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: validationFailure(parsed.error) }, { status: 400 });
  if (parsed.data.entity === "material") {
    if (!["admin", "estoque"].includes(access.role)) return Response.json({ error: "Sem permissão para editar insumos." }, { status: 403 });
    const { error } = await access.supabase.from("pricing_materials").update(materialRow(parsed.data.data)).eq("id", parsed.data.id);
    if (error) return Response.json({ error: databaseFailure(error, "Não foi possível atualizar o insumo.") }, { status: 500 });
    const { error: inventoryError } = await access.supabase.from("inventory_items").upsert(inventoryRow(parsed.data.id, parsed.data.data));
    if (inventoryError) return Response.json({ error: databaseFailure(inventoryError, "O custo foi salvo, mas não foi possível sincronizar o saldo do estoque.") }, { status: 500 });
  } else if (parsed.data.entity === "machine") {
    if (!["admin", "producao"].includes(access.role)) return Response.json({ error: "Sem permissão para editar máquinas." }, { status: 403 });
    let { error } = await access.supabase.from("pricing_machines").update(machineRow(parsed.data.data)).eq("id", parsed.data.id);
    if (error?.code === "42703") {
      const { cost_center_id: _ignored, ...legacyRow } = machineRow(parsed.data.data);
      void _ignored;
      ({ error } = await access.supabase.from("pricing_machines").update(legacyRow).eq("id", parsed.data.id));
    }
    if (error) return Response.json({ error: "Não foi possível atualizar a máquina." }, { status: 500 });
    if (parsed.data.data.consumables.length) {
      const rows = consumableRows(parsed.data.id, parsed.data.data.consumables);
      const { error: componentError } = await access.supabase.from("pricing_machine_consumables").upsert(rows);
      if (componentError) return Response.json({ error: "Máquina atualizada, mas houve erro ao salvar consumíveis." }, { status: 500 });
      await access.supabase.from("pricing_machine_consumables").delete().eq("machine_id", parsed.data.id).not("id", "in", `(${rows.map((item) => item.id).join(",")})`);
    } else {
      await access.supabase.from("pricing_machine_consumables").delete().eq("machine_id", parsed.data.id);
    }
  } else if (parsed.data.entity === "product") {
    if (!["admin", "comercial"].includes(access.role)) return Response.json({ error: "Sem permissão para editar produtos." }, { status: 403 });
    const { error } = await access.supabase.from("pricing_products").update(productRow(parsed.data.data)).eq("id", parsed.data.id);
    if (error) return Response.json({ error: "Não foi possível atualizar o produto." }, { status: 500 });
    if (parsed.data.data.components.length) {
      const rows = componentRows(parsed.data.id, parsed.data.data.components);
      const { error: componentError } = await access.supabase.from("pricing_product_components").upsert(rows);
      if (componentError) return Response.json({ error: "Produto atualizado, mas não foi possível salvar sua ficha técnica." }, { status: 500 });
      await access.supabase.from("pricing_product_components").delete().eq("product_id", parsed.data.id).not("id", "in", `(${rows.map((item) => item.id).join(",")})`);
    } else {
      await access.supabase.from("pricing_product_components").delete().eq("product_id", parsed.data.id);
    }
  } else if (parsed.data.entity === "fixedCost") {
    if (access.role !== "admin") return Response.json({ error: "Sem permissão para editar custos fixos." }, { status: 403 });
    const data = parsed.data.data;
    let { error } = await access.supabase.from("pricing_fixed_costs").update({ name: data.name, monthly_amount: data.monthlyAmount, cost_center_id: data.costCenterId || null, notes: data.notes || null }).eq("id", parsed.data.id);
    if (error?.code === "42703") ({ error } = await access.supabase.from("pricing_fixed_costs").update({ name: data.name, monthly_amount: data.monthlyAmount, notes: data.notes || null }).eq("id", parsed.data.id));
    if (error) return Response.json({ error: "Não foi possível atualizar o custo fixo." }, { status: 500 });
  } else {
    if (access.role !== "admin") return Response.json({ error: "Sem permissão para editar centros de custo." }, { status: 403 });
    const data = parsed.data.data;
    if (data.isDefault) await access.supabase.from("pricing_cost_centers").update({ is_default: false }).neq("id", parsed.data.id).eq("active", true);
    const { error } = await access.supabase.from("pricing_cost_centers").update({ name: data.name, code: data.code, productive_hours_month: data.productiveHoursMonth, is_default: data.isDefault, notes: data.notes || null, updated_at: new Date().toISOString() }).eq("id", parsed.data.id);
    if (error) return Response.json({ error: "Não foi possível atualizar o centro de custo." }, { status: 500 });
  }
  return Response.json({ saved: true });
}

export async function DELETE(request: Request) {
  const access = await getManagementAccess(["admin", "estoque", "producao", "comercial"]);
  if ("response" in access) return access.response;
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Item inválido." }, { status: 400 });
  const { entity, id } = parsed.data;
  if (entity === "material") {
    if (!["admin", "estoque"].includes(access.role)) return Response.json({ error: "Sem permissão para excluir insumos." }, { status: 403 });
    const [productMain, productComponent, machineComponent] = await Promise.all([
      access.supabase.from("pricing_products").select("id", { count: "exact", head: true }).eq("active", true).eq("default_material_id", id),
      access.supabase.from("pricing_product_components").select("id", { count: "exact", head: true }).eq("material_id", id),
      access.supabase.from("pricing_machine_consumables").select("id", { count: "exact", head: true }).eq("material_id", id),
    ]);
    if ((productMain.count ?? 0) + (productComponent.count ?? 0) + (machineComponent.count ?? 0) > 0) return Response.json({ error: "Este insumo está vinculado a uma ficha técnica ou máquina. Remova o vínculo antes de excluí-lo." }, { status: 409 });
    const { error } = await access.supabase.from("pricing_materials").update({ active: false }).eq("id", id);
    if (error) return Response.json({ error: "Não foi possível excluir o insumo." }, { status: 500 });
    await access.supabase.from("inventory_items").update({ active: false }).eq("id", id);
  } else if (entity === "machine") {
    if (!["admin", "producao"].includes(access.role)) return Response.json({ error: "Sem permissão para excluir máquinas." }, { status: 403 });
    const { count } = await access.supabase.from("pricing_products").select("id", { count: "exact", head: true }).eq("active", true).eq("default_machine_id", id);
    if (count) return Response.json({ error: "Esta máquina está vinculada a uma ficha técnica. Remova o vínculo antes de excluí-la." }, { status: 409 });
    const { error } = await access.supabase.from("pricing_machines").update({ active: false }).eq("id", id);
    if (error) return Response.json({ error: "Não foi possível excluir a máquina." }, { status: 500 });
  } else if (entity === "product") {
    if (!["admin", "comercial"].includes(access.role)) return Response.json({ error: "Sem permissão para excluir produtos." }, { status: 403 });
    const { error } = await access.supabase.from("pricing_products").update({ active: false }).eq("id", id);
    if (error) return Response.json({ error: "Não foi possível excluir o produto." }, { status: 500 });
  } else if (entity === "fixedCost") {
    if (access.role !== "admin") return Response.json({ error: "Apenas o administrador pode excluir custos fixos." }, { status: 403 });
    const { error } = await access.supabase.from("pricing_fixed_costs").update({ active: false }).eq("id", id);
    if (error) return Response.json({ error: "Não foi possível excluir o custo fixo." }, { status: 500 });
  } else {
    if (access.role !== "admin") return Response.json({ error: "Apenas o administrador pode desativar centros de custo." }, { status: 403 });
    await Promise.all([
      access.supabase.from("pricing_machines").update({ cost_center_id: null }).eq("cost_center_id", id),
      access.supabase.from("pricing_fixed_costs").update({ cost_center_id: null }).eq("cost_center_id", id),
    ]);
    const { error } = await access.supabase.from("pricing_cost_centers").update({ active: false, is_default: false }).eq("id", id);
    if (error) return Response.json({ error: "Não foi possível desativar o centro de custo." }, { status: 500 });
  }
  return Response.json({ deleted: true });
}
