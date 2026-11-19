import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";
import { calculatePricing, type PricingMachine, type PricingMaterial, type PricingProduct, type PricingSettings } from "@/lib/pricing-engine";

const inputSchema = z.object({
  model: z.enum(["rolo", "chapa", "consumo"]),
  materialId: z.union([z.string().uuid(), z.literal("")]),
  machineId: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  productId: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  widthMm: z.coerce.number().min(0).max(100000),
  heightMm: z.coerce.number().min(0).max(100000),
  quantity: z.coerce.number().int().positive().max(100000),
  consumptionQuantity: z.coerce.number().min(0).max(999999999).optional().default(0),
  allowRotation: z.boolean().optional().default(true),
  orientation: z.enum(["auto", "normal", "rotated"]).optional().default("auto"),
  finishingMode: z.enum(["none", "banner", "faixa"]).optional().default("none"),
  finishingAllowanceMm: z.coerce.number().min(0).max(500).optional().default(0),
  laborMinutes: z.coerce.number().min(0).max(100000).optional().default(0),
  machineMinutes: z.coerce.number().min(0).max(1000000).optional().default(0),
  extraCost: z.coerce.number().min(0).max(999999999).optional().default(0),
  invoiceIncluded: z.boolean().optional().default(false),
  commissionIncluded: z.boolean().optional().default(false),
  invoicePercent: z.coerce.number().min(0).max(90).optional(),
  commissionPercent: z.coerce.number().min(0).max(90).optional(),
  desiredMarginPercent: z.coerce.number().min(0).max(90).optional(),
  varnishIncluded: z.boolean().optional().default(false),
  varnishRateM2: z.coerce.number().min(0).max(10000).optional().default(10),
  includeMaterialCost: z.boolean().optional().default(true),
});

const settingsDefaults: PricingSettings = { electricity_price_kwh: 0, labor_cost_hour: 0, overhead_hour: 0, tax_percent: 0, commission_percent: 0, contingency_percent: 0, target_margin_percent: 0, maximum_margin_percent: 45, minimum_order_value: 0, rounding_increment: 0.01 };

export async function POST(request: Request) {
  const access = await getManagementAccess();
  if ("response" in access) return access.response;
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Parâmetros de cálculo inválidos." }, { status: 400 });
  const productPromise = parsed.data.productId ? (async () => {
    const current = await access.supabase.from("pricing_products").select("id, code, name, pricing_method, profit_calculation_mode, rate_basis, sale_rate, minimum_price, rounding_increment, default_labor_minutes, pricing_product_components(id, name, calculation_basis, quantity_factor, extra_quantity, waste_percent, optional, pricing_materials(id, name, category, format, package_cost, purchase_quantity, width_mm, usable_width_mm, height_mm, length_m, default_waste_percent))").eq("id", parsed.data.productId).single();
    if (!current.error || !/profit_calculation_mode/i.test(current.error.message ?? "")) return current;
    return access.supabase.from("pricing_products").select("id, code, name, pricing_method, rate_basis, sale_rate, minimum_price, rounding_increment, default_labor_minutes, pricing_product_components(id, name, calculation_basis, quantity_factor, extra_quantity, waste_percent, optional, pricing_materials(id, name, category, format, package_cost, purchase_quantity, width_mm, usable_width_mm, height_mm, length_m, default_waste_percent))").eq("id", parsed.data.productId).single();
  })() : Promise.resolve({ data: null, error: null });
  const machinePromise = parsed.data.machineId ? (async () => {
    const columns = "id, name, machine_type, purchase_cost, residual_value, useful_life_months, productive_hours_month, maintenance_monthly, power_kw, setup_minutes, speed_m2_hour, minimum_minutes, cost_center_id, pricing_machine_consumables(id, name, calculation_basis, replacement_cost, useful_life_hours, useful_life_months, consumption_per_m2, pricing_materials(id, name, category, format, package_cost, purchase_quantity, width_mm, usable_width_mm, height_mm, length_m, default_waste_percent))";
    const legacy = columns.replace(", cost_center_id", "");
    const current = await access.supabase.from("pricing_machines").select(columns).eq("id", parsed.data.machineId).single();
    if (!current.error || !/cost_center_id/i.test(current.error.message ?? "")) return current;
    return access.supabase.from("pricing_machines").select(legacy).eq("id", parsed.data.machineId).single();
  })() : Promise.resolve({ data: null, error: null });
  const fixedCostsPromise = (async () => {
    const current = await access.supabase.from("pricing_fixed_costs").select("monthly_amount, cost_center_id").eq("active", true);
    if (!current.error || !/cost_center_id/i.test(current.error.message ?? "")) return current;
    return access.supabase.from("pricing_fixed_costs").select("monthly_amount").eq("active", true);
  })();
  const costCentersPromise = (async () => {
    const result = await access.supabase.from("pricing_cost_centers").select("id, productive_hours_month, is_default").eq("active", true);
    if (result.error && ["42P01", "PGRST205"].includes(result.error.code ?? "")) return { data: [], error: null };
    return result;
  })();
  const [materialResult, machineResult, settingsResult, productResult, fixedCostsResult, costCentersResult] = await Promise.all([
    parsed.data.materialId
      ? access.supabase.from("pricing_materials").select("id, name, category, format, package_cost, purchase_quantity, width_mm, usable_width_mm, height_mm, length_m, default_waste_percent").eq("id", parsed.data.materialId).single()
      : Promise.resolve({ data: parsed.data.includeMaterialCost ? null : { id: "service-only", name: "Material principal", category: "outro", format: "servico", package_cost: 0, purchase_quantity: 1, width_mm: null, usable_width_mm: null, height_mm: null, length_m: null, default_waste_percent: 0 }, error: null }),
    machinePromise,
    access.supabase.from("pricing_settings").select("electricity_price_kwh, labor_cost_hour, overhead_hour, productive_hours_month, tax_percent, commission_percent, contingency_percent, target_margin_percent, maximum_margin_percent, minimum_order_value, rounding_increment").eq("id", "default").maybeSingle(),
    productPromise,
    fixedCostsPromise,
    costCentersPromise,
  ]);
  if (materialResult.error || !materialResult.data) return Response.json({ error: "Insumo não encontrado ou inativo." }, { status: 404 });
  if (machineResult.error) return Response.json({ error: "Máquina não encontrada ou inativa." }, { status: 404 });
  if (productResult.error) return Response.json({ error: "Produto ou tabela comercial não encontrado." }, { status: 404 });
  if (fixedCostsResult.error || costCentersResult.error) return Response.json({ error: "Não foi possível carregar os custos fixos." }, { status: 500 });
  try {
    const settings = { ...settingsDefaults, ...(settingsResult.data ?? {}) };
    const fixedCosts = (fixedCostsResult.data ?? []) as Array<{ monthly_amount: number; cost_center_id?: string | null }>;
    const centers = (costCentersResult.data ?? []) as Array<{ id: string; productive_hours_month: number; is_default: boolean }>;
    const selectedCenterId = (machineResult.data as { cost_center_id?: string | null } | null)?.cost_center_id || centers.find((item) => item.is_default)?.id || null;
    if (centers.length && selectedCenterId) {
      const totalCenterHours = centers.reduce((sum, item) => sum + Number(item.productive_hours_month), 0);
      const generalMonthly = fixedCosts.filter((item) => !item.cost_center_id).reduce((sum, item) => sum + Number(item.monthly_amount), 0);
      const centerMonthly = fixedCosts.filter((item) => item.cost_center_id === selectedCenterId).reduce((sum, item) => sum + Number(item.monthly_amount), 0);
      const centerHours = Number(centers.find((item) => item.id === selectedCenterId)?.productive_hours_month ?? settings.productive_hours_month ?? 160);
      settings.overhead_hour = Number(settings.overhead_hour) + generalMonthly / Math.max(totalCenterHours, 1) + centerMonthly / Math.max(centerHours, 1);
    } else {
      const fixedCostsMonthly = fixedCosts.reduce((sum, item) => sum + Number(item.monthly_amount), 0);
      settings.overhead_hour = Number(settings.overhead_hour) + fixedCostsMonthly / Math.max(Number(settings.productive_hours_month ?? 160), 1);
    }
    const productData = productResult.data as (PricingProduct & { default_labor_minutes?: number; name: string }) | null;
    const product = productData ? { ...productData, profit_calculation_mode: productData.profit_calculation_mode ?? (String(productData.name).toLocaleLowerCase("pt-BR").includes("faixa") ? "markup" : "margin") } : null;
    const calculation = calculatePricing(materialResult.data as PricingMaterial, machineResult.data as PricingMachine | null, settings, { ...parsed.data, laborMinutes: parsed.data.laborMinutes || Number(productResult.data?.default_labor_minutes ?? 0) }, product as PricingProduct | null);
    return Response.json({ calculation, configured: Boolean(settingsResult.data) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível calcular o preço." }, { status: 400 });
  }
}
