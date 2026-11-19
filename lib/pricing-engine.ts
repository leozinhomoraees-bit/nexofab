export type PricingMaterial = {
  id: string;
  name: string;
  category: string;
  format: "rolo" | "chapa" | "unidade" | "litro" | "kg" | "metro" | "servico";
  package_cost: number;
  purchase_quantity: number;
  width_mm: number | null;
  usable_width_mm: number | null;
  height_mm: number | null;
  length_m: number | null;
  default_waste_percent: number;
};

export type PricingMachine = {
  id: string;
  name: string;
  machine_type?: string;
  purchase_cost: number;
  residual_value: number;
  useful_life_months: number;
  productive_hours_month: number;
  maintenance_monthly: number;
  power_kw: number;
  setup_minutes: number;
  speed_m2_hour: number | null;
  minimum_minutes: number;
  pricing_machine_consumables?: MachineConsumable[];
};

export type MachineConsumable = {
  id?: string;
  name: string;
  calculation_basis: "hora" | "m2" | "mes";
  replacement_cost: number;
  useful_life_hours: number | null;
  useful_life_months: number | null;
  consumption_per_m2: number | null;
  pricing_materials?: PricingMaterial | null;
};

export type PricingSettings = {
  electricity_price_kwh: number;
  labor_cost_hour: number;
  overhead_hour: number;
  tax_percent: number;
  commission_percent: number;
  contingency_percent: number;
  target_margin_percent: number;
  maximum_margin_percent: number;
  minimum_order_value: number;
  rounding_increment: number;
};

export type PricingProductComponent = {
  id: string;
  name: string;
  calculation_basis: "net_m2" | "width_m" | "height_m" | "unit" | "fixed";
  quantity_factor: number;
  extra_quantity: number;
  waste_percent: number;
  optional: boolean;
  pricing_materials?: PricingMaterial | null;
};

export type PricingProduct = {
  id: string;
  code: string;
  name: string;
  pricing_method: "cost_margin" | "table" | "higher_of";
  profit_calculation_mode?: "margin" | "markup";
  rate_basis: "m2" | "linear_meter" | "unit" | "fixed";
  sale_rate: number;
  minimum_price: number;
  rounding_increment: number;
  default_labor_minutes: number;
  pricing_product_components?: PricingProductComponent[];
};

export type PricingCalculationInput = {
  model: "rolo" | "chapa" | "consumo";
  widthMm: number;
  heightMm: number;
  quantity: number;
  consumptionQuantity?: number;
  allowRotation?: boolean;
  orientation?: "auto" | "normal" | "rotated";
  finishingMode?: "none" | "banner" | "faixa";
  finishingAllowanceMm?: number;
  laborMinutes?: number;
  machineMinutes?: number;
  extraCost?: number;
  invoiceIncluded?: boolean;
  commissionIncluded?: boolean;
  invoicePercent?: number;
  commissionPercent?: number;
  desiredMarginPercent?: number;
  varnishIncluded?: boolean;
  varnishRateM2?: number;
  includeMaterialCost?: boolean;
};

type CostLine = { key: string; label: string; detail: string; amount: number };
export type StockUsage = {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  source: "principal" | "maquina" | "receita";
};

const round = (value: number, decimals = 4) => Number(value.toFixed(decimals));
const positive = (value: number | null | undefined) => Math.max(0, Number(value ?? 0));

function costPerPurchaseUnit(material: PricingMaterial) {
  if (material.format === "rolo" && positive(material.length_m) > 0) return positive(material.package_cost) / positive(material.length_m);
  return positive(material.package_cost) / Math.max(positive(material.purchase_quantity), 0.000001);
}

function rollUsage(material: PricingMaterial, input: PricingCalculationInput) {
  const usableWidth = positive(material.usable_width_mm || material.width_mm);
  if (!usableWidth) throw new Error("Informe a largura útil do rolo no cadastro do insumo.");
  const allowance = positive(input.finishingAllowanceMm);
  const productionWidthMm = input.widthMm + (input.finishingMode === "faixa" ? allowance * 2 : 0);
  const productionHeightMm = input.heightMm + (input.finishingMode === "banner" ? allowance * 2 : 0);
  const orientation = input.orientation ?? (input.allowRotation === false ? "normal" : "auto");
  const orientations = [
    ...(orientation === "rotated" ? [] : [{ pieceAcross: productionWidthMm, advance: productionHeightMm, rotated: false }]),
    ...(orientation === "normal" ? [] : [{ pieceAcross: productionHeightMm, advance: productionWidthMm, rotated: true }]),
  ].filter((option) => option.pieceAcross > 0 && option.advance > 0 && option.pieceAcross <= usableWidth)
    .map((option) => {
      const across = Math.max(1, Math.floor(usableWidth / option.pieceAcross));
      const rows = Math.ceil(input.quantity / across);
      return { ...option, across, rows, lengthM: rows * option.advance / 1000 };
    });
  if (!orientations.length) throw new Error(`A peça não cabe na largura útil de ${usableWidth} mm do rolo.`);
  const layout = orientations.sort((a, b) => a.lengthM - b.lengthM)[0];
  const chargedLengthM = layout.lengthM * (1 + positive(material.default_waste_percent) / 100);
  const purchasedAreaM2 = usableWidth / 1000 * chargedLengthM;
  const netAreaM2 = input.widthMm * input.heightMm * input.quantity / 1_000_000;
  const productionAreaM2 = productionWidthMm * productionHeightMm * input.quantity / 1_000_000;
  const finishingAreaM2 = Math.max(0, productionAreaM2 - netAreaM2);
  const wasteAreaM2 = Math.max(0, purchasedAreaM2 - productionAreaM2);
  const unitCostLinear = costPerPurchaseUnit(material);
  const unitCostM2 = unitCostLinear / Math.max(usableWidth / 1000, 0.000001);
  return {
    materialCost: chargedLengthM * unitCostLinear,
    netAreaM2,
    productionAreaM2,
    finishingAreaM2,
    purchasedAreaM2,
    wasteAreaM2,
    wastePercent: purchasedAreaM2 ? wasteAreaM2 / purchasedAreaM2 * 100 : 0,
    wasteCost: wasteAreaM2 * unitCostM2,
    finishingCost: finishingAreaM2 * unitCostM2,
    unitCostLinear,
    unitCostM2,
    productionWidthMm,
    productionHeightMm,
    rotated: layout.rotated,
    usageDetail: `${round(chargedLengthM, 3)} m lineares × ${round(usableWidth / 1000, 3)} m de largura (${layout.across} peça(s) por faixa · ${layout.rotated ? "girada 90°" : "orientação normal"})`,
    linearMeters: chargedLengthM,
    stockQuantity: chargedLengthM,
    stockUnit: "m",
  };
}

function sheetUsage(material: PricingMaterial, input: PricingCalculationInput) {
  const sheetWidth = positive(material.width_mm);
  const sheetHeight = positive(material.height_mm);
  if (!sheetWidth || !sheetHeight) throw new Error("Informe largura e altura da chapa no cadastro do insumo.");
  const capacities = [
    { capacity: Math.floor(sheetWidth / input.widthMm) * Math.floor(sheetHeight / input.heightMm), rotated: false },
    ...(input.allowRotation === false ? [] : [{ capacity: Math.floor(sheetWidth / input.heightMm) * Math.floor(sheetHeight / input.widthMm), rotated: true }]),
  ].filter((option) => option.capacity > 0);
  if (!capacities.length) throw new Error(`A peça não cabe na chapa de ${sheetWidth} × ${sheetHeight} mm.`);
  const layout = capacities.sort((a, b) => b.capacity - a.capacity)[0];
  const sheets = Math.ceil(input.quantity / layout.capacity);
  const spoilageFactor = 1 + positive(material.default_waste_percent) / 100;
  const availableAreaM2 = sheetWidth * sheetHeight * sheets / 1_000_000;
  const netAreaM2 = input.widthMm * input.heightMm * input.quantity / 1_000_000;
  // Chapas permanecem em estoque como retalho reutilizável. Por isso o orçamento
  // apropria somente a área das peças mais a perda técnica configurada, em vez de
  // transferir o preço da chapa inteira ao primeiro cliente que usar uma parte dela.
  const chargeableAreaM2 = Math.min(availableAreaM2, netAreaM2 * spoilageFactor);
  const reusableAreaM2 = Math.max(0, availableAreaM2 - chargeableAreaM2);
  const wasteAreaM2 = Math.max(0, chargeableAreaM2 - netAreaM2);
  const sheetCost = costPerPurchaseUnit(material);
  const unitCostM2 = sheetCost / Math.max(sheetWidth * sheetHeight / 1_000_000, 0.000001);
  const stockQuantity = chargeableAreaM2 / Math.max(sheetWidth * sheetHeight / 1_000_000, 0.000001);
  return {
    materialCost: chargeableAreaM2 * unitCostM2,
    netAreaM2,
    productionAreaM2: netAreaM2,
    finishingAreaM2: 0,
    purchasedAreaM2: chargeableAreaM2,
    wasteAreaM2,
    wastePercent: chargeableAreaM2 ? wasteAreaM2 / chargeableAreaM2 * 100 : 0,
    wasteCost: wasteAreaM2 * unitCostM2,
    finishingCost: 0,
    unitCostLinear: 0,
    unitCostM2,
    productionWidthMm: input.widthMm,
    productionHeightMm: input.heightMm,
    rotated: layout.rotated,
    usageDetail: `${round(chargeableAreaM2, 4)} m² apropriados (${round(stockQuantity, 4)} chapa) · ${round(reusableAreaM2, 4)} m² permanecem como retalho reutilizável${layout.rotated ? " · melhor aproveitamento girado" : ""}`,
    linearMeters: 0,
    stockQuantity,
    stockUnit: "un",
  };
}

function consumptionUsage(material: PricingMaterial, input: PricingCalculationInput) {
  const consumption = positive(input.consumptionQuantity || input.quantity);
  return {
    materialCost: consumption * costPerPurchaseUnit(material) * (1 + positive(material.default_waste_percent) / 100),
    netAreaM2: input.widthMm * input.heightMm * input.quantity / 1_000_000,
    productionAreaM2: input.widthMm * input.heightMm * input.quantity / 1_000_000,
    finishingAreaM2: 0,
    purchasedAreaM2: 0,
    wasteAreaM2: 0,
    wastePercent: positive(material.default_waste_percent),
    wasteCost: 0,
    finishingCost: 0,
    unitCostLinear: material.format === "metro" ? costPerPurchaseUnit(material) : 0,
    unitCostM2: 0,
    productionWidthMm: input.widthMm,
    productionHeightMm: input.heightMm,
    rotated: false,
    usageDetail: `${round(consumption, 4)} ${material.format === "unidade" ? "un" : material.format}`,
    linearMeters: material.format === "metro" ? consumption : 0,
    stockQuantity: consumption,
    stockUnit: material.format === "unidade" ? "un" : material.format === "litro" ? "L" : material.format === "kg" ? "kg" : material.format === "metro" ? "m" : material.format,
  };
}

export function calculatePricing(material: PricingMaterial, machine: PricingMachine | null, settings: PricingSettings, input: PricingCalculationInput, product: PricingProduct | null = null) {
  if (input.quantity <= 0 || input.widthMm < 0 || input.heightMm < 0) throw new Error("Dimensões e quantidade precisam ser válidas.");
  const usage = input.model === "rolo" ? rollUsage(material, input) : input.model === "chapa" ? sheetUsage(material, input) : consumptionUsage(material, input);
  const materialRates = input.model === "rolo" ? ` · R$ ${round(usage.unitCostLinear, 2)}/m linear · R$ ${round(usage.unitCostM2, 2)}/m²` : "";
  const includeMaterialCost = input.includeMaterialCost !== false;
  const lines: CostLine[] = [{
    key: "material",
    label: includeMaterialCost ? material.name : `${material.name} — fornecido pelo cliente`,
    detail: includeMaterialCost ? `${usage.usageDetail}${materialRates}` : "Material usado somente como referência técnica; sem custo e sem baixa no estoque",
    amount: includeMaterialCost ? usage.materialCost : 0,
  }];
  const stockUsages: StockUsage[] = includeMaterialCost
    ? [{ materialId: material.id, materialName: material.name, quantity: usage.stockQuantity, unit: usage.stockUnit, source: "principal" }]
    : [];
  const missingComponents: string[] = [];
  if (input.varnishIncluded && ["lona", "vinil"].includes(material.category)) {
    const varnishArea = usage.productionAreaM2;
    const varnishRate = positive(input.varnishRateM2 || 10);
    lines.push({ key: "protective-varnish", label: "Verniz protetor", detail: `${round(varnishArea, 4)} m² × R$ ${round(varnishRate, 2)}/m²`, amount: varnishArea * varnishRate });
  }
  let machineHours = 0;
  let machineCost = 0;
  if (machine) {
    const productiveHours = Math.max(positive(machine.productive_hours_month), 1);
    const depreciation = Math.max(positive(machine.purchase_cost) - positive(machine.residual_value), 0) / Math.max(machine.useful_life_months * productiveHours, 1);
    const maintenance = positive(machine.maintenance_monthly) / productiveHours;
    const energy = positive(machine.power_kw) * positive(settings.electricity_price_kwh);
    const hourlyConsumables = (machine.pricing_machine_consumables ?? []).filter((item) => item.calculation_basis === "hora" || item.calculation_basis === "mes").reduce((sum, item) => {
      if (positive(item.replacement_cost) <= 0) missingComponents.push(`${item.name} (informe o custo de reposição)`);
      if (item.calculation_basis === "mes") return sum + positive(item.replacement_cost) / Math.max(positive(item.useful_life_months), 0.000001) / productiveHours;
      return sum + positive(item.replacement_cost) / Math.max(positive(item.useful_life_hours), 0.000001);
    }, 0);
    const productionMinutes = positive(input.machineMinutes) > 0
      ? positive(input.machineMinutes)
      : machine.speed_m2_hour ? usage.netAreaM2 / positive(machine.speed_m2_hour) * 60 : 0;
    const totalMinutes = Math.max(positive(machine.minimum_minutes), positive(machine.setup_minutes) + productionMinutes);
    machineHours = totalMinutes / 60;
    const hourlyRate = depreciation + maintenance + energy + hourlyConsumables;
    machineCost = machineHours * hourlyRate;
    lines.push({ key: "machine", label: machine.name, detail: `${round(totalMinutes, 1)} min · custo-hora ${round(hourlyRate, 2)}`, amount: machineCost });
    for (const consumable of (machine.pricing_machine_consumables ?? []).filter((item) => item.calculation_basis === "m2")) {
      if (!consumable.pricing_materials && positive(consumable.replacement_cost) <= 0) missingComponents.push(`${consumable.name} está sem preço por litro/unidade`);
      const baseCost = consumable.pricing_materials ? costPerPurchaseUnit(consumable.pricing_materials) : positive(consumable.replacement_cost);
      const liquidConsumption = consumable.pricing_materials?.format === "litro" || consumable.name.toLocaleLowerCase("pt-BR").includes("tinta");
      const consumptionPerM2 = positive(consumable.consumption_per_m2);
      const consumedQuantity = usage.netAreaM2 * consumptionPerM2 / (liquidConsumption ? 1000 : 1);
      const amount = consumedQuantity * baseCost;
      const unit = liquidConsumption ? "ml" : consumable.pricing_materials?.format === "unidade" ? "un" : consumable.pricing_materials?.format ?? "un";
      lines.push({ key: `consumable-${consumable.id ?? consumable.name}`, label: consumable.name, detail: `${round(consumptionPerM2, 4)} ${unit}/m² × ${round(usage.netAreaM2, 4)} m²`, amount });
      if (consumable.pricing_materials && consumedQuantity > 0) stockUsages.push({
        materialId: consumable.pricing_materials.id,
        materialName: consumable.pricing_materials.name,
        quantity: consumedQuantity,
        unit: liquidConsumption ? "L" : unit,
        source: "maquina",
      });
      machineCost += amount;
    }
  }
  for (const component of product?.pricing_product_components ?? []) {
    if (component.optional) continue;
    if (machine?.machine_type === "grandes_formatos" && component.name.toLocaleLowerCase("pt-BR").startsWith("tinta")) continue;
    const componentMaterial = component.pricing_materials;
    if (!componentMaterial) { missingComponents.push(component.name); continue; }
    const baseQuantity = component.calculation_basis === "net_m2" ? usage.netAreaM2
      : component.calculation_basis === "width_m" ? input.widthMm / 1000 * input.quantity
      : component.calculation_basis === "height_m" ? input.heightMm / 1000 * input.quantity
      : component.calculation_basis === "unit" ? input.quantity : 1;
    const componentQuantity = (baseQuantity * positive(component.quantity_factor) + positive(component.extra_quantity) * input.quantity)
      * (1 + positive(component.waste_percent) / 100);
    const amount = componentQuantity * costPerPurchaseUnit(componentMaterial);
    const unit = componentMaterial.format === "litro" ? "L" : componentMaterial.format === "metro" ? "m" : componentMaterial.format === "unidade" ? "un" : componentMaterial.format;
    lines.push({ key: `recipe-${component.id}`, label: component.name, detail: `${round(componentQuantity, 4)} ${unit}`, amount });
    stockUsages.push({ materialId: componentMaterial.id, materialName: componentMaterial.name, quantity: componentQuantity, unit, source: "receita" });
  }
  const laborHours = positive(input.laborMinutes) / 60;
  const laborCost = laborHours * positive(settings.labor_cost_hour);
  if (laborCost) lines.push({ key: "labor", label: "Mão de obra", detail: `${round(input.laborMinutes || 0, 1)} min`, amount: laborCost });
  const extraCost = positive(input.extraCost);
  if (extraCost) lines.push({ key: "extra", label: "Outros custos diretos", detail: "Acabamentos, acessórios ou terceiros", amount: extraCost });
  // O rateio representa o tempo de ocupação da operação, não a soma de todos os
  // recursos que trabalham no mesmo ciclo. Somar máquina e mão de obra cobrava
  // duas vezes os minutos simultâneos (ex.: impressão enquanto o operador acompanha).
  const overheadHours = Math.max(laborHours, machineHours);
  const overheadRate = positive(settings.overhead_hour);
  const overheadCost = overheadHours * overheadRate;
  if (overheadCost) lines.push({ key: "overhead", label: "Rateio operacional", detail: `${round(overheadHours, 2)} h produtivas × R$ ${round(overheadRate, 2)}/h`, amount: overheadCost });
  const directCost = lines.reduce((sum, line) => sum + line.amount, 0);
  const contingency = directCost * positive(settings.contingency_percent) / 100;
  if (contingency) lines.push({ key: "contingency", label: "Reserva técnica", detail: `${round(settings.contingency_percent, 2)}%`, amount: contingency });
  const totalCost = directCost + contingency;
  const taxPercent = input.invoiceIncluded ? positive(input.invoicePercent ?? settings.tax_percent) : 0;
  const commissionPercent = input.commissionIncluded ? positive(input.commissionPercent ?? settings.commission_percent) : 0;
  const commercialDeductions = taxPercent + commissionPercent;
  const desiredPercent = input.desiredMarginPercent === undefined ? positive(settings.target_margin_percent) : positive(input.desiredMarginPercent);
  const maximumPercent = Math.max(desiredPercent, positive(settings.maximum_margin_percent));
  const profitMode = product?.profit_calculation_mode ?? "margin";
  if (commercialDeductions >= 95 || profitMode === "margin" && commercialDeductions + maximumPercent >= 95) throw new Error("A soma das deduções e da margem deve ser menor que 95%.");
  const minimumPriceRaw = totalCost / Math.max(1 - commercialDeductions / 100, 0.05);
  const priceFor = (percent: number) => profitMode === "markup"
    ? totalCost * (1 + percent / 100) / Math.max(1 - commercialDeductions / 100, 0.05)
    : totalCost / Math.max(1 - (commercialDeductions + percent) / 100, 0.05);
  const averagePriceRaw = priceFor(desiredPercent);
  const maximumPriceRaw = priceFor(maximumPercent);
  const costBasedPrice = averagePriceRaw;
  const billableMeasure = product?.rate_basis === "m2" ? usage.netAreaM2
    : product?.rate_basis === "linear_meter" ? usage.linearMeters
    : product?.rate_basis === "unit" ? input.quantity : 1;
  const tablePrice = product && positive(product.sale_rate) > 0 ? billableMeasure * positive(product.sale_rate) : null;
  const selectedPrice = !includeMaterialCost ? costBasedPrice
    : product?.pricing_method === "table" ? positive(tablePrice)
    : product?.pricing_method === "higher_of" ? Math.max(costBasedPrice, positive(tablePrice))
    : costBasedPrice;
  const suggestedBeforeRound = Math.max(selectedPrice, positive(product?.minimum_price), positive(settings.minimum_order_value));
  const increment = Math.max(positive(product?.rounding_increment || settings.rounding_increment), 0.01);
  const suggestedPrice = Math.ceil(suggestedBeforeRound / increment) * increment;
  const minimumSuggestedPrice = Math.ceil(Math.max(minimumPriceRaw, positive(product?.minimum_price), positive(settings.minimum_order_value)) / increment) * increment;
  const averageSuggestedPrice = Math.ceil(Math.max(averagePriceRaw, positive(product?.minimum_price), positive(settings.minimum_order_value)) / increment) * increment;
  const maximumSuggestedPrice = Math.ceil(Math.max(maximumPriceRaw, positive(product?.minimum_price), positive(settings.minimum_order_value)) / increment) * increment;
  const netProfit = suggestedPrice * (1 - commercialDeductions / 100) - totalCost;
  return {
    model: input.model,
    quantity: input.quantity,
    netAreaM2: round(usage.netAreaM2, 4),
    productionAreaM2: round(usage.productionAreaM2, 4),
    finishingAreaM2: round(usage.finishingAreaM2, 4),
    purchasedAreaM2: round(usage.purchasedAreaM2, 4),
    wasteAreaM2: round(usage.wasteAreaM2, 4),
    wastePercent: round(usage.wastePercent, 3),
    wasteCost: includeMaterialCost ? round(usage.wasteCost, 2) : 0,
    finishingCost: includeMaterialCost ? round(usage.finishingCost, 2) : 0,
    materialCostPerLinearMeter: round(usage.unitCostLinear, 4),
    materialCostPerM2: round(usage.unitCostM2, 4),
    productionWidthMm: round(usage.productionWidthMm, 2),
    productionHeightMm: round(usage.productionHeightMm, 2),
    rotated: usage.rotated,
    materialUsage: usage.usageDetail,
    costLines: lines.map((line) => ({ ...line, amount: round(line.amount) })),
    totalCost: round(totalCost, 2),
    unitCost: round(totalCost / input.quantity, 4),
    suggestedPrice: round(suggestedPrice, 2),
    suggestedUnitPrice: round(suggestedPrice / input.quantity, 4),
    expectedGrossProfit: round(netProfit, 2),
    effectiveMarginPercent: suggestedPrice ? round(netProfit / suggestedPrice * 100, 2) : 0,
    costBasedPrice: round(costBasedPrice, 2),
    tablePrice: tablePrice === null ? null : round(tablePrice, 2),
    pricingMethod: product?.pricing_method ?? "cost_margin",
    rateBasis: product?.rate_basis ?? null,
    saleRate: product ? round(product.sale_rate, 4) : null,
    priceReason: !includeMaterialCost ? `Somente serviço: máquina, consumíveis, mão de obra e ${profitMode === "markup" ? "acréscimo sobre o custo" : "margem real"}; material principal fornecido pelo cliente` : product?.pricing_method === "table" ? `${product.name}: ${round(billableMeasure, 4)} ${product.rate_basis === "m2" ? "m²" : product.rate_basis === "linear_meter" ? "m" : product.rate_basis === "unit" ? "un" : "fixo"} × ${round(product.sale_rate, 2)}` : product?.pricing_method === "higher_of" ? `Maior valor entre tabela comercial e custo + ${profitMode === "markup" ? "acréscimo" : "margem"}` : `Custo técnico + ${profitMode === "markup" ? "acréscimo sobre o custo" : "margem real"} + regras comerciais`,
    minimumSuggestedPrice: round(minimumSuggestedPrice, 2),
    averageSuggestedPrice: round(averageSuggestedPrice, 2),
    maximumSuggestedPrice: round(maximumSuggestedPrice, 2),
    desiredMarginPercent: round(desiredPercent, 2),
    profitCalculationMode: profitMode,
    taxPercent: round(taxPercent, 2),
    commissionPercent: round(commissionPercent, 2),
    materialSuppliedByCustomer: !includeMaterialCost,
    missingComponents,
    stockUsages: stockUsages.map((item) => ({ ...item, quantity: round(item.quantity, 6) })),
  };
}
