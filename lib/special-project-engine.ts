export type SpecialProjectKind = "banner" | "faixa" | "lona_backdrop" | "adesivo_impresso" | "adesivo_impresso_recorte" | "adesivo_cor" | "gravacao_laser" | "estrutura_lona" | "placa_adesivada" | "placa_aplique" | "placa_acm_letra_caixa" | "caixa_expositor" | "envelopamento" | "impressao_rapida" | "letra_caixa" | "medalha" | "neon_led" | "impressao_3d" | "totem" | "luminoso_backlight" | "trofeu" | "cavalete" | "wind_banner" | "vitrine_vidro";

export type ProjectApplique = {
  id?: string;
  label?: string;
  materialId: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
};

export type VectorPiece = { label?: string; widthMm: number; heightMm: number; quantity?: number };
export type AdditionalVinyl = { id?: string; materialId: string; lengthM: number };

type Material = { id: string; name: string; category: string; format: string; package_cost: number; purchase_quantity: number; width_mm?: number | null; usable_width_mm?: number | null; height_mm?: number | null; length_m?: number | null; thickness_mm?: number | null; default_waste_percent: number };
type Machine = { id: string; name: string; machine_type: string; purchase_cost: number; residual_value: number; useful_life_months: number; productive_hours_month: number; maintenance_monthly: number; power_kw: number; setup_minutes: number; minimum_minutes: number; pricing_machine_consumables?: Array<{ id?: string; name: string; calculation_basis: "hora" | "m2" | "mes"; replacement_cost: number; useful_life_hours?: number | null; useful_life_months?: number | null; consumption_per_m2?: number | null; pricing_materials?: Material | null }> };
type Settings = { electricity_price_kwh: number; labor_cost_hour: number; overhead_hour: number; tax_percent: number; commission_percent: number; contingency_percent: number; target_margin_percent: number; maximum_margin_percent: number; minimum_order_value: number; rounding_increment: number };
type Line = { key: string; label: string; detail: string; amount: number };
type Stock = { materialId: string; materialName: string; quantity: number; unit: string; source: string };

export type SpecialProjectInput = {
  kind: SpecialProjectKind; quantity: number; widthMm: number; heightMm: number; depthMm?: number;
  primaryMaterialId: string; secondaryMaterialId?: string; tertiaryMaterialId?: string; machineId?: string; secondaryMachineId?: string;
  woodMaterialId?: string; ropeMaterialId?: string; endCapMaterialId?: string;
  laborMinutes: number; machineMinutes?: number; secondaryMachineMinutes?: number; totalMachineMinutes?: number; installationCost?: number; extraCost?: number;
  desiredMarginPercent: number; invoiceIncluded: boolean; invoicePercent: number; commissionIncluded: boolean; commissionPercent: number;
  reinforcementSpacingMm?: number; doubleFrame?: boolean; allowanceMm?: number; weldingCostPerMeter?: number; paintCost?: number;
  paintIncluded?: boolean; fixingType?: string; fixingCost?: number; fixingMaterialId?: string; fixingSpacingMm?: number; fixingQuantity?: number;
  complexityFactor?: number; wastePercent?: number; removalHours?: number; designHours?: number; printed?: boolean; primaryLinearMeterCost?: number;
  printSides?: number; setupSheets?: number; clickCost?: number; finishingCost?: number;
  letterCount?: number; perimeterMm?: number; illuminated?: boolean; plateLightingType?: "modules" | "linear"; ledModulesPerM2?: number; ledModuleWatts?: number; powerSupplyWatts?: number; powerSupplyUnitCost?: number;
  varnishIncluded?: boolean; varnishRateM2?: number;
  medalShape?: "circular" | "retangular" | "personalizada"; medalSpacingMm?: number; customPerimeterMm?: number;
  ribbonType?: "sem_fita" | "colorida" | "personalizada"; ribbonLengthM?: number; ribbonPrintCostPerMeter?: number;
  medalPersonalization?: "sem_personalizacao" | "gravacao" | "adesivo" | "gravacao_adesivo";
  engravingCoveragePercent?: number; cutSpeedMmMin?: number; engravingSpeedM2Hour?: number; assemblyCostPerUnit?: number; holeDiameterMm?: number;
  adhesiveSides?: number; applicationCostPerM2?: number;
  vinylCutIncluded?: boolean; transferMaskIncluded?: boolean; weedingCost?: number; adhesiveLengthM?: number; additionalVinyls?: AdditionalVinyl[];
  batchProduction?: boolean; batchProductionConfigured?: boolean;
  letterProduction?: "pvc" | "3d"; letterConstruction?: "solida" | "face_retorno"; letterWidthMm?: number; letterHeightMm?: number; letterSpacingMm?: number; filamentWeightGrams?: number; vectorPieces?: VectorPiece[];
  filamentCostPerKg?: number; printTimeHours?: number; supportWastePercent?: number; modelingHours?: number;
  neonLengthM?: number; neonCostPerMeter?: number; neonWattsPerMeter?: number; wiringCost?: number;
  totemFaces?: number; foundationCost?: number; basePlateCost?: number; accessDoorCost?: number; electricalCost?: number;
  dimensionBasis?: "externa" | "interna"; boxStyle?: "aberta" | "fechada" | "com_tampa"; lidType?: "solta" | "articulada" | "correr";
  jointType?: "sobreposta" | "entre_laterais"; verticalDividers?: number; shelves?: number; panelSpacingMm?: number; hardwareCost?: number;
  engravingItemType?: "copo_termico" | "caneca" | "garrafa" | "caneta" | "chaveiro" | "placa" | "outro"; customerSuppliesMaterial?: boolean; rotaryEngraving?: boolean;
  luminosoType?: "lona_backlight" | "acrilico_leitoso" | "acm_vazado"; backPanelCost?: number;
  baseWidthMm?: number; baseDepthMm?: number; trophyBaseLayers?: number; trophyPersonalization?: "gravacao" | "aplique" | "gravacao_aplique" | "uv_adesivo";
  cavaleteStructureMode?: "fabricar" | "pronto"; structureMaterialId?: string;
  windBannerSides?: number; windBannerBaseType?: "agua" | "ferro" | "estaca" | "sem_base";
  glassFilmType?: "perfurado" | "jateado" | "impresso" | "recorte"; heightWorkType?: "terreo" | "escada" | "andaime"; travelCost?: number;
  appliques?: ProjectApplique[];
};

export type SpecialProjectResult = {
  netAreaM2: number; productionAreaM2: number; finishingAreaM2: number; purchasedAreaM2: number; wasteAreaM2: number; wastePercent: number; wasteCost: number; finishingCost: number;
  materialCostPerLinearMeter: number; materialCostPerM2: number; productionWidthMm: number; productionHeightMm: number; rotated: boolean; materialUsage: string;
  totalCost: number; unitCost: number; costBasedPrice: number; tablePrice: null; priceReason: string; suggestedPrice: number; suggestedUnitPrice: number;
  minimumSuggestedPrice: number; averageSuggestedPrice: number; maximumSuggestedPrice: number; desiredMarginPercent: number; missingComponents: string[];
  taxPercent: number; commissionPercent: number; expectedGrossProfit: number; effectiveMarginPercent: number; costLines: Line[]; stockUsages: Stock[]; projectMetrics: Record<string, string | number | boolean>;
  projectInput: SpecialProjectInput;
};

const n = (value: number | null | undefined) => Math.max(0, Number(value ?? 0));
const round = (value: number, decimals = 4) => Number(value.toFixed(decimals));
const isLinearMaterial = (material: Material) => ["rolo", "metro"].includes(material.format);
const unitCost = (material: Material) => material.format === "rolo" && n(material.length_m) ? n(material.package_cost) / n(material.length_m) : n(material.package_cost) / Math.max(n(material.purchase_quantity), .000001);

function roll(material: Material, widthMm: number, heightMm: number, quantity: number, wastePercent: number, allowanceWidth = 0, allowanceHeight = 0, linearMeterCost?: number, allowStrips = false) {
  const rollWidth = n(material.usable_width_mm || material.width_mm);
  if (!isLinearMaterial(material)) throw new Error(`O material “${material.name}” precisa estar cadastrado como Rolo ou Metro linear.`);
  if (!rollWidth) throw new Error(`Informe a largura útil do material “${material.name}”.`);
  if (material.format === "rolo" && !n(material.length_m)) throw new Error(`Complete o comprimento do rolo “${material.name}”.`);
  const pieceW = widthMm + allowanceWidth;
  const pieceH = heightMm + allowanceHeight;
  const layouts = [{ across: pieceW, advance: pieceH, rotated: false }, { across: pieceH, advance: pieceW, rotated: true }]
    .filter((item) => allowStrips || item.across <= rollWidth)
    .map((item) => {
      const strips = item.across <= rollWidth ? 1 : Math.ceil(item.across / rollWidth);
      const columns = strips === 1 ? Math.max(1, Math.floor(rollWidth / item.across)) : 1;
      const length = strips === 1
        ? Math.ceil(quantity / columns) * item.advance / 1000
        : quantity * strips * item.advance / 1000;
      return { ...item, columns, strips, length };
    })
    .sort((a, b) => a.length - b.length);
  if (!layouts.length) throw new Error(`A peça não cabe no rolo “${material.name}” de ${rollWidth} mm.`);
  const best = layouts[0];
  const length = best.length * (1 + wastePercent / 100);
  const purchasedArea = length * rollWidth / 1000;
  const productionArea = pieceW * pieceH * quantity / 1e6;
  return { cost: length * n(linearMeterCost || unitCost(material)), length, purchasedArea, productionArea, wasteArea: Math.max(0, purchasedArea - productionArea), rotated: best.rotated, columns: best.columns, strips: best.strips, rollWidth };
}

function sheet(material: Material, widthMm: number, heightMm: number, quantity: number, wastePercent: number) {
  const sw = n(material.width_mm), sh = n(material.height_mm);
  if (!sw || !sh) throw new Error(`Complete largura e altura da chapa “${material.name}”.`);
  const layouts = [{ c: Math.floor(sw / widthMm) * Math.floor(sh / heightMm), r: false }, { c: Math.floor(sw / heightMm) * Math.floor(sh / widthMm), r: true }].filter((x) => x.c > 0).sort((a, b) => b.c - a.c);
  if (!layouts.length) throw new Error(`A peça não cabe na chapa “${material.name}”.`);
  const sheets = Math.ceil(quantity / layouts[0].c * (1 + wastePercent / 100));
  const purchasedArea = sw * sh * sheets / 1e6, netArea = widthMm * heightMm * quantity / 1e6;
  return { cost: sheets * unitCost(material), sheets, purchasedArea, wasteArea: Math.max(0, purchasedArea - netArea), rotated: layouts[0].r, capacity: layouts[0].c };
}

function nestRectangles(material: Material, pieces: VectorPiece[], spacingMm: number) {
  const sw = n(material.width_mm), sh = n(material.height_mm), spacing = n(spacingMm);
  if (!sw || !sh) throw new Error(`Complete largura e altura da chapa “${material.name}”.`);
  const expanded = pieces.flatMap((piece) => Array.from({ length: Math.max(1, Math.round(n(piece.quantity || 1))) }, () => ({ width: n(piece.widthMm) + spacing, height: n(piece.heightMm) + spacing, netWidth: n(piece.widthMm), netHeight: n(piece.heightMm) })))
    .filter((piece) => piece.width > 0 && piece.height > 0)
    .sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));
  if (!expanded.length) throw new Error("O arquivo vetorial não possui peças mensuráveis.");
  type Shelf = { y: number; height: number; used: number };
  const bins: Array<{ shelves: Shelf[] }> = [];
  const orientations = (piece: typeof expanded[number]) => [{ w: piece.width, h: piece.height }, { w: piece.height, h: piece.width }];
  for (const piece of expanded) {
    if (!orientations(piece).some(({ w, h }) => w <= sw && h <= sh)) throw new Error(`Uma das peças vetoriais (${round(piece.netWidth, 1)} × ${round(piece.netHeight, 1)} mm) não cabe na chapa “${material.name}”.`);
    let placed = false;
    for (const bin of bins) {
      for (const shelf of bin.shelves) {
        const fit = orientations(piece).find(({ w, h }) => h <= shelf.height && shelf.used + w <= sw);
        if (fit) { shelf.used += fit.w; placed = true; break; }
      }
      if (placed) break;
      const usedHeight = bin.shelves.reduce((sum, shelf) => sum + shelf.height, 0);
      const fit = orientations(piece).filter(({ w, h }) => w <= sw && usedHeight + h <= sh).sort((a, b) => a.h - b.h)[0];
      if (fit) { bin.shelves.push({ y: usedHeight, height: fit.h, used: fit.w }); placed = true; break; }
    }
    if (!placed) {
      const fit = orientations(piece).filter(({ w, h }) => w <= sw && h <= sh).sort((a, b) => a.h - b.h)[0];
      bins.push({ shelves: [{ y: 0, height: fit.h, used: fit.w }] });
    }
  }
  const netArea = expanded.reduce((sum, piece) => sum + piece.netWidth * piece.netHeight / 1e6, 0);
  const envelopeArea = expanded.reduce((sum, piece) => sum + piece.width * piece.height / 1e6, 0);
  return { sheets: bins.length, pieces: expanded.length, netArea, envelopeArea, availableArea: bins.length * sw * sh / 1e6 };
}

function sheetOrPanels(material: Material, widthMm: number, heightMm: number, quantity: number, wastePercent: number) {
  const sw = n(material.width_mm), sh = n(material.height_mm);
  if (!sw || !sh) throw new Error(`Complete largura e altura da chapa “${material.name}”.`);
  if ((widthMm <= sw && heightMm <= sh) || (widthMm <= sh && heightMm <= sw)) {
    return { ...sheet(material, widthMm, heightMm, quantity, wastePercent), panelized: false, panels: quantity, panelsPerItem: 1, verticalSeams: 0, horizontalSeams: 0, panelDescription: `${round(widthMm, 1)} × ${round(heightMm, 1)} mm` };
  }

  const partition = (maxWidth: number, maxHeight: number) => {
    const columns = Math.ceil(widthMm / maxWidth), rows = Math.ceil(heightMm / maxHeight);
    const panelWidth = widthMm / columns, panelHeight = heightMm / rows;
    const panels = columns * rows * quantity;
    const nesting = nestRectangles(material, [{ widthMm: panelWidth, heightMm: panelHeight, quantity: panels }], 0);
    return { columns, rows, panelWidth, panelHeight, panels, nesting };
  };
  const best = [partition(sw, sh), partition(sh, sw)].sort((a, b) => a.nesting.sheets - b.nesting.sheets || a.panels - b.panels)[0];
  const sheets = Math.ceil(best.nesting.sheets * (1 + wastePercent / 100));
  const purchasedArea = sw * sh * sheets / 1e6;
  const netArea = widthMm * heightMm * quantity / 1e6;
  return {
    cost: sheets * unitCost(material), sheets, purchasedArea, wasteArea: Math.max(0, purchasedArea - netArea), rotated: best.panelWidth > sw || best.panelHeight > sh,
    capacity: 1, panelized: true, panels: best.panels, panelsPerItem: best.columns * best.rows,
    verticalSeams: Math.max(0, best.columns - 1), horizontalSeams: Math.max(0, best.rows - 1),
    panelDescription: `${best.columns} coluna(s) × ${best.rows} fileira(s), módulos de aproximadamente ${round(best.panelWidth, 1)} × ${round(best.panelHeight, 1)} mm`,
  };
}

function machineLine(machine: Machine | undefined, settings: Settings, minutes: number, area: number, lines: Line[], stock: Stock[], keyPrefix = "machine") {
  if (!machine) return 0;
  const hoursMonth = Math.max(n(machine.productive_hours_month), 1);
  const depreciation = Math.max(n(machine.purchase_cost) - n(machine.residual_value), 0) / Math.max(n(machine.useful_life_months) * hoursMonth, 1);
  const rate = depreciation + n(machine.maintenance_monthly) / hoursMonth + n(machine.power_kw) * n(settings.electricity_price_kwh) + (machine.pricing_machine_consumables ?? []).reduce((sum, item) => item.calculation_basis === "hora" ? sum + n(item.replacement_cost) / Math.max(n(item.useful_life_hours), .0001) : item.calculation_basis === "mes" ? sum + n(item.replacement_cost) / Math.max(n(item.useful_life_months) * hoursMonth, .0001) : sum, 0);
  const totalMinutes = Math.max(n(machine.minimum_minutes), n(machine.setup_minutes) + n(minutes));
  let cost = totalMinutes / 60 * rate;
  lines.push({ key: keyPrefix, label: machine.name, detail: `${round(totalMinutes, 1)} min · R$ ${round(rate, 2)}/h`, amount: cost });
  for (const item of (machine.pricing_machine_consumables ?? []).filter((x) => x.calculation_basis === "m2")) {
    const liquid = item.name.toLowerCase().includes("tinta");
    const qty = area * n(item.consumption_per_m2) / (liquid ? 1000 : 1);
    const amount = qty * (item.pricing_materials ? unitCost(item.pricing_materials) : n(item.replacement_cost));
    cost += amount;
    lines.push({ key: `${keyPrefix}-${item.id ?? item.name}`, label: item.name, detail: `${round(qty * (liquid ? 1000 : 1), 2)} ${liquid ? "ml" : "un"} para ${round(area, 3)} m²`, amount });
    if (item.pricing_materials && qty > 0) stock.push({ materialId: item.pricing_materials.id, materialName: item.pricing_materials.name, quantity: qty, unit: liquid ? "L" : item.pricing_materials.format, source: "maquina" });
  }
  return cost;
}

function fixingLine(input: SpecialProjectInput, materials: Material[], perimeterM: number, lines: Line[], stock: Stock[], metrics: Record<string, string | number | boolean>, perimeterFormula = "") {
  const fixing = materials.find((item) => item.id === input.fixingMaterialId);
  let calculatedQuantity = 0;
  if (fixing) {
    const override = n(input.fixingQuantity);
    const linear = fixing.format === "rolo" || fixing.format === "metro";
    const unitary = fixing.format === "unidade";
    if (override > 0) calculatedQuantity = override;
    else if (linear) calculatedQuantity = perimeterM;
    else if (unitary) calculatedQuantity = Math.max(4, Math.ceil(perimeterM * 1000 / Math.max(n(input.fixingSpacingMm), 50)));
    else calculatedQuantity = 1;
    const amount = calculatedQuantity * unitCost(fixing);
    const unit = linear ? "m" : unitary ? "un" : fixing.format;
    const detail = override > 0
      ? `${round(calculatedQuantity, 3)} ${unit} informados para o projeto`
      : linear
        ? `${perimeterFormula ? `${perimeterFormula} · ` : ""}${round(perimeterM, 3)} m de perímetro = ${round(calculatedQuantity, 3)} m de fixação`
        : unitary
          ? `${round(perimeterM, 3)} m de perímetro · 1 ponto a cada ${round(Math.max(n(input.fixingSpacingMm), 50), 0)} mm = ${Math.ceil(calculatedQuantity)} unidade(s)`
          : `${round(calculatedQuantity, 3)} ${unit} por projeto`;
    lines.push({ key: "automatic-fixing", label: `Fixação · ${fixing.name}`, detail, amount });
    stock.push({ materialId: fixing.id, materialName: fixing.name, quantity: calculatedQuantity, unit, source: "fixacao" });
    Object.assign(metrics, { fixingMaterial: fixing.name, fixingQuantity: round(calculatedQuantity, 3), fixingUnit: unit, fixingPerimeterM: round(perimeterM, 3), fixingSpacingMm: unitary ? Math.max(n(input.fixingSpacingMm), 50) : 0 });
  }
  if (n(input.fixingCost)) lines.push({ key: "fixing-extra", label: `Fixação complementar${input.fixingType ? ` · ${input.fixingType}` : ""}`, detail: fixing ? "Custo adicional além do insumo calculado" : "Custo direto informado neste orçamento", amount: n(input.fixingCost) });
  if (!fixing && (input.fixingType || n(input.fixingCost))) Object.assign(metrics, { fixing: input.fixingType || "custo direto", fixingPerimeterM: round(perimeterM, 3) });
}

function finish(input: SpecialProjectInput, settings: Settings, lines: Line[], baseMetrics: Omit<SpecialProjectResult, "totalCost" | "unitCost" | "costBasedPrice" | "tablePrice" | "priceReason" | "suggestedPrice" | "suggestedUnitPrice" | "minimumSuggestedPrice" | "averageSuggestedPrice" | "maximumSuggestedPrice" | "desiredMarginPercent" | "taxPercent" | "commissionPercent" | "missingComponents" | "expectedGrossProfit" | "effectiveMarginPercent" | "costLines" | "stockUsages" | "projectMetrics" | "projectInput">, stockUsages: Stock[], projectMetrics: Record<string, string | number | boolean>, missingComponents: string[] = []): SpecialProjectResult {
  const laborHours = n(input.laborMinutes) / 60;
  if (laborHours) lines.push({ key: "labor", label: "Mão de obra", detail: `${round(input.laborMinutes, 1)} min`, amount: laborHours * n(settings.labor_cost_hour) });
  const fullOperationalMinutes = Math.max(n(input.laborMinutes), n(input.totalMachineMinutes ?? input.machineMinutes));
  const groupedOperationalMinutes = Math.min(fullOperationalMinutes, Math.max(5, 5 + n(baseMetrics.netAreaM2) * 15 + Math.ceil(Math.max(n(input.quantity), 1) / 10) * 2));
  const overheadMinutes = input.batchProduction ? groupedOperationalMinutes : fullOperationalMinutes;
  const overheadHours = overheadMinutes / 60;
  if (overheadHours && n(settings.overhead_hour)) lines.push({ key: "overhead", label: input.batchProduction ? "Rateio operacional agrupado" : "Rateio operacional", detail: input.batchProduction ? `${round(overheadMinutes, 1)} min equivalentes do lote × R$ ${round(n(settings.overhead_hour), 2)}/h · produção compartilhada com outros trabalhos` : `${round(overheadHours, 2)} h produtivas × R$ ${round(n(settings.overhead_hour), 2)}/h`, amount: overheadHours * n(settings.overhead_hour) });
  if (n(input.installationCost)) lines.push({ key: "installation", label: "Instalação terceirizada", detail: "Custo informado para este trabalho", amount: n(input.installationCost) });
  if (n(input.extraCost)) lines.push({ key: "extra", label: "Outros custos", detail: "Frete, arte, acabamento ou terceiro", amount: n(input.extraCost) });
  let direct = lines.reduce((sum, line) => sum + line.amount, 0);
  const contingency = direct * n(settings.contingency_percent) / 100;
  if (contingency) lines.push({ key: "contingency", label: "Reserva técnica", detail: `${settings.contingency_percent}%`, amount: contingency });
  direct += contingency;
  const tax = input.invoiceIncluded ? n(input.invoicePercent || settings.tax_percent) : 0;
  const commission = input.commissionIncluded ? n(input.commissionPercent || settings.commission_percent) : 0;
  const margin = n(input.desiredMarginPercent || settings.target_margin_percent), maxMargin = Math.max(margin, n(settings.maximum_margin_percent));
  if (tax + commission + maxMargin >= 95) throw new Error("Impostos, comissão e margem somados precisam ser menores que 95%.");
  const price = (appliedMargin: number) => direct / Math.max(1 - (tax + commission + appliedMargin) / 100, .05);
  const increment = Math.max(n(settings.rounding_increment), .01);
  const rounded = (value: number) => Math.ceil(Math.max(value, n(settings.minimum_order_value)) / increment) * increment;
  const minimum = rounded(price(0)), average = rounded(price(margin)), maximum = rounded(price(maxMargin));
  const qty = Math.max(n(input.quantity), 1), profit = average * (1 - (tax + commission) / 100) - direct;
  return { ...baseMetrics, totalCost: round(direct, 2), unitCost: round(direct / qty, 4), costBasedPrice: round(price(margin), 2), tablePrice: null, priceReason: "Custo técnico completo + despesas + margem configurada", suggestedPrice: round(average, 2), suggestedUnitPrice: round(average / qty, 4), minimumSuggestedPrice: round(minimum, 2), averageSuggestedPrice: round(average, 2), maximumSuggestedPrice: round(maximum, 2), desiredMarginPercent: margin, taxPercent: round(tax, 2), commissionPercent: round(commission, 2), missingComponents, expectedGrossProfit: round(profit, 2), effectiveMarginPercent: average ? round(profit / average * 100, 2) : 0, costLines: lines.map((x) => ({ ...x, amount: round(x.amount, 4) })), stockUsages: stockUsages.map((x) => ({ ...x, quantity: round(x.quantity, 6) })), projectMetrics, projectInput: { ...input } };
}

export function calculateSpecialProject(input: SpecialProjectInput, materials: Material[], machines: Machine[], settings: Settings): SpecialProjectResult {
  const selectedPrimary = materials.find((x) => x.id === input.primaryMaterialId);
  const primary = selectedPrimary ?? (
    input.kind === "gravacao_laser" && input.customerSuppliesMaterial
      ? { id: "customer-supplied", name: "Material fornecido pelo cliente", category: "outro", format: "unidade", package_cost: 0, purchase_quantity: 1, default_waste_percent: 0 }
      : input.kind === "wind_banner" && (n(input.finishingCost) > 0 || n(input.hardwareCost) > 0 || n(input.basePlateCost) > 0)
        ? { id: "outsourced-wind-banner", name: "Bandeira / tecido terceirizado", category: "tecido", format: "unidade", package_cost: 0, purchase_quantity: 1, default_waste_percent: 0 }
        : undefined
  );
  if (!primary) throw new Error("Selecione o insumo principal.");
  const secondary = materials.find((x) => x.id === input.secondaryMaterialId);
  const tertiary = materials.find((x) => x.id === input.tertiaryMaterialId);
  const machine = machines.find((x) => x.id === input.machineId);
  const secondaryMachine = machines.find((x) => x.id === input.secondaryMachineId);
  const q = Math.max(1, n(input.quantity)), w = n(input.widthMm), h = n(input.heightMm), area = w * h * q / 1e6;
  if (!w || !h) throw new Error("Informe largura e altura do projeto.");
  const lines: Line[] = [], stock: Stock[] = [], metrics: Record<string, string | number | boolean> = {};
  let purchasedArea = 0, wasteArea = 0, materialCost = 0, calculatedWasteCost = 0, rotated = false, materialUsage = "", effectiveArea = area, varnishArea = area, calculatedMachineMinutes = n(input.machineMinutes), secondaryMachineArea = area;

  if (input.kind === "gravacao_laser") {
    const supplied = Boolean(input.customerSuppliesMaterial);
    const itemType = input.engravingItemType || "copo_termico";
    const minutesPerUnit = n(input.machineMinutes);
    if (!machine || machine.machine_type !== "laser") throw new Error("Selecione a máquina laser usada na gravação.");
    if (!minutesPerUnit) throw new Error("Informe o tempo de gravação por unidade.");
    calculatedMachineMinutes = minutesPerUnit * q;
    effectiveArea = area;
    purchasedArea = 0;
    wasteArea = 0;
    if (supplied) {
      lines.push({ key: "engraving-customer-item", label: "Material fornecido pelo cliente", detail: `${q} unidade(s) recebida(s) somente para gravação`, amount: 0 });
      materialUsage = `${q} unidade(s) fornecida(s) pelo cliente`;
    } else if (primary) {
      if (primary.format !== "unidade") throw new Error("Para gravação em copos e objetos, cadastre o insumo no formato Unidade.");
      const itemCost = q * unitCost(primary);
      materialCost = itemCost;
      lines.push({ key: "engraving-items", label: primary.name, detail: `${q} unidade(s) × R$ ${round(unitCost(primary), 2)}`, amount: itemCost });
      stock.push({ materialId: primary.id, materialName: primary.name, quantity: q, unit: "un", source: "gravacao-laser" });
      materialUsage = `${q} unidade(s) de ${primary.name}`;
    }
    if (n(input.finishingCost)) lines.push({ key: "engraving-finishing", label: "Limpeza, acabamento e embalagem", detail: "Custo direto informado para o lote", amount: n(input.finishingCost) });
    Object.assign(metrics, { engravingItemType: itemType, quantity: q, engravingWidthMm: w, engravingHeightMm: h, engravingAreaCm2: round(w * h / 100, 2), minutesPerUnit: round(minutesPerUnit, 2), totalLaserMinutes: round(calculatedMachineMinutes, 2), rotaryEngraving: Boolean(input.rotaryEngraving), materialSuppliedByCustomer: supplied });
  } else if (input.kind === "lona_backdrop") {
    if (!isLinearMaterial(primary) || primary.category !== "lona" && !/lona/i.test(primary.name)) throw new Error("Selecione uma lona cadastrada como Rolo ou Metro linear.");
    const allowance = n(input.allowanceMm);
    const layout = roll(primary, w, h, q, n(input.wastePercent || primary.default_waste_percent), allowance * 2, allowance * 2, undefined, true);
    purchasedArea = layout.purchasedArea; wasteArea = layout.wasteArea; rotated = layout.rotated; materialCost = layout.cost; effectiveArea = layout.productionArea; varnishArea = layout.productionArea;
    calculatedWasteCost = layout.purchasedArea ? layout.cost * layout.wasteArea / layout.purchasedArea : 0;
    lines.push({ key: "backdrop-canvas", label: primary.name, detail: `${round(layout.length, 3)} m lineares · sobra de ${round(allowance, 0)} mm em todo o perímetro${layout.strips > 1 ? ` · dividido em ${layout.strips} faixa(s) para emenda` : ""} · ${layout.rotated ? "girada 90°" : "normal"}`, amount: layout.cost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: layout.length, unit: "m", source: "lona-backdrop" });
    if (n(input.finishingCost)) lines.push({ key: "backdrop-finishing", label: "Acabamento complementar", detail: input.fixingType || "Custo direto informado", amount: n(input.finishingCost) });
    materialUsage = `${round(layout.length, 2)} m de ${primary.name}${input.fixingType ? ` · acabamento: ${input.fixingType}` : ""}`;
    Object.assign(metrics, { product: "Lona backdrop", canvasLinearM: round(layout.length, 3), finishingAllowanceMm: allowance, finish: input.fixingType || "não informado", panels: layout.strips, rotated: layout.rotated });
  } else if (input.kind === "banner" || input.kind === "faixa") {
    if (!isLinearMaterial(primary) || primary.category !== "lona" && !/lona/i.test(primary.name)) throw new Error("Selecione uma lona cadastrada como Rolo ou Metro linear.");
    const allowance = n(input.allowanceMm);
    const banner = input.kind === "banner";
    const layout = roll(primary, w, h, q, n(input.wastePercent || primary.default_waste_percent), banner ? 0 : allowance * 2, banner ? allowance * 2 : 0);
    purchasedArea = layout.purchasedArea; wasteArea = layout.wasteArea; rotated = layout.rotated; materialCost = layout.cost; effectiveArea = layout.productionArea; varnishArea = layout.productionArea;
    calculatedWasteCost = layout.purchasedArea ? layout.cost * layout.wasteArea / layout.purchasedArea : 0;
    lines.push({ key: "printed-canvas", label: primary.name, detail: `${round(layout.length, 3)} m lineares · margem de acabamento ${round(allowance, 0)} mm em cada ${banner ? "borda horizontal" : "lateral"} · ${layout.rotated ? "girada 90°" : "normal"}`, amount: layout.cost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: layout.length, unit: "m", source: input.kind });

    const addAccessory = (id: string | undefined, required: number, label: string, key: string, piecesWhenUnit?: number) => {
      const item = materials.find((entry) => entry.id === id);
      if (!item) throw new Error(`Selecione ${label.toLowerCase()}.`);
      let quantity = required, unit = "m", amount = 0;
      if (item.format === "barra") {
        const barLength = n(item.length_m);
        if (!barLength) throw new Error(`Informe o comprimento da barra “${item.name}”.`);
        quantity = Math.ceil(required / barLength);
        unit = "un";
        amount = quantity * unitCost(item);
      } else if (isLinearMaterial(item)) {
        amount = required * unitCost(item);
      } else if (item.format === "unidade" && piecesWhenUnit !== undefined) {
        quantity = Math.ceil(piecesWhenUnit);
        unit = "un";
        amount = quantity * unitCost(item);
      } else {
        quantity = Math.ceil(required);
        unit = "un";
        amount = quantity * unitCost(item);
      }
      lines.push({ key, label: item.name, detail: `${round(quantity, 3)} ${unit} · ${label}`, amount });
      stock.push({ materialId: item.id, materialName: item.name, quantity, unit, source: key });
      materialCost += amount;
      return item.name;
    };
    const woodM = (banner ? 2 * w : 2 * h) / 1000 * q;
    const ropeM = (banner ? w + 50 : 2 * (h + 50)) / 1000 * q;
    const woodName = addAccessory(input.woodMaterialId, woodM, banner ? "duas madeirinhas horizontais" : "duas madeirinhas laterais", "wood-finish", 2 * q);
    const ropeName = addAccessory(input.ropeMaterialId, ropeM, banner ? "cordinha superior com 5 cm de sobra" : "duas cordas laterais com 5 cm de sobra", "rope-finish");
    const capName = addAccessory(input.endCapMaterialId, 4 * q, "quatro ponteiras por unidade", "end-caps");
    if (n(input.finishingCost)) lines.push({ key: "canvas-finishing", label: "Acabamento complementar", detail: "Refilo, cola ou custo direto informado", amount: n(input.finishingCost) });
    materialUsage = `${round(layout.length, 2)} m de ${primary.name} + ${round(woodM, 2)} m de ${woodName} + ${round(ropeM, 2)} m de ${ropeName} + ${4 * q} ${capName}`;
    Object.assign(metrics, { product: banner ? "Banner" : "Faixa", canvasLinearM: round(layout.length, 3), finishingAllowanceMm: allowance, woodLinearM: round(woodM, 3), ropeLinearM: round(ropeM, 3), endCaps: 4 * q, rotated: layout.rotated });
  } else if (input.kind === "adesivo_cor") {
    if (!isLinearMaterial(primary) || primary.category !== "vinil" && !/adesivo|vinil/i.test(primary.name)) throw new Error("Selecione um adesivo na cor em Rolo ou Metro linear.");
    const waste = n(input.wastePercent || primary.default_waste_percent);
    const vinyl = roll(primary, w, h, q, waste, 0, 0, n(input.primaryLinearMeterCost) || undefined, true);
    purchasedArea = vinyl.purchasedArea; wasteArea = vinyl.wasteArea; rotated = vinyl.rotated; materialCost = vinyl.cost; effectiveArea = vinyl.productionArea; varnishArea = vinyl.productionArea;
    calculatedWasteCost = vinyl.purchasedArea ? vinyl.cost * vinyl.wasteArea / vinyl.purchasedArea : 0;
    const cut = Boolean(input.vinylCutIncluded);
    lines.push({ key: "color-vinyl", label: primary.name, detail: `${round(vinyl.length, 3)} m lineares${vinyl.strips > 1 ? ` · dividido em ${vinyl.strips} faixa(s)` : ""} · ${cut ? "recorte eletrônico" : "adesivo liso, sem recorte"}`, amount: vinyl.cost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: vinyl.length, unit: "m", source: cut ? "adesivo-cor-recorte" : "adesivo-cor-liso" });
    const extraColors: string[] = [];
    for (const extra of input.additionalVinyls ?? []) {
      const item = materials.find((entry) => entry.id === extra.materialId);
      if (!item || !isLinearMaterial(item)) continue;
      const length = n(extra.lengthM);
      if (!length) continue;
      const amount = length * unitCost(item);
      lines.push({ key: `color-vinyl-extra-${extra.id ?? item.id}`, label: item.name, detail: `${round(length, 3)} m lineares · cor adicional`, amount });
      stock.push({ materialId: item.id, materialName: item.name, quantity: length, unit: "m", source: "adesivo-cor-adicional" });
      materialCost += amount; extraColors.push(item.name);
    }
    let maskName = "";
    if (cut && input.transferMaskIncluded && tertiary) {
      const mask = roll(tertiary, w, h, q, n(tertiary.default_waste_percent) + waste, 0, 0, undefined, true);
      lines.push({ key: "color-vinyl-mask", label: tertiary.name, detail: `${round(mask.length, 3)} m lineares · máscara de transferência`, amount: mask.cost });
      stock.push({ materialId: tertiary.id, materialName: tertiary.name, quantity: mask.length, unit: "m", source: "mascara-transferencia" });
      materialCost += mask.cost; purchasedArea += mask.purchasedArea; wasteArea += mask.wasteArea; maskName = tertiary.name;
      calculatedWasteCost += mask.purchasedArea ? mask.cost * mask.wasteArea / mask.purchasedArea : 0;
    }
    if (cut && n(input.weedingCost)) lines.push({ key: "color-vinyl-weeding", label: "Depilação e preparação", detail: "Retirada do excesso e preparação para transferência", amount: n(input.weedingCost) });
    if (n(input.finishingCost)) lines.push({ key: "color-vinyl-finishing", label: "Acabamento", detail: cut ? "Separação e embalagem" : "Refilo, separação e embalagem", amount: n(input.finishingCost) });
    materialUsage = `${round(vinyl.length, 2)} m de ${primary.name}${extraColors.length ? ` + ${extraColors.join(" + ")}` : ""}${maskName ? ` + máscara ${maskName}` : ""}`;
    Object.assign(metrics, { product: cut ? "Adesivo na cor com recorte" : "Adesivo na cor liso", vinylLinearM: round(vinyl.length, 3), electronicCut: cut, transferMask: Boolean(maskName), additionalColors: extraColors.length, rotated: vinyl.rotated, batchProduction: Boolean(input.batchProduction) });
  } else if (input.kind === "adesivo_impresso" || input.kind === "adesivo_impresso_recorte") {
    if (!isLinearMaterial(primary) || primary.category !== "vinil" && !/adesivo|vinil/i.test(primary.name)) throw new Error("Selecione um adesivo para impressão em Rolo ou Metro linear.");
    const waste = n(input.wastePercent || primary.default_waste_percent);
    const vinyl = roll(primary, w, h, q, waste, 0, 0, n(input.primaryLinearMeterCost) || undefined, true);
    purchasedArea = vinyl.purchasedArea; wasteArea = vinyl.wasteArea; rotated = vinyl.rotated; materialCost = vinyl.cost; effectiveArea = vinyl.productionArea; varnishArea = vinyl.productionArea;
    calculatedWasteCost = vinyl.purchasedArea ? vinyl.cost * vinyl.wasteArea / vinyl.purchasedArea : 0;
    lines.push({ key: "printed-vinyl", label: primary.name, detail: `${round(vinyl.length, 3)} m lineares${vinyl.strips > 1 ? ` · dividido em ${vinyl.strips} faixa(s)` : ""} · impressão digital`, amount: vinyl.cost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: vinyl.length, unit: "m", source: "adesivo-impresso" });
    let protectionName = "", maskName = "";
    if (secondary) {
      const protection = roll(secondary, w, h, q, n(secondary.default_waste_percent) + waste, 0, 0, undefined, true);
      lines.push({ key: "printed-vinyl-protection", label: secondary.name, detail: `${round(protection.length, 3)} m lineares · laminação protetora`, amount: protection.cost });
      stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: protection.length, unit: "m", source: "laminacao" });
      materialCost += protection.cost; purchasedArea += protection.purchasedArea; wasteArea += protection.wasteArea; protectionName = secondary.name;
      calculatedWasteCost += protection.purchasedArea ? protection.cost * protection.wasteArea / protection.purchasedArea : 0;
    }
    if (input.kind === "adesivo_impresso_recorte" && tertiary) {
      const mask = roll(tertiary, w, h, q, n(tertiary.default_waste_percent) + waste, 0, 0, undefined, true);
      lines.push({ key: "printed-cut-mask", label: tertiary.name, detail: `${round(mask.length, 3)} m lineares · máscara de transferência`, amount: mask.cost });
      stock.push({ materialId: tertiary.id, materialName: tertiary.name, quantity: mask.length, unit: "m", source: "mascara-transferencia" });
      materialCost += mask.cost; purchasedArea += mask.purchasedArea; wasteArea += mask.wasteArea; maskName = tertiary.name;
      calculatedWasteCost += mask.purchasedArea ? mask.cost * mask.wasteArea / mask.purchasedArea : 0;
    }
    if (input.kind === "adesivo_impresso_recorte" && n(input.weedingCost)) lines.push({ key: "printed-cut-weeding", label: "Depilação e preparação", detail: "Retirada do excesso e preparação para transferência", amount: n(input.weedingCost) });
    if (n(input.finishingCost)) lines.push({ key: "printed-vinyl-finishing", label: "Acabamento", detail: "Refilo, separação e embalagem", amount: n(input.finishingCost) });
    materialUsage = `${round(vinyl.length, 2)} m de ${primary.name}${protectionName ? ` + laminação ${protectionName}` : ""}${maskName ? ` + máscara ${maskName}` : ""}`;
    Object.assign(metrics, { product: input.kind === "adesivo_impresso_recorte" ? "Adesivo impresso com recorte" : "Adesivo impresso", vinylLinearM: round(vinyl.length, 3), laminated: Boolean(secondary), electronicCut: input.kind === "adesivo_impresso_recorte", transferMask: Boolean(tertiary), rotated: vinyl.rotated });
  } else if (input.kind === "estrutura_lona") {
    if (!secondary) throw new Error("Selecione também a lona da estrutura.");
    const barLength = n(primary.length_m);
    if (!barLength) throw new Error("Cadastre o comprimento da barra de metalon.");
    const spacing = Math.max(n(input.reinforcementSpacingMm), 300), depth = n(input.depthMm) / 1000;
    const widthM = w / 1000, heightM = h / 1000;
    const verticals = Math.max(0, Math.ceil(widthM / (spacing / 1000)) - 1), horizontals = Math.max(0, Math.ceil(heightM / (spacing / 1000)) - 1);
    const frameFactor = input.doubleFrame ? 2 : 1;
    const usedM = ((2 * (widthM + heightM) + verticals * heightM + horizontals * widthM) * frameFactor + (depth ? 4 * depth : 0)) * q;
    const bars = Math.ceil(usedM / barLength), chargedM = bars * barLength, barCost = bars * unitCost(primary);
    lines.push({ key: "metalon", label: primary.name, detail: `${bars} barra(s) de ${barLength} m · ${round(usedM, 2)} m usados · ${round(chargedM - usedM, 2)} m de sobra`, amount: barCost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: bars, unit: "un", source: "estrutura" });
    const allowance = n(input.allowanceMm) * 2;
    let coatingCost = 0;
    if (isLinearMaterial(secondary)) {
      const coating = roll(secondary, w, h, q, n(input.wastePercent || secondary.default_waste_percent), allowance, allowance);
      lines.push({ key: "coating", label: secondary.name, detail: `${round(coating.length, 3)} m lineares · ${coating.rotated ? "girada 90°" : "normal"}`, amount: coating.cost });
      stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: coating.length, unit: "m", source: "revestimento" });
      coatingCost = coating.cost; purchasedArea = coating.purchasedArea; wasteArea = coating.wasteArea; rotated = coating.rotated; varnishArea = coating.productionArea;
      calculatedWasteCost = coating.purchasedArea ? coating.cost * coating.wasteArea / coating.purchasedArea : 0;
      materialUsage = `${bars} barras de metalon + ${round(coating.length, 2)} m de ${secondary.name}`;
    } else {
      const coating = sheetOrPanels(secondary, w, h, q, n(input.wastePercent || secondary.default_waste_percent));
      lines.push({ key: "coating", label: secondary.name, detail: coating.panelized ? `${coating.sheets} chapa(s) · ${coating.panelsPerItem} módulo(s) por fachada · ${coating.panelDescription} · ${coating.verticalSeams + coating.horizontalSeams} emenda(s)` : `${coating.sheets} chapa(s) · ${coating.capacity} peça(s) por chapa`, amount: coating.cost });
      stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: coating.sheets, unit: "un", source: "revestimento" });
      coatingCost = coating.cost; purchasedArea = coating.purchasedArea; wasteArea = coating.wasteArea; rotated = coating.rotated;
      calculatedWasteCost = coating.purchasedArea ? coating.cost * coating.wasteArea / coating.purchasedArea : 0;
      materialUsage = `${bars} barras de metalon + ${coating.sheets} chapa(s) de ${secondary.name}${coating.panelized ? ` em ${coating.panelsPerItem} módulos por fachada` : ""}`;
      if (coating.panelized) Object.assign(metrics, { coatingPanelsPerItem: coating.panelsPerItem, coatingPanelPlan: coating.panelDescription, coatingVerticalSeams: coating.verticalSeams, coatingHorizontalSeams: coating.horizontalSeams });
    }
    const weldM = (4 * frameFactor + (verticals + horizontals) * 2 + (depth ? 8 : 0)) * .04 * q;
    if (n(input.weldingCostPerMeter)) lines.push({ key: "welding", label: "Solda e consumíveis", detail: `${round(weldM, 2)} m estimados de cordão`, amount: weldM * n(input.weldingCostPerMeter) });
    if (input.paintIncluded && n(input.paintCost)) lines.push({ key: "paint", label: "Fundo, primer e pintura da estrutura", detail: "Custo direto informado neste orçamento", amount: n(input.paintCost) });
    materialCost = barCost + coatingCost;
    Object.assign(metrics, { bars, barLengthM: barLength, profileUsedM: round(usedM, 3), profileWasteM: round(chargedM - usedM, 3), verticalReinforcements: verticals, horizontalReinforcements: horizontals, estimatedWeldM: round(weldM, 2), painted: Boolean(input.paintIncluded), fixing: input.fixingType || "não informado" });
  } else if (input.kind === "placa_adesivada") {
    if (primary.format !== "chapa") throw new Error("A base da placa precisa estar cadastrada como chapa.");
    if (!secondary || !isLinearMaterial(secondary) || secondary.category !== "vinil" && !/adesivo|vinil/i.test(secondary.name)) throw new Error("Selecione o adesivo cadastrado como Vinil em formato Rolo ou Metro linear.");
    const sides = Math.max(1, Math.min(2, Math.round(n(input.adhesiveSides || 1))));
    const extraWaste = n(input.wastePercent);
    const boardWaste = n(primary.default_waste_percent) + extraWaste;
    const stickerWaste = n(secondary.default_waste_percent) + extraWaste;
    // A perda técnica não pode aumentar uma chapa única para duas apenas por
    // arredondamento (ex.: ceil(1 × 1,10) = 2). Primeiro calculamos quantas
    // chapas físicas precisam ser separadas e depois apropriamos somente a área
    // usada + perda configurada. O restante continua disponível como retalho.
    const boardLayout = sheetOrPanels(primary, w, h, q, 0);
    const boardSheetArea = n(primary.width_mm) * n(primary.height_mm) / 1e6;
    const boardNetArea = w * h * q / 1e6;
    const boardAvailableArea = boardLayout.sheets * boardSheetArea;
    const boardChargeableArea = Math.min(boardAvailableArea, boardNetArea * (1 + boardWaste / 100));
    const boardReusableArea = Math.max(0, boardAvailableArea - boardChargeableArea);
    const boardWasteArea = Math.max(0, boardChargeableArea - boardNetArea);
    const boardEquivalentSheets = boardChargeableArea / Math.max(boardSheetArea, .000001);
    const boardCost = boardEquivalentSheets * unitCost(primary);
    const board = { ...boardLayout, cost: boardCost, purchasedArea: boardChargeableArea, wasteArea: boardWasteArea };
    const automaticSticker = roll(secondary, w, h, q * sides, stickerWaste, 0, 0, undefined, true);
    const informedStickerLength = n(input.adhesiveLengthM);
    const sticker = informedStickerLength > 0 ? {
      ...automaticSticker,
      cost: informedStickerLength * unitCost(secondary),
      length: informedStickerLength,
      purchasedArea: informedStickerLength * n(secondary.usable_width_mm || secondary.width_mm) / 1000,
      wasteArea: 0,
      strips: 1,
    } : automaticSticker;
    effectiveArea = area * sides; varnishArea = effectiveArea;
    purchasedArea = board.purchasedArea + sticker.purchasedArea;
    wasteArea = board.wasteArea + sticker.wasteArea;
    rotated = board.rotated;
    materialCost = board.cost + sticker.cost;
    calculatedWasteCost = (board.purchasedArea ? board.cost * board.wasteArea / board.purchasedArea : 0) + (sticker.purchasedArea ? sticker.cost * sticker.wasteArea / sticker.purchasedArea : 0);
    lines.push({ key: "plate-board", label: primary.name, detail: board.panelized ? `${board.sheets} chapa(s) a separar · ${board.panelsPerItem} módulo(s) por placa/fachada · ${board.panelDescription} · ${board.verticalSeams + board.horizontalSeams} emenda(s) · custo apropriado em ${round(boardEquivalentSheets, 4)} chapa · ${round(boardReusableArea, 4)} m² de retalho reutilizável` : `${board.sheets} chapa(s) a separar · ${board.capacity} placa(s) por chapa · custo apropriado em ${round(boardEquivalentSheets, 4)} chapa · ${round(boardReusableArea, 4)} m² de retalho reutilizável · ${board.rotated ? "girada 90°" : "normal"}`, amount: board.cost });
    lines.push({ key: "plate-sticker", label: secondary.name, detail: `${round(sticker.length, 3)} m lineares${informedStickerLength > 0 ? " · consumo informado" : sticker.strips > 1 ? ` · dividido em ${sticker.strips} faixa(s) por peça` : ""} · ${sides} face(s) adesivada(s) · ${input.printed ? "impressão digital" : input.vinylCutIncluded ? "vinil de cor com recorte eletrônico" : "vinil de cor sem recorte"}`, amount: sticker.cost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: boardEquivalentSheets, unit: "un equivalente", source: "base-da-placa" });
    stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: sticker.length, unit: "m", source: "adesivo" });
    const additionalVinylSummary: string[] = [];
    for (const [index, usage] of (input.additionalVinyls ?? []).entries()) {
      if (!usage.materialId || n(usage.lengthM) <= 0) continue;
      const vinyl = materials.find((item) => item.id === usage.materialId);
      if (!vinyl || !isLinearMaterial(vinyl) || vinyl.category !== "vinil") throw new Error(`Selecione um vinil válido para a cor adicional ${index + 1}.`);
      const length = n(usage.lengthM);
      const amount = length * unitCost(vinyl);
      const usedArea = length * n(vinyl.usable_width_mm || vinyl.width_mm) / 1000;
      lines.push({ key: `plate-extra-vinyl-${index}`, label: vinyl.name, detail: `${round(length, 3)} m lineares · cor adicional informada`, amount });
      stock.push({ materialId: vinyl.id, materialName: vinyl.name, quantity: length, unit: "m", source: `adesivo-cor-${index + 2}` });
      materialCost += amount;
      purchasedArea += usedArea;
      additionalVinylSummary.push(`${round(length, 2)} m de ${vinyl.name}`);
    }
    let laminateLength = 0;
    if (tertiary) {
      if (!isLinearMaterial(tertiary)) throw new Error("A máscara ou laminação precisa estar cadastrada como Rolo ou Metro linear.");
      const laminate = roll(tertiary, w, h, q * sides, n(tertiary.default_waste_percent) + extraWaste, 0, 0, undefined, true);
      laminateLength = laminate.length; materialCost += laminate.cost; purchasedArea += laminate.purchasedArea; wasteArea += laminate.wasteArea;
      calculatedWasteCost += laminate.purchasedArea ? laminate.cost * laminate.wasteArea / laminate.purchasedArea : 0;
      const isTransferMask = !input.printed && input.transferMaskIncluded;
      lines.push({ key: isTransferMask ? "plate-transfer-mask" : "plate-laminate", label: tertiary.name, detail: `${round(laminate.length, 3)} m lineares${laminate.strips > 1 ? ` · ${laminate.strips} faixa(s) por peça` : ""} ${isTransferMask ? "para transferência e aplicação do recorte" : "para proteção"}`, amount: laminate.cost });
      stock.push({ materialId: tertiary.id, materialName: tertiary.name, quantity: laminate.length, unit: "m", source: isTransferMask ? "mascara-transferencia" : "laminacao" });
    }
    if (n(input.applicationCostPerM2)) lines.push({ key: "plate-application", label: "Aplicação do adesivo", detail: `${round(effectiveArea, 3)} m² × R$ ${round(n(input.applicationCostPerM2), 2)}/m²`, amount: effectiveArea * n(input.applicationCostPerM2) });
    if (!input.printed && input.vinylCutIncluded && n(input.weedingCost)) lines.push({ key: "plate-weeding", label: "Depilação e preparação do recorte", detail: "Retirada do excesso, montagem e aplicação da máscara de transferência", amount: n(input.weedingCost) });
    if (n(input.finishingCost)) lines.push({ key: "plate-finishing", label: "Acabamento da placa", detail: "Recorte, refile, furos, fita ou acabamento informado", amount: n(input.finishingCost) });
    materialUsage = `${board.sheets} chapa(s) de ${primary.name} a separar${board.panelized ? ` em ${board.panelsPerItem} módulos por fachada` : ` (${round(boardEquivalentSheets, 4)} apropriada)`} + ${round(sticker.length, 2)} m de ${secondary.name}${additionalVinylSummary.length ? ` + ${additionalVinylSummary.join(" + ")}` : ""}${tertiary ? ` + ${round(laminateLength, 2)} m de ${!input.printed && input.transferMaskIncluded ? "máscara" : "laminação"}` : ""}`;
    Object.assign(metrics, { boards: board.sheets, equivalentBoardsCharged: round(boardEquivalentSheets, 4), reusableBoardAreaM2: round(boardReusableArea, 4), piecesPerSheet: board.capacity, panelsPerItem: board.panelsPerItem, panelPlan: board.panelDescription, verticalSeams: board.verticalSeams, horizontalSeams: board.horizontalSeams, adhesiveLinearM: round(sticker.length, 3), additionalVinylColors: additionalVinylSummary.length, adhesiveSides: sides, laminateLinearM: round(laminateLength, 3), printed: Boolean(input.printed), vinylCut: Boolean(!input.printed && input.vinylCutIncluded), transferMask: Boolean(!input.printed && input.transferMaskIncluded) });
  } else if (input.kind === "placa_acm_letra_caixa") {
    if (primary.format !== "chapa" || !/acm/i.test(primary.name)) throw new Error("Selecione a chapa de ACM usada como base.");
    if (!secondary) throw new Error("Selecione o material das letras.");
    const method = input.letterProduction || "pvc";
    const letters = Math.max(1, Math.round(n(input.letterCount || 1)));
    const letterWidth = n(input.letterWidthMm);
    const letterHeight = n(input.letterHeightMm);
    if (!letterWidth || !letterHeight) throw new Error("Informe a largura e a altura média das letras.");
    const waste = n(input.wastePercent || primary.default_waste_percent);

    const baseLayout = sheetOrPanels(primary, w, h, q, 0);
    const baseSheetArea = n(primary.width_mm) * n(primary.height_mm) / 1e6;
    const baseNetArea = w * h * q / 1e6;
    const baseAvailableArea = baseLayout.sheets * baseSheetArea;
    const baseChargeableArea = Math.min(baseAvailableArea, baseNetArea * (1 + waste / 100));
    const baseReusableArea = Math.max(0, baseAvailableArea - baseChargeableArea);
    const baseWasteArea = Math.max(0, baseChargeableArea - baseNetArea);
    const baseEquivalentSheets = baseChargeableArea / Math.max(baseSheetArea, .000001);
    const baseCost = baseEquivalentSheets * unitCost(primary);
    lines.push({ key: "acm-base", label: primary.name, detail: `${baseLayout.sheets} chapa(s) a separar${baseLayout.panelized ? ` · ${baseLayout.panelsPerItem} módulo(s) por fachada · ${baseLayout.panelDescription} · ${baseLayout.verticalSeams + baseLayout.horizontalSeams} emenda(s)` : ""} · custo apropriado em ${round(baseEquivalentSheets, 4)} chapa · ${round(baseReusableArea, 4)} m² de retalho reutilizável`, amount: baseCost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: baseEquivalentSheets, unit: "un equivalente", source: "base-acm" });
    purchasedArea = baseChargeableArea;
    wasteArea = baseWasteArea;
    materialCost = baseCost;
    calculatedWasteCost = baseChargeableArea ? baseCost * baseWasteArea / baseChargeableArea : 0;
    rotated = baseLayout.rotated;

    const totalLetters = letters * q;
    const letterArea = letterWidth * letterHeight * totalLetters / 1e6;
    secondaryMachineArea = letterArea;
    if (method === "pvc") {
      if (secondary.format !== "chapa" || !/pvc/i.test(secondary.name)) throw new Error("Selecione uma chapa de PVC para fabricar as letras.");
      const letterLayout = sheet(secondary, letterWidth, letterHeight, totalLetters, 0);
      const letterSheetArea = n(secondary.width_mm) * n(secondary.height_mm) / 1e6;
      const letterAvailableArea = letterLayout.sheets * letterSheetArea;
      const letterChargeableArea = Math.min(letterAvailableArea, letterArea * (1 + waste / 100));
      const letterReusableArea = Math.max(0, letterAvailableArea - letterChargeableArea);
      const letterWasteArea = Math.max(0, letterChargeableArea - letterArea);
      const letterEquivalentSheets = letterChargeableArea / Math.max(letterSheetArea, .000001);
      const letterCost = letterEquivalentSheets * unitCost(secondary);
      lines.push({ key: "pvc-letters", label: secondary.name, detail: `${totalLetters} letra(s) · ${letterLayout.capacity} por chapa · custo apropriado em ${round(letterEquivalentSheets, 4)} chapa · ${round(letterReusableArea, 4)} m² de retalho`, amount: letterCost });
      stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: letterEquivalentSheets, unit: "un equivalente", source: "letras-pvc" });
      purchasedArea += letterChargeableArea;
      wasteArea += letterWasteArea;
      materialCost += letterCost;
      calculatedWasteCost += letterChargeableArea ? letterCost * letterWasteArea / letterChargeableArea : 0;
      materialUsage = `${baseLayout.sheets} chapa(s) de ACM a separar + ${totalLetters} letra(s) em ${secondary.name}`;
      Object.assign(metrics, { letterProduction: "PVC recortado", letters: totalLetters, lettersPerSheet: letterLayout.capacity, letterEquivalentSheetsCharged: round(letterEquivalentSheets, 4), reusableLetterSheetAreaM2: round(letterReusableArea, 4) });
    } else {
      if (secondary.category !== "filamento") throw new Error("Selecione um filamento cadastrado para as letras 3D.");
      const grams = n(input.filamentWeightGrams) * q;
      if (!grams) throw new Error("Informe o peso total de filamento indicado pelo fatiador.");
      const filamentKg = grams / 1000;
      const filamentCost = filamentKg * unitCost(secondary);
      lines.push({ key: "3d-letters", label: secondary.name, detail: `${totalLetters} letra(s) · ${round(grams, 1)} g de filamento`, amount: filamentCost });
      stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: filamentKg, unit: "kg", source: "letras-3d" });
      materialCost += filamentCost;
      materialUsage = `${baseLayout.sheets} chapa(s) de ACM a separar + ${totalLetters} letra(s) em impressão 3D (${round(grams, 1)} g)`;
      Object.assign(metrics, { letterProduction: "Impressão 3D", letters: totalLetters, filamentWeightGrams: round(grams, 1), letterDepthMm: n(input.depthMm) });
    }

    let modules = 0, supplies = 0;
    if (input.illuminated) {
      modules = Math.ceil(letterArea * Math.max(n(input.ledModulesPerM2), 1));
      supplies = Math.ceil(modules * n(input.ledModuleWatts) / Math.max(n(input.powerSupplyWatts), 1));
      if (tertiary) {
        const ledCost = modules * unitCost(tertiary);
        lines.push({ key: "acm-letter-led", label: tertiary.name, detail: `${modules} módulo(s) LED`, amount: ledCost });
        stock.push({ materialId: tertiary.id, materialName: tertiary.name, quantity: modules, unit: "un", source: "iluminacao-letras" });
        materialCost += ledCost;
      }
      if (supplies && n(input.powerSupplyUnitCost)) lines.push({ key: "acm-letter-supplies", label: "Fontes e elétrica", detail: `${supplies} fonte(s)`, amount: supplies * n(input.powerSupplyUnitCost) });
      materialUsage += ` + ${modules} módulo(s) LED`;
    }
    if (n(input.finishingCost)) lines.push({ key: "acm-letter-assembly", label: "Montagem das letras no ACM", detail: "Colagem, espaçadores, gabarito, elétrica e acabamento", amount: n(input.finishingCost) });
    Object.assign(metrics, { baseBoards: baseLayout.sheets, baseEquivalentSheetsCharged: round(baseEquivalentSheets, 4), reusableBaseAreaM2: round(baseReusableArea, 4), basePanelsPerItem: baseLayout.panelsPerItem, basePanelPlan: baseLayout.panelDescription, baseVerticalSeams: baseLayout.verticalSeams, baseHorizontalSeams: baseLayout.horizontalSeams, letterWidthMm: letterWidth, letterHeightMm: letterHeight, illuminated: Boolean(input.illuminated), ledModules: modules, powerSupplies: supplies });
  } else if (input.kind === "placa_aplique") {
    if (primary.format !== "chapa") throw new Error("A base da placa precisa estar cadastrada como chapa.");
    const appliques = (input.appliques ?? []).filter((item) => item.materialId && n(item.widthMm) && n(item.heightMm) && n(item.quantity));
    if (!appliques.length) throw new Error("Adicione ao menos um aplique com material, medidas e quantidade.");
    const waste = n(input.wastePercent || primary.default_waste_percent);
    const allocateSheet = (material: Material, widthMm: number, heightMm: number, quantity: number) => {
      if (material.format !== "chapa") throw new Error(`O material “${material.name}” precisa estar cadastrado como chapa.`);
      const nesting = sheet(material, widthMm, heightMm, quantity, 0);
      const sheetArea = n(material.width_mm) * n(material.height_mm) / 1e6;
      const netArea = widthMm * heightMm * quantity / 1e6;
      // A chapa física precisa comportar as peças, mas os retalhos continuam no
      // estoque. Portanto, apropria-se somente a área líquida + perda técnica,
      // em vez de dividir a chapa inteira pela capacidade de peças iguais.
      const physicalArea = nesting.sheets * sheetArea;
      const allocatedArea = Math.min(physicalArea, netArea * (1 + waste / 100));
      const equivalentSheets = allocatedArea / Math.max(sheetArea, .000001);
      return { ...nesting, equivalentSheets, netArea, allocatedArea, allocatedCost: equivalentSheets * unitCost(material), allocatedWasteArea: Math.max(0, allocatedArea - netArea) };
    };
    const base = allocateSheet(primary, w, h, q);
    effectiveArea = area;
    purchasedArea = base.allocatedArea;
    wasteArea = base.allocatedWasteArea;
    rotated = base.rotated;
    materialCost = base.allocatedCost;
    calculatedWasteCost = base.allocatedArea ? base.allocatedCost * base.allocatedWasteArea / base.allocatedArea : 0;
    lines.push({ key: "applique-base", label: primary.name, detail: `${base.sheets} chapa(s) a separar · ${base.capacity} placa(s) por chapa · custo rateado em ${round(base.equivalentSheets, 4)} chapa`, amount: base.allocatedCost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: base.equivalentSheets, unit: "un equivalente", source: "placa-base" });

    let appliquePieces = 0;
    let appliqueAreaM2 = 0;
    const appliqueSummary: string[] = [];
    appliques.forEach((applique, index) => {
      const appliqueMaterial = materials.find((item) => item.id === applique.materialId);
      if (!appliqueMaterial) throw new Error(`Selecione o material do aplique ${index + 1}.`);
      const totalPieces = Math.max(1, n(applique.quantity)) * q;
      const allocation = allocateSheet(appliqueMaterial, n(applique.widthMm), n(applique.heightMm), totalPieces);
      appliquePieces += totalPieces;
      appliqueAreaM2 += allocation.netArea;
      materialCost += allocation.allocatedCost;
      purchasedArea += allocation.allocatedArea;
      wasteArea += allocation.allocatedWasteArea;
      calculatedWasteCost += allocation.allocatedArea ? allocation.allocatedCost * allocation.allocatedWasteArea / allocation.allocatedArea : 0;
      const name = applique.label?.trim() || `Aplique ${index + 1}`;
      lines.push({ key: `applique-${index}`, label: `${name} · ${appliqueMaterial.name}`, detail: `${totalPieces} peça(s) de ${round(applique.widthMm, 1)} × ${round(applique.heightMm, 1)} mm · ${allocation.capacity} por chapa · custo rateado em ${round(allocation.equivalentSheets, 4)} chapa`, amount: allocation.allocatedCost });
      stock.push({ materialId: appliqueMaterial.id, materialName: appliqueMaterial.name, quantity: allocation.equivalentSheets, unit: "un equivalente", source: `aplique-${index + 1}` });
      appliqueSummary.push(`${totalPieces}× ${name} em ${appliqueMaterial.name}`);
    });
    let modules = 0, linearLedM = 0, supplies = 0, estimatedWatts = 0;
    if (input.illuminated) {
      const illuminatedPlateAreaM2 = area;
      const linearLighting = input.plateLightingType === "linear";
      if (linearLighting) {
        linearLedM = n(input.neonLengthM);
        const ledRate = n(input.neonCostPerMeter) || (tertiary ? unitCost(tertiary) : 0);
        if (!linearLedM) throw new Error("Informe quantos metros de fita ou mangueira LED serão usados atrás da placa.");
        if (!ledRate) throw new Error("Informe o custo por metro da fita ou mangueira LED.");
        const ledCost = linearLedM * ledRate;
        estimatedWatts = linearLedM * n(input.neonWattsPerMeter);
        lines.push({ key: "applique-linear-led", label: tertiary?.name || "Fita / mangueira LED", detail: `${round(linearLedM, 3)} m atrás da placa principal · R$ ${round(ledRate, 2)}/m`, amount: ledCost });
        if (tertiary && isLinearMaterial(tertiary)) stock.push({ materialId: tertiary.id, materialName: tertiary.name, quantity: linearLedM, unit: "m", source: "retroiluminacao-linear-placa" });
        materialCost += ledCost;
      } else {
        modules = Math.max(1, Math.ceil(illuminatedPlateAreaM2 * Math.max(n(input.ledModulesPerM2), 1)));
        estimatedWatts = modules * n(input.ledModuleWatts);
        if (tertiary) {
          const ledCost = modules * unitCost(tertiary);
          lines.push({ key: "applique-led", label: tertiary.name, detail: `${modules} módulo(s) atrás da placa principal · ${round(illuminatedPlateAreaM2, 4)} m² retroiluminados`, amount: ledCost });
          stock.push({ materialId: tertiary.id, materialName: tertiary.name, quantity: modules, unit: "un", source: "retroiluminacao-placa" });
          materialCost += ledCost;
        } else metrics.ledPending = true;
      }
      supplies = Math.max(1, Math.ceil(estimatedWatts / Math.max(n(input.powerSupplyWatts), 1)));
      if (n(input.powerSupplyUnitCost)) lines.push({ key: "applique-supplies", label: "Fonte(s) de alimentação", detail: `${supplies} fonte(s) · ${round(estimatedWatts, 1)} W estimados`, amount: supplies * n(input.powerSupplyUnitCost) });
      if (n(input.wiringCost)) lines.push({ key: "applique-electrical", label: "Fiação, conectores e elétrica", detail: "Custo direto informado", amount: n(input.wiringCost) });
    }
    if (n(input.finishingCost)) lines.push({ key: "applique-assembly", label: "Montagem e aplicação", detail: "Colagem, fita, posicionamento e acabamento informados", amount: n(input.finishingCost) });
    materialUsage = `${q} placa(s) base em ${primary.name} + ${appliqueSummary.join(" + ")}${input.illuminated ? input.plateLightingType === "linear" ? ` + ${round(linearLedM, 2)} m de LED atrás da placa principal` : ` + ${modules} módulo(s) LED atrás da placa principal` : ""}`;
    Object.assign(metrics, { basePieces: q, basePiecesPerSheet: base.capacity, baseEquivalentSheets: round(base.equivalentSheets, 4), appliqueTypes: appliques.length, appliquePieces, appliqueAreaM2: round(appliqueAreaM2, 4), illuminatedPlateAreaM2: round(area, 4), illuminated: Boolean(input.illuminated), illuminationType: input.illuminated ? input.plateLightingType === "linear" ? "Fita / mangueira LED atrás da placa" : "Módulos LED atrás da placa" : "Sem iluminação", ledModules: modules, linearLedM: round(linearLedM, 3), estimatedWatts: round(estimatedWatts, 1), powerSupplies: supplies, allocationPolicy: "Custo proporcional à área utilizada; retalhos permanecem disponíveis" });
  } else if (input.kind === "envelopamento") {
    const complexity = Math.max(n(input.complexityFactor), 1), waste = n(input.wastePercent || 20);
    const vinyl = roll(primary, w, h, q, waste * complexity, 0, 0, n(input.primaryLinearMeterCost) || undefined);
    lines.push({ key: "vinyl", label: primary.name, detail: `${round(vinyl.length, 3)} m lineares · complexidade ${round(complexity, 2)}×`, amount: vinyl.cost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: vinyl.length, unit: "m", source: "revestimento" });
    materialCost = vinyl.cost; purchasedArea = vinyl.purchasedArea; wasteArea = vinyl.wasteArea; rotated = vinyl.rotated; varnishArea = vinyl.productionArea;
    calculatedWasteCost = vinyl.purchasedArea ? vinyl.cost * vinyl.wasteArea / vinyl.purchasedArea : 0;
    if (secondary) { const lam = roll(secondary, w, h, q, waste * complexity); lines.push({ key: "laminate", label: secondary.name, detail: `${round(lam.length, 3)} m lineares`, amount: lam.cost }); stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: lam.length, unit: "m", source: "laminacao" }); materialCost += lam.cost; }
    if (n(input.removalHours)) lines.push({ key: "removal", label: "Remoção de adesivo anterior", detail: `${round(n(input.removalHours), 1)} h`, amount: n(input.removalHours) * n(settings.labor_cost_hour) });
    if (n(input.designHours)) lines.push({ key: "design", label: "Criação / fechamento de arte", detail: `${round(n(input.designHours), 1)} h`, amount: n(input.designHours) * n(settings.labor_cost_hour) });
    materialUsage = `${round(vinyl.length, 2)} m de vinil${secondary ? " + laminação" : ""}`;
    Object.assign(metrics, { finalAreaM2: round(area, 3), chargedAreaM2: round(vinyl.purchasedArea, 3), vinylLinearM: round(vinyl.length, 3), complexity });
  } else if (input.kind === "impressao_rapida") {
    const waste = n(input.wastePercent || primary.default_waste_percent), paper = sheet(primary, w, h, q, waste);
    const setup = Math.ceil(n(input.setupSheets)), clicks = (paper.sheets + setup) * Math.max(1, n(input.printSides));
    const totalSheets = paper.sheets + setup, setupCost = setup * unitCost(primary);
    materialCost = paper.cost + setupCost; purchasedArea = paper.purchasedArea + setup * n(primary.width_mm) * n(primary.height_mm) / 1e6; wasteArea = paper.wasteArea + setup * n(primary.width_mm) * n(primary.height_mm) / 1e6; rotated = paper.rotated;
    calculatedWasteCost = purchasedArea ? materialCost * wasteArea / purchasedArea : 0;
    lines.push({ key: "paper", label: primary.name, detail: `${totalSheets} folha(s), incluindo ${setup} de acerto · ${paper.capacity} peça(s) por folha`, amount: materialCost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: totalSheets, unit: "un", source: "papel" });
    if (n(input.clickCost)) lines.push({ key: "click", label: "Impressão / clique", detail: `${clicks} clique(s)`, amount: clicks * n(input.clickCost) });
    if (n(input.finishingCost)) lines.push({ key: "finishing", label: "Acabamentos", detail: "Corte, vinco, dobra, laminação ou encadernação", amount: n(input.finishingCost) });
    materialUsage = `${totalSheets} folha(s) · ${clicks} clique(s)`;
    Object.assign(metrics, { piecesPerSheet: paper.capacity, productionSheets: paper.sheets, totalSheets, setupSheets: setup, clicks, printSides: input.printSides || 1 });
  } else if (input.kind === "neon_led") {
    if (primary.format !== "chapa") throw new Error("A base do neon precisa estar cadastrada como chapa de PVC ou acrílico.");
    const waste = n(input.wastePercent || primary.default_waste_percent);
    const base = sheet(primary, w, h, q, 0);
    const sheetArea = n(primary.width_mm) * n(primary.height_mm) / 1e6;
    const netBaseArea = w * h * q / 1e6;
    const baseChargeableArea = Math.min(base.purchasedArea, netBaseArea * (1 + waste / 100));
    const equivalentSheets = baseChargeableArea / Math.max(sheetArea, .000001);
    const baseCost = equivalentSheets * unitCost(primary);
    const neonLength = Math.max(n(input.neonLengthM), n(input.perimeterMm) / 1000) * q;
    if (!neonLength) throw new Error("Informe o comprimento total do neon em metros.");
    const neonRate = n(input.neonCostPerMeter) || (secondary ? unitCost(secondary) : 0);
    if (!neonRate) throw new Error("Informe o custo por metro da mangueira neon ou selecione um insumo cadastrado.");
    const neonCost = neonLength * neonRate;
    const watts = neonLength * n(input.neonWattsPerMeter);
    const supplies = Math.max(1, Math.ceil(watts / Math.max(n(input.powerSupplyWatts), 1)));
    materialCost = baseCost + neonCost; purchasedArea = baseChargeableArea; wasteArea = Math.max(0, baseChargeableArea - netBaseArea); effectiveArea = netBaseArea;
    calculatedWasteCost = baseChargeableArea ? baseCost * wasteArea / baseChargeableArea : 0;
    lines.push({ key: "neon-base", label: primary.name, detail: `${base.sheets} chapa(s) a separar · custo rateado em ${round(equivalentSheets, 4)} chapa`, amount: baseCost });
    lines.push({ key: "neon-flex", label: secondary?.name || "Mangueira neon LED 2ª geração", detail: `${round(neonLength, 2)} m × R$ ${round(neonRate, 2)}/m`, amount: neonCost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: equivalentSheets, unit: "un equivalente", source: "base-neon" });
    if (secondary && isLinearMaterial(secondary)) stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: neonLength, unit: "m", source: "neon-flex" });
    if (n(input.powerSupplyUnitCost)) lines.push({ key: "neon-source", label: "Fonte(s) de alimentação", detail: `${supplies} fonte(s) · ${round(watts, 1)} W estimados`, amount: supplies * n(input.powerSupplyUnitCost) });
    if (n(input.wiringCost)) lines.push({ key: "neon-electrical", label: "Fiação, conectores e elétrica", detail: "Custo direto informado", amount: n(input.wiringCost) });
    if (n(input.finishingCost)) lines.push({ key: "neon-assembly", label: "Montagem e acabamento", detail: "Canal, colagem, solda, passagem e teste", amount: n(input.finishingCost) });
    materialUsage = `${round(equivalentSheets, 4)} chapa equivalente de ${primary.name} + ${round(neonLength, 2)} m de neon + ${supplies} fonte(s)`;
    Object.assign(metrics, { neonGeneration: "2ª geração", neonLengthM: round(neonLength, 2), estimatedWatts: round(watts, 1), powerSupplies: supplies, equivalentSheetsCharged: round(equivalentSheets, 4), neonStockAutomatic: Boolean(secondary && isLinearMaterial(secondary)), fixing: input.fixingType || "não informado" });
  } else if (input.kind === "impressao_3d") {
    if (primary.category !== "filamento") throw new Error("Selecione um insumo cadastrado como Filamento 3D.");
    const baseWeight = n(input.filamentWeightGrams);
    if (!baseWeight) throw new Error("Informe o peso final indicado pelo fatiador.");
    const waste = n(input.supportWastePercent || input.wastePercent);
    const totalGrams = baseWeight * q * (1 + waste / 100);
    const filamentKg = totalGrams / 1000;
    const kgRate = n(input.filamentCostPerKg) || unitCost(primary);
    const filamentCost = filamentKg * kgRate;
    const printHours = n(input.printTimeHours) * q;
    if (!printHours && !n(input.machineMinutes)) throw new Error("Informe o tempo de impressão previsto pelo fatiador.");
    calculatedMachineMinutes = n(input.machineMinutes) || printHours * 60;
    materialCost = filamentCost; effectiveArea = 0; purchasedArea = filamentKg; wasteArea = Math.max(0, totalGrams - baseWeight * q) / 1000;
    calculatedWasteCost = kgRate * wasteArea;
    lines.push({ key: "3d-filament", label: primary.name, detail: `${round(totalGrams, 1)} g com ${round(waste, 1)}% de suporte/perda · R$ ${round(kgRate, 2)}/kg`, amount: filamentCost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: filamentKg, unit: "kg", source: "impressao-3d" });
    if (n(input.modelingHours)) lines.push({ key: "3d-modeling", label: "Modelagem / preparação", detail: `${round(n(input.modelingHours), 2)} h`, amount: n(input.modelingHours) * n(settings.labor_cost_hour) });
    if (n(input.finishingCost)) lines.push({ key: "3d-finishing", label: "Pós-processamento", detail: "Remoção de suporte, lixamento, primer, pintura ou montagem", amount: n(input.finishingCost) });
    materialUsage = `${round(totalGrams, 1)} g de ${primary.name} · ${round(calculatedMachineMinutes / 60, 2)} h de impressão`;
    Object.assign(metrics, { finalWeightPerUnitG: round(baseWeight, 1), totalFilamentG: round(totalGrams, 1), supportWastePercent: round(waste, 1), printHours: round(calculatedMachineMinutes / 60, 2), filamentCostPerKg: round(kgRate, 2) });
  } else if (input.kind === "caixa_expositor") {
    if (primary.format !== "chapa") throw new Error("O material da caixa precisa estar cadastrado como chapa.");
    const thickness = n(primary.thickness_mm);
    if (!thickness) throw new Error(`Informe a espessura da chapa “${primary.name}”.`);
    const informedDepth = n(input.depthMm);
    if (!informedDepth) throw new Error("Informe a profundidade da caixa ou expositor.");
    const internalDimensions = input.dimensionBasis === "interna";
    const outerW = internalDimensions ? w + 2 * thickness : w;
    const outerH = internalDimensions ? h + 2 * thickness : h;
    const outerD = internalDimensions ? informedDepth + 2 * thickness : informedDepth;
    const innerW = Math.max(outerW - 2 * thickness, 1);
    const innerH = Math.max(outerH - 2 * thickness, 1);
    const innerD = Math.max(outerD - 2 * thickness, 1);
    const betweenSides = input.jointType === "entre_laterais";
    const frontWidth = betweenSides ? innerW : outerW;
    const sideDepth = betweenSides ? outerD : innerD;
    const style = input.boxStyle || "aberta";
    const dividers = Math.max(0, Math.round(n(input.verticalDividers)));
    const shelves = Math.max(0, Math.round(n(input.shelves)));
    const pieces: VectorPiece[] = [
      { label: "Frente e fundo", widthMm: frontWidth, heightMm: outerH, quantity: 2 * q },
      { label: "Laterais", widthMm: sideDepth, heightMm: outerH, quantity: 2 * q },
      { label: "Base", widthMm: innerW, heightMm: innerD, quantity: q },
    ];
    if (style === "fechada" || style === "com_tampa") pieces.push({ label: style === "com_tampa" ? "Tampa" : "Topo", widthMm: style === "com_tampa" ? outerW : innerW, heightMm: style === "com_tampa" ? outerD : innerD, quantity: q });
    if (dividers) pieces.push({ label: "Divisórias verticais", widthMm: innerD, heightMm: innerH, quantity: dividers * q });
    if (shelves) pieces.push({ label: "Prateleiras", widthMm: innerW, heightMm: innerD, quantity: shelves * q });
    const spacing = Math.max(n(input.panelSpacingMm), 2);
    const nesting = nestRectangles(primary, pieces, spacing);
    const waste = n(input.wastePercent || primary.default_waste_percent);
    const sheetArea = n(primary.width_mm) * n(primary.height_mm) / 1e6;
    const chargeableArea = Math.min(nesting.availableArea, nesting.envelopeArea * (1 + waste / 100));
    const equivalentSheets = chargeableArea / Math.max(sheetArea, .000001);
    const boxMaterialCost = equivalentSheets * unitCost(primary);
    effectiveArea = nesting.netArea;
    purchasedArea = chargeableArea;
    wasteArea = Math.max(0, chargeableArea - nesting.netArea);
    materialCost = boxMaterialCost;
    calculatedWasteCost = purchasedArea ? boxMaterialCost * wasteArea / purchasedArea : 0;
    lines.push({ key: "box-panels", label: primary.name, detail: `${nesting.sheets} chapa(s) física(s) a separar · ${nesting.pieces} painel(is) encaixados · custo apropriado em ${round(equivalentSheets, 4)} chapa`, amount: boxMaterialCost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: equivalentSheets, unit: "un equivalente", source: "caixa-paineis" });
    if (n(input.hardwareCost)) lines.push({ key: "box-hardware", label: "Ferragens e acessórios", detail: style === "com_tampa" ? `Tampa ${input.lidType === "articulada" ? "articulada" : input.lidType === "correr" ? "de correr" : "solta"}` : "Custo direto informado", amount: n(input.hardwareCost) });
    if (n(input.finishingCost)) lines.push({ key: "box-assembly", label: "Cola, montagem e acabamento", detail: "Custo direto específico deste projeto", amount: n(input.finishingCost) });
    materialUsage = `${nesting.sheets} chapa(s) a separar · ${nesting.pieces} painel(is) · ${round(equivalentSheets, 4)} chapa equivalente cobrada`;
    Object.assign(metrics, {
      boxStyle: style === "aberta" ? "Caixa aberta" : style === "fechada" ? "Caixa fechada" : `Caixa com tampa ${input.lidType === "articulada" ? "articulada" : input.lidType === "correr" ? "de correr" : "solta"}`,
      dimensionBasis: internalDimensions ? "Medidas internas" : "Medidas externas",
      externalDimensionsMm: `${round(outerW, 1)} × ${round(outerH, 1)} × ${round(outerD, 1)}`,
      internalDimensionsMm: `${round(innerW, 1)} × ${round(innerH, 1)} × ${round(innerD, 1)}`,
      thicknessMm: thickness,
      panels: nesting.pieces,
      sheetsToPrepare: nesting.sheets,
      equivalentSheetsCharged: round(equivalentSheets, 4),
      reusableSheetAreaM2: round(Math.max(0, nesting.availableArea - chargeableArea), 4),
      verticalDividers: dividers,
      shelves,
      cutSpacingMm: spacing,
      assembly: betweenSides ? "Frente e fundo entre as laterais" : "Frente e fundo sobrepostos às laterais",
    });
  } else if (input.kind === "totem") {
    if (!secondary) throw new Error("Selecione o revestimento/face do totem.");
    const barLength = n(primary.length_m);
    if (!barLength) throw new Error("Cadastre o comprimento da barra do perfil estrutural.");
    const faces = Math.max(1, Math.min(2, Math.round(n(input.totemFaces || 2))));
    const widthM = w / 1000, heightM = h / 1000, depthM = n(input.depthMm) / 1000;
    const spacingM = Math.max(n(input.reinforcementSpacingMm), 300) / 1000;
    const crossbars = Math.max(1, Math.ceil(heightM / spacingM) - 1);
    const usedM = (2 * (widthM + heightM) + crossbars * widthM + (depthM ? 4 * depthM + crossbars * depthM : 0)) * q;
    const bars = Math.ceil(usedM / barLength), barCost = bars * unitCost(primary);
    lines.push({ key: "totem-frame", label: primary.name, detail: `${bars} barra(s) · ${round(usedM, 2)} m usados · ${round(bars * barLength - usedM, 2)} m de sobra`, amount: barCost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: bars, unit: "un", source: "estrutura-totem" });
    let faceCost = 0;
    if (secondary.format === "chapa") {
      const layout = sheet(secondary, w, h, q * faces, 0);
      const sheetArea = n(secondary.width_mm) * n(secondary.height_mm) / 1e6;
      const netFaceArea = w * h * q * faces / 1e6;
      const chargeableArea = Math.min(layout.purchasedArea, netFaceArea * (1 + n(input.wastePercent || secondary.default_waste_percent) / 100));
      const equivalentSheets = chargeableArea / Math.max(sheetArea, .000001);
      faceCost = equivalentSheets * unitCost(secondary); purchasedArea = chargeableArea; effectiveArea = netFaceArea; wasteArea = Math.max(0, chargeableArea - netFaceArea);
      lines.push({ key: "totem-faces", label: secondary.name, detail: `${faces} face(s) por totem · custo rateado em ${round(equivalentSheets, 4)} chapa`, amount: faceCost });
      stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: equivalentSheets, unit: "un equivalente", source: "faces-totem" });
    } else {
      const coating = roll(secondary, w, h, q * faces, n(input.wastePercent || secondary.default_waste_percent));
      faceCost = coating.cost; purchasedArea = coating.purchasedArea; effectiveArea = coating.productionArea; wasteArea = coating.wasteArea;
      lines.push({ key: "totem-faces", label: secondary.name, detail: `${round(coating.length, 2)} m lineares · ${faces} face(s)`, amount: coating.cost });
      stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: coating.length, unit: "m", source: "faces-totem" });
    }
    materialCost = barCost + faceCost; calculatedWasteCost = purchasedArea ? faceCost * wasteArea / purchasedArea : 0;
    const weldM = (8 + crossbars * 2 + (depthM ? 8 + crossbars * 2 : 0)) * .04 * q;
    if (n(input.weldingCostPerMeter)) lines.push({ key: "totem-welding", label: "Solda e consumíveis", detail: `${round(weldM, 2)} m estimados de cordão`, amount: weldM * n(input.weldingCostPerMeter) });
    if (input.paintIncluded && n(input.paintCost)) lines.push({ key: "totem-paint", label: "Fundo e pintura da estrutura", detail: "Custo direto informado", amount: n(input.paintCost) });
    if (n(input.basePlateCost)) lines.push({ key: "totem-base", label: "Base, sapatas e chumbadores", detail: "Custo direto informado", amount: n(input.basePlateCost) });
    if (n(input.foundationCost)) lines.push({ key: "totem-foundation", label: "Fundação / concretagem", detail: "Custo direto informado", amount: n(input.foundationCost) });
    if (n(input.accessDoorCost)) lines.push({ key: "totem-access", label: "Porta de inspeção e acabamento", detail: "Custo direto informado", amount: n(input.accessDoorCost) });
    if (n(input.electricalCost)) lines.push({ key: "totem-electrical", label: "Iluminação e elétrica", detail: "LED, fontes, cabos e montagem informados", amount: n(input.electricalCost) });
    if (n(input.finishingCost)) lines.push({ key: "totem-finishing", label: "Acabamento gráfico", detail: "Adesivo, impressão, recorte ou aplicação", amount: n(input.finishingCost) });
    materialUsage = `${bars} barra(s) de ${primary.name} + ${faces} face(s) em ${secondary.name}`;
    Object.assign(metrics, { bars, profileUsedM: round(usedM, 2), faces, depthMm: n(input.depthMm), crossbars, estimatedWeldM: round(weldM, 2), painted: Boolean(input.paintIncluded), fixing: input.fixingType || "não informado", foundationIncluded: n(input.foundationCost) > 0, electricalIncluded: n(input.electricalCost) > 0 });
  } else if (input.kind === "letra_caixa") {
    const letters = Math.max(1, n(input.letterCount || 1)), waste = n(input.wastePercent || primary.default_waste_percent);
    const vectorPieces = (input.vectorPieces ?? []).filter((piece) => n(piece.widthMm) && n(piece.heightMm));
    const pieceWidth = n(input.letterWidthMm) || w / letters;
    const pieceHeight = n(input.letterHeightMm) || h;
    const pieces = vectorPieces.length ? vectorPieces.map((piece) => ({ ...piece, quantity: Math.max(1, n(piece.quantity || 1)) * q })) : [{ label: "Letra média", widthMm: pieceWidth, heightMm: pieceHeight, quantity: letters * q }];
    const spacing = n(input.letterSpacingMm || 3);
    const uniformLayout = vectorPieces.length ? null : sheet(primary, pieceWidth + spacing, pieceHeight + spacing, letters * q, 0);
    const nesting = vectorPieces.length ? nestRectangles(primary, pieces, spacing) : {
      sheets: uniformLayout!.sheets,
      pieces: letters * q,
      netArea: pieceWidth * pieceHeight * letters * q / 1e6,
      envelopeArea: (pieceWidth + spacing) * (pieceHeight + spacing) * letters * q / 1e6,
      availableArea: uniformLayout!.purchasedArea,
    };
    const sheetArea = n(primary.width_mm) * n(primary.height_mm) / 1e6;
    const chargeableArea = Math.min(nesting.availableArea, nesting.envelopeArea * (1 + waste / 100));
    const equivalentSheets = chargeableArea / Math.max(sheetArea, .000001);
    const faceCost = equivalentSheets * unitCost(primary);
    effectiveArea = nesting.netArea;
    materialCost = faceCost; purchasedArea = chargeableArea; wasteArea = Math.max(0, chargeableArea - nesting.netArea);
    calculatedWasteCost = purchasedArea ? materialCost * wasteArea / purchasedArea : 0;
    lines.push({ key: "faces", label: primary.name, detail: `${nesting.sheets} chapa(s) física(s) a separar · ${nesting.pieces} letra(s) encaixadas individualmente com ${round(spacing, 1)} mm de espaçamento${uniformLayout ? ` · até ${uniformLayout.capacity} letra(s) por chapa` : ""} · custo apropriado em ${round(equivalentSheets, 4)} chapa`, amount: faceCost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: equivalentSheets, unit: "un equivalente", source: "faces" });
    const averagePerimeterMm = n(input.perimeterMm) || 2 * (pieceWidth + pieceHeight);
    const perimeterM = averagePerimeterMm / 1000 * letters * q;
    const solid = input.letterConstruction === "solida";
    if (!solid && secondary) { const returnArea = perimeterM * n(input.depthMm) / 1000; const qty = secondary.format === "rolo" ? returnArea / Math.max(n(secondary.usable_width_mm || secondary.width_mm) / 1000, .001) : secondary.format === "chapa" ? returnArea / Math.max(n(secondary.width_mm) * n(secondary.height_mm) / 1e6, .001) : returnArea; const amount = qty * unitCost(secondary); lines.push({ key: "returns", label: secondary.name, detail: `${round(perimeterM, 2)} m de perímetro · ${round(returnArea, 3)} m² de lateral`, amount }); stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: qty, unit: secondary.format === "rolo" ? "m" : secondary.format === "chapa" ? "un equivalente" : "m²", source: "laterais" }); materialCost += amount; }
    if (input.paintIncluded && n(input.paintCost)) lines.push({ key: "letter-paint", label: "Pintura das letras", detail: "Tinta e preparação informadas neste orçamento", amount: n(input.paintCost) });
    let modules = 0, supplies = 0;
    if (input.illuminated) { modules = Math.ceil(effectiveArea * Math.max(n(input.ledModulesPerM2), 1)); supplies = Math.ceil(modules * n(input.ledModuleWatts) / Math.max(n(input.powerSupplyWatts), 1)); if (tertiary) { const ledCost = modules * unitCost(tertiary); lines.push({ key: "led", label: tertiary.name, detail: `${modules} módulo(s) LED`, amount: ledCost }); stock.push({ materialId: tertiary.id, materialName: tertiary.name, quantity: modules, unit: "un", source: "iluminacao" }); materialCost += ledCost; } else metrics.ledPending = true; if (supplies && n(input.powerSupplyUnitCost)) lines.push({ key: "supplies", label: "Fontes e elétrica", detail: `${supplies} fonte(s)`, amount: supplies * n(input.powerSupplyUnitCost) }); }
    materialUsage = `${nesting.sheets} chapa(s) a separar · ${nesting.pieces} peça(s) encaixadas${solid ? " · letras maciças, sem lateral" : " · face e retorno"}${input.illuminated ? ` · ${modules} LEDs` : ""}`;
    Object.assign(metrics, { lettersPerSign: letters, totalLetters: letters * q, lettersPerSheet: uniformLayout?.capacity ?? "vetor variável", vectorPieces: vectorPieces.length, sheetsToPrepare: nesting.sheets, equivalentSheetsCharged: round(equivalentSheets, 4), reusableSheetAreaM2: round(Math.max(0, nesting.availableArea - chargeableArea), 4), faceAreaM2: round(effectiveArea, 3), perimeterM: round(perimeterM, 3), construction: solid ? "PVC/acrílico maciço, sem lateral" : "Face com retorno", ledModules: modules, powerSupplies: supplies, painted: Boolean(input.paintIncluded), fixing: input.fixingType || "não informado" });
  } else if (input.kind === "medalha") {
    if (primary.format !== "chapa") throw new Error("O material da medalha precisa estar cadastrado como chapa.");
    const shape = input.medalShape || "circular";
    const spacing = Math.max(n(input.medalSpacingMm), 1);
    const waste = n(input.wastePercent || primary.default_waste_percent);
    const nesting = sheet(primary, w + spacing, h + spacing, q, 0);
    const perimeterEach = shape === "circular" ? Math.PI * w : shape === "personalizada" && n(input.customPerimeterMm) ? n(input.customPerimeterMm) : 2 * (w + h);
    effectiveArea = (shape === "circular" ? Math.PI * Math.pow(w / 2, 2) : w * h) * q / 1e6;
    const sheetArea = n(primary.width_mm) * n(primary.height_mm) / 1e6;
    const equivalentSheets = q / Math.max(nesting.capacity, 1) * (1 + waste / 100);
    const allocatedMaterialCost = equivalentSheets * unitCost(primary);
    purchasedArea = sheetArea * equivalentSheets; wasteArea = Math.max(0, purchasedArea - effectiveArea); rotated = nesting.rotated; materialCost = allocatedMaterialCost;
    calculatedWasteCost = purchasedArea ? allocatedMaterialCost * wasteArea / purchasedArea : 0;
    lines.push({ key: "medal-material", label: primary.name, detail: `${nesting.sheets} chapa(s) a separar · ${nesting.capacity} medalha(s) por chapa · custo rateado em ${round(equivalentSheets, 4)} chapa · espessura ${round(n(primary.thickness_mm), 2)} mm`, amount: allocatedMaterialCost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: equivalentSheets, unit: "un equivalente", source: "medalhas" });

    const ribbonType = input.ribbonType || "sem_fita";
    const ribbonLength = ribbonType === "sem_fita" ? 0 : Math.max(n(input.ribbonLengthM), .1) * q;
    if (ribbonLength && secondary) {
      const ribbonCost = ribbonLength * unitCost(secondary);
      lines.push({ key: "ribbon", label: secondary.name, detail: `${round(ribbonLength, 2)} m de fita ${ribbonType === "personalizada" ? "personalizada" : "colorida"}`, amount: ribbonCost });
      stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: ribbonLength, unit: "m", source: "fitas" });
      materialCost += ribbonCost;
      if (ribbonType === "personalizada" && n(input.ribbonPrintCostPerMeter)) lines.push({ key: "ribbon-print", label: "Personalização da fita", detail: `${round(ribbonLength, 2)} m`, amount: ribbonLength * n(input.ribbonPrintCostPerMeter) });
    }

    const personalization = input.medalPersonalization || "sem_personalizacao";
    const hasSticker = personalization === "adesivo" || personalization === "gravacao_adesivo";
    const hasEngraving = personalization === "gravacao" || personalization === "gravacao_adesivo";
    let stickerLength = 0;
    if (hasSticker && tertiary) {
      const sticker = roll(tertiary, w, h, q, Math.max(waste, 10));
      stickerLength = sticker.length;
      lines.push({ key: "medal-sticker", label: tertiary.name, detail: `${round(sticker.length, 3)} m lineares para ${q} adesivo(s)`, amount: sticker.cost });
      stock.push({ materialId: tertiary.id, materialName: tertiary.name, quantity: sticker.length, unit: "m", source: "personalizacao" });
      materialCost += sticker.cost;
    }

    const cutMinutes = perimeterEach * q / Math.max(n(input.cutSpeedMmMin), 1);
    const engravingArea = hasEngraving ? effectiveArea * Math.max(n(input.engravingCoveragePercent), 1) / 100 : 0;
    const engravingMinutes = engravingArea / Math.max(n(input.engravingSpeedM2Hour), .001) * 60;
    if (!calculatedMachineMinutes) calculatedMachineMinutes = cutMinutes + engravingMinutes;
    if (n(input.assemblyCostPerUnit)) lines.push({ key: "medal-assembly", label: "Montagem e acabamento", detail: `${q} unidade(s)`, amount: q * n(input.assemblyCostPerUnit) });
    materialUsage = `${q} medalha(s) · aproveitamento de ${nesting.capacity} por chapa${ribbonLength ? ` · ${round(ribbonLength, 2)} m de fita` : ""}${stickerLength ? ` · ${round(stickerLength, 2)} m de adesivo` : ""}`;
    Object.assign(metrics, { shape, quantity: q, thicknessMm: n(primary.thickness_mm), piecesPerSheet: nesting.capacity, sheetsToPrepare: nesting.sheets, equivalentSheetsCharged: round(equivalentSheets, 4), perimeterEachMm: round(perimeterEach, 2), totalCutM: round(perimeterEach * q / 1000, 3), cutMinutes: round(cutMinutes, 2), engravingAreaM2: round(engravingArea, 4), engravingMinutes: round(engravingMinutes, 2), ribbonLengthM: round(ribbonLength, 2), holeDiameterMm: n(input.holeDiameterMm) });
  } else if (input.kind === "luminoso_backlight") {
    if (!secondary) throw new Error("Selecione o material da face luminosa (lona backlight, acrílico leitoso ou ACM).");
    const barLength = n(primary.length_m);
    if (!barLength) throw new Error("Cadastre o comprimento da barra do perfil estrutural.");
    const faces = Math.max(1, Math.min(2, Math.round(n(input.totemFaces || 1))));
    const luminosoType = input.luminosoType || "lona_backlight";
    const widthM = w / 1000, heightM = h / 1000, depthM = Math.max(n(input.depthMm), 80) / 1000;
    const spacingM = Math.max(n(input.reinforcementSpacingMm), 300) / 1000;
    const crossbars = Math.max(0, Math.ceil(widthM / spacingM) - 1);
    const usedM = (2 * (widthM + heightM) * 2 + crossbars * heightM * 2 + 4 * depthM + crossbars * 2 * depthM) * q;
    const bars = Math.ceil(usedM / barLength), barCost = bars * unitCost(primary);
    lines.push({ key: "luminoso-frame", label: primary.name, detail: `${bars} barra(s) · ${round(usedM, 2)} m usados · caixa ${round(depthM * 1000, 0)} mm`, amount: barCost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: bars, unit: "un", source: "estrutura-luminoso" });

    let faceCost = 0;
    const waste = n(input.wastePercent || secondary.default_waste_percent);
    if (secondary.format === "chapa") {
      const layout = sheetOrPanels(secondary, w, h, q * faces, 0);
      const sheetArea = n(secondary.width_mm) * n(secondary.height_mm) / 1e6;
      const netFaceArea = w * h * q * faces / 1e6;
      const chargeableArea = Math.min(layout.purchasedArea, netFaceArea * (1 + waste / 100));
      const equivalentSheets = chargeableArea / Math.max(sheetArea, .000001);
      faceCost = equivalentSheets * unitCost(secondary);
      purchasedArea = chargeableArea; effectiveArea = netFaceArea; wasteArea = Math.max(0, chargeableArea - netFaceArea); rotated = layout.rotated;
      lines.push({ key: "luminoso-face", label: secondary.name, detail: `${faces} face(s) · ${layout.sheets} chapa(s) física(s) · custo rateado em ${round(equivalentSheets, 4)} chapa`, amount: faceCost });
      stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: equivalentSheets, unit: "un equivalente", source: "face-luminoso" });
    } else {
      const allow = n(input.allowanceMm || 50) * 2;
      const coating = roll(secondary, w, h, q * faces, waste, allow, allow, undefined, true);
      faceCost = coating.cost; purchasedArea = coating.purchasedArea; effectiveArea = coating.productionArea; wasteArea = coating.wasteArea; rotated = coating.rotated;
      lines.push({ key: "luminoso-face", label: secondary.name, detail: `${round(coating.length, 2)} m lineares · ${faces} face(s)`, amount: coating.cost });
      stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: coating.length, unit: "m", source: "face-luminoso" });
    }

    const modulesPerM2 = Math.max(n(input.ledModulesPerM2 || 60), 1);
    const modules = Math.ceil(effectiveArea * modulesPerM2);
    const totalWatts = modules * n(input.ledModuleWatts || 0.72);
    const supplies = totalWatts > 0 ? Math.ceil(totalWatts / Math.max(n(input.powerSupplyWatts || 100), 1)) : 0;
    let ledCost = 0;
    if (tertiary) {
      ledCost = modules * unitCost(tertiary);
      lines.push({ key: "luminoso-led", label: tertiary.name, detail: `${modules} módulo(s) LED (${round(modulesPerM2, 0)}/m²) · ${round(totalWatts, 1)} W`, amount: ledCost });
      stock.push({ materialId: tertiary.id, materialName: tertiary.name, quantity: modules, unit: "un", source: "iluminacao" });
    } else {
      metrics.ledPending = true;
    }
    if (supplies && n(input.powerSupplyUnitCost)) {
      lines.push({ key: "luminoso-supplies", label: "Fontes 12V dimensionadas", detail: `${supplies} fonte(s) de ${n(input.powerSupplyWatts || 100)} W para ${round(totalWatts, 1)} W`, amount: supplies * n(input.powerSupplyUnitCost) });
    }
    if (n(input.wiringCost)) lines.push({ key: "luminoso-wiring", label: "Fiação, conectores e elétrica", detail: "Montagem elétrica interna", amount: n(input.wiringCost) });
    if (n(input.backPanelCost)) lines.push({ key: "luminoso-back", label: "Fundo e fechamento lateral", detail: luminosoType === "acm_vazado" ? "Acrílico difusor + fechamento da caixa" : "Chapa galvanizada / perfil lateral", amount: n(input.backPanelCost) });
    const weldM = (16 + crossbars * 6) * .04 * q;
    if (n(input.weldingCostPerMeter)) lines.push({ key: "luminoso-weld", label: "Solda e consumíveis", detail: `${round(weldM, 2)} m estimados de cordão`, amount: weldM * n(input.weldingCostPerMeter) });
    if (input.paintIncluded && n(input.paintCost)) lines.push({ key: "luminoso-paint", label: "Pintura / acabamento da caixa", detail: "Primer e pintura informados", amount: n(input.paintCost) });
    if (n(input.finishingCost)) lines.push({ key: "luminoso-finishing", label: "Acabamento gráfico / vedação", detail: "Adesivo translúcido, borracha ou vedação", amount: n(input.finishingCost) });
    materialCost = barCost + faceCost + ledCost;
    calculatedWasteCost = purchasedArea ? faceCost * wasteArea / purchasedArea : 0;
    varnishArea = secondary.category === "lona" ? effectiveArea : 0;
    materialUsage = `${bars} barra(s) + ${faces} face(s) em ${secondary.name} + ${modules} LEDs (${supplies} fonte(s))`;
    Object.assign(metrics, { luminosoType, faces, depthMm: round(depthM * 1000, 0), bars, ledModules: modules, totalWatts: round(totalWatts, 1), powerSupplies: supplies, painted: Boolean(input.paintIncluded), fixing: input.fixingType || "não informado" });
  } else if (input.kind === "trofeu") {
    if (primary.format !== "chapa") throw new Error("O material do corpo do troféu precisa estar cadastrado como chapa.");
    const spacing = Math.max(n(input.medalSpacingMm), 2);
    const waste = n(input.wastePercent || primary.default_waste_percent);
    const nesting = sheet(primary, w + spacing, h + spacing, q, 0);
    const sheetArea = n(primary.width_mm) * n(primary.height_mm) / 1e6;
    const equivalentSheets = q / Math.max(nesting.capacity, 1) * (1 + waste / 100);
    const bodyCost = equivalentSheets * unitCost(primary);
    purchasedArea = sheetArea * equivalentSheets; effectiveArea = area; wasteArea = Math.max(0, purchasedArea - effectiveArea); rotated = nesting.rotated;
    materialCost = bodyCost;
    calculatedWasteCost = purchasedArea ? bodyCost * wasteArea / purchasedArea : 0;
    lines.push({ key: "trophy-body", label: primary.name, detail: `${nesting.sheets} chapa(s) a separar · ${nesting.capacity} corpo(s) por chapa · custo rateado em ${round(equivalentSheets, 4)} chapa`, amount: bodyCost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: equivalentSheets, unit: "un equivalente", source: "trofeu-corpo" });

    const baseW = n(input.baseWidthMm) || Math.max(80, Math.round(w * 0.85));
    const baseD = n(input.baseDepthMm) || 60;
    const baseLayers = Math.max(1, Math.min(3, Math.round(n(input.trophyBaseLayers || 1))));
    let baseCutPerimeter = 0;
    if (secondary && secondary.format === "chapa") {
      const baseNesting = sheet(secondary, baseW + spacing, baseD + spacing, q * baseLayers, 0);
      const baseSheetsEq = (q * baseLayers) / Math.max(baseNesting.capacity, 1) * (1 + waste / 100);
      const baseCost = baseSheetsEq * unitCost(secondary);
      lines.push({ key: "trophy-base", label: `Base · ${secondary.name}`, detail: `${baseLayers} camada(s) (${baseW} × ${baseD} mm) · ${round(baseSheetsEq, 4)} chapa equivalente`, amount: baseCost });
      stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: baseSheetsEq, unit: "un equivalente", source: "trofeu-base" });
      materialCost += baseCost;
      baseCutPerimeter = 2 * (baseW + baseD) * baseLayers;
    }
    if (n(input.basePlateCost)) {
      lines.push({ key: "trophy-base-ready", label: "Base pronta / acabamento especial", detail: `${q} unidade(s) × R$ ${round(n(input.basePlateCost), 2)}`, amount: q * n(input.basePlateCost) });
    }

    const personalization = input.trophyPersonalization || "gravacao";
    const hasEngraving = personalization === "gravacao" || personalization === "gravacao_aplique";
    const hasApplique = personalization === "aplique" || personalization === "gravacao_aplique";
    let extraCutPerimeter = 0;
    if (hasApplique && tertiary && tertiary.format === "chapa") {
      const appNesting = sheet(tertiary, w + spacing, h + spacing, q, 0);
      const appSheetsEq = q / Math.max(appNesting.capacity, 1) * (1 + waste / 100);
      const appCost = appSheetsEq * unitCost(tertiary);
      lines.push({ key: "trophy-applique", label: `Aplique · ${tertiary.name}`, detail: `${round(appSheetsEq, 4)} chapa equivalente`, amount: appCost });
      stock.push({ materialId: tertiary.id, materialName: tertiary.name, quantity: appSheetsEq, unit: "un equivalente", source: "trofeu-aplique" });
      materialCost += appCost;
      extraCutPerimeter = 2 * (w + h);
    } else if (personalization === "uv_adesivo" && tertiary && isLinearMaterial(tertiary)) {
      const sticker = roll(tertiary, w, h, q, Math.max(waste, 10));
      lines.push({ key: "trophy-uv-sticker", label: tertiary.name, detail: `${round(sticker.length, 3)} m lineares para ${q} troféu(s)`, amount: sticker.cost });
      stock.push({ materialId: tertiary.id, materialName: tertiary.name, quantity: sticker.length, unit: "m", source: "personalizacao" });
      materialCost += sticker.cost;
    }

    const totalPerimeterEach = 2 * (w + h) + baseCutPerimeter + extraCutPerimeter;
    const cutMinutes = totalPerimeterEach * q / Math.max(n(input.cutSpeedMmMin || 500), 1);
    const engravingArea = hasEngraving ? area * Math.max(n(input.engravingCoveragePercent || 30), 1) / 100 : 0;
    const engravingMinutes = engravingArea / Math.max(n(input.engravingSpeedM2Hour || 0.25), .001) * 60;
    if (!calculatedMachineMinutes) calculatedMachineMinutes = cutMinutes + engravingMinutes;
    if (n(input.assemblyCostPerUnit)) lines.push({ key: "trophy-assembly", label: "Cola, montagem e embalagem", detail: `${q} unidade(s) × R$ ${round(n(input.assemblyCostPerUnit), 2)}`, amount: q * n(input.assemblyCostPerUnit) });
    if (n(input.finishingCost)) lines.push({ key: "trophy-finishing", label: "Personalização UV / acabamento extra", detail: "Custo direto informado", amount: n(input.finishingCost) });
    varnishArea = 0;
    materialUsage = `${q} troféu(s) em ${primary.name} (${nesting.capacity}/chapa)${secondary ? ` + base ${baseLayers}× ${secondary.name}` : ""}`;
    Object.assign(metrics, { quantity: q, piecesPerSheet: nesting.capacity, baseSizeMm: `${baseW} × ${baseD}`, baseLayers, personalization, cutMinutes: round(cutMinutes, 2), engravingMinutes: round(engravingMinutes, 2) });
  } else if (input.kind === "cavalete") {
    if (primary.format !== "chapa") throw new Error("As chapas do cavalete precisam estar cadastradas como chapa.");
    if (!secondary) throw new Error("Selecione o adesivo para as duas faces do cavalete.");
    const facesQty = q * 2;
    const waste = n(input.wastePercent || primary.default_waste_percent);
    const boardNesting = sheet(primary, w, h, facesQty, 0);
    const sheetArea = n(primary.width_mm) * n(primary.height_mm) / 1e6;
    const netFacesArea = w * h * facesQty / 1e6;
    const chargeableBoardArea = Math.min(boardNesting.purchasedArea, netFacesArea * (1 + waste / 100));
    const equivalentSheets = chargeableBoardArea / Math.max(sheetArea, .000001);
    const boardCost = equivalentSheets * unitCost(primary);
    lines.push({ key: "cavalete-boards", label: primary.name, detail: `${facesQty} face(s) (${q} cavalete(s) dupla face) · ${boardNesting.sheets} chapa(s) a separar · rateado em ${round(equivalentSheets, 4)} chapa`, amount: boardCost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: equivalentSheets, unit: "un equivalente", source: "cavalete-chapas" });

    const vinyl = roll(secondary, w, h, facesQty, Math.max(waste, n(secondary.default_waste_percent)), 0, 0, undefined, true);
    lines.push({ key: "cavalete-vinyl", label: secondary.name, detail: `${round(vinyl.length, 2)} m lineares para ${facesQty} face(s)`, amount: vinyl.cost });
    stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: vinyl.length, unit: "m", source: "adesivo" });

    let extraMatCost = 0;
    if (tertiary && isLinearMaterial(tertiary)) {
      const lam = roll(tertiary, w, h, facesQty, Math.max(waste, n(tertiary.default_waste_percent)), 0, 0, undefined, true);
      lines.push({ key: "cavalete-lamination", label: tertiary.name, detail: `${round(lam.length, 2)} m lineares de laminação`, amount: lam.cost });
      stock.push({ materialId: tertiary.id, materialName: tertiary.name, quantity: lam.length, unit: "m", source: "laminacao" });
      extraMatCost += lam.cost;
    }

    const mode = input.cavaleteStructureMode || "fabricar";
    if (mode === "fabricar") {
      const structMat = materials.find((item) => item.id === input.structureMaterialId);
      if (structMat) {
        const barLen = n(structMat.length_m);
        if (!barLen) throw new Error(`Informe o comprimento da barra de “${structMat.name}”.`);
        const usedM = (2 * (w / 1000 + h / 1000) * 2 + 4 * 0.25) * q;
        const bars = Math.ceil(usedM / barLen);
        const structCost = bars * unitCost(structMat);
        lines.push({ key: "cavalete-structure", label: structMat.name, detail: `${bars} barra(s) · ${round(usedM, 2)} m para 2 quadros + pés`, amount: structCost });
        stock.push({ materialId: structMat.id, materialName: structMat.name, quantity: bars, unit: "un", source: "estrutura-cavalete" });
        extraMatCost += structCost;
      }
      const weldM = 12 * 0.04 * q;
      if (n(input.weldingCostPerMeter)) lines.push({ key: "cavalete-weld", label: "Solda e consumíveis", detail: `${round(weldM, 2)} m estimados`, amount: weldM * n(input.weldingCostPerMeter) });
      if (input.paintIncluded && n(input.paintCost)) lines.push({ key: "cavalete-paint", label: "Pintura da estrutura", detail: "Primer e acabamento", amount: n(input.paintCost) });
    } else if (n(input.basePlateCost)) {
      lines.push({ key: "cavalete-ready", label: "Estrutura de cavalete pronto", detail: `${q} unidade(s) × R$ ${round(n(input.basePlateCost), 2)}`, amount: q * n(input.basePlateCost) });
    }

    if (n(input.hardwareCost)) lines.push({ key: "cavalete-hardware", label: "Dobradiças, corrente e pés", detail: "Ferragens do cavalete", amount: n(input.hardwareCost) });
    if (n(input.applicationCostPerM2)) lines.push({ key: "cavalete-app", label: "Aplicação do adesivo (2 faces)", detail: `${round(netFacesArea, 3)} m² × R$ ${round(n(input.applicationCostPerM2), 2)}/m²`, amount: netFacesArea * n(input.applicationCostPerM2) });
    if (n(input.finishingCost)) lines.push({ key: "cavalete-finishing", label: "Corte e acabamento", detail: "Custo direto informado", amount: n(input.finishingCost) });

    effectiveArea = netFacesArea; purchasedArea = chargeableBoardArea + vinyl.purchasedArea; wasteArea = Math.max(0, purchasedArea - netFacesArea * 2); rotated = vinyl.rotated;
    materialCost = boardCost + vinyl.cost + extraMatCost;
    calculatedWasteCost = purchasedArea ? (boardCost + vinyl.cost) * wasteArea / purchasedArea : 0;
    varnishArea = input.printed && !tertiary ? netFacesArea : 0;
    materialUsage = `${q} cavalete(s) dupla face · ${round(equivalentSheets, 2)} chapa(s) + ${round(vinyl.length, 2)} m de adesivo`;
    Object.assign(metrics, { quantity: q, faces: facesQty, structureMode: mode === "fabricar" ? "Estrutura fabricada" : "Cavalete pronto", vinylLengthM: round(vinyl.length, 2) });
  } else if (input.kind === "wind_banner") {
    const sides = Math.max(1, Math.min(2, Math.round(n(input.windBannerSides || 2))));
    const baseType = input.windBannerBaseType || "agua";
    const waste = n(input.wastePercent || primary.default_waste_percent);
    const allow = n(input.allowanceMm || 30) * 2;
    effectiveArea = w * h * q * sides / 1e6;
    if (primary.id !== "outsourced-wind-banner") {
      if (isLinearMaterial(primary)) {
        const fabric = roll(primary, w, h, q * sides, waste, allow, allow, n(input.primaryLinearMeterCost) || undefined, true);
        materialCost += fabric.cost; purchasedArea = fabric.purchasedArea; wasteArea = fabric.wasteArea; rotated = fabric.rotated;
        calculatedWasteCost = purchasedArea ? fabric.cost * wasteArea / purchasedArea : 0;
        lines.push({ key: "wind-fabric", label: primary.name, detail: `${round(fabric.length, 2)} m lineares · ${sides === 2 ? "dupla face" : "face simples"} · ${q} bandeira(s)`, amount: fabric.cost });
        stock.push({ materialId: primary.id, materialName: primary.name, quantity: fabric.length, unit: "m", source: "tecido-wind-banner" });
      } else {
        const kitCost = q * unitCost(primary);
        materialCost += kitCost; purchasedArea = effectiveArea;
        lines.push({ key: "wind-kit", label: primary.name, detail: `${q} unidade(s) × R$ ${round(unitCost(primary), 2)}`, amount: kitCost });
        stock.push({ materialId: primary.id, materialName: primary.name, quantity: q, unit: "un", source: "tecido-wind-banner" });
      }
    }
    if (secondary) {
      const poleCost = q * unitCost(secondary);
      lines.push({ key: "wind-pole", label: `Haste · ${secondary.name}`, detail: `${q} haste(s)`, amount: poleCost });
      stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: q, unit: "un", source: "haste-wind-banner" });
      materialCost += poleCost;
    } else if (n(input.hardwareCost)) {
      lines.push({ key: "wind-pole-direct", label: "Haste / mastro (fibra ou alumínio)", detail: `${q} unidade(s) × R$ ${round(n(input.hardwareCost), 2)}`, amount: q * n(input.hardwareCost) });
    }
    if (baseType !== "sem_base") {
      const baseLabel = baseType === "agua" ? "Base de água/areia" : baseType === "ferro" ? "Base de ferro / cruz" : "Estaca para grama";
      if (tertiary) {
        const baseCost = q * unitCost(tertiary);
        lines.push({ key: "wind-base", label: `${baseLabel} · ${tertiary.name}`, detail: `${q} base(s)`, amount: baseCost });
        stock.push({ materialId: tertiary.id, materialName: tertiary.name, quantity: q, unit: "un", source: "base-wind-banner" });
        materialCost += baseCost;
      } else if (n(input.basePlateCost)) {
        lines.push({ key: "wind-base-direct", label: baseLabel, detail: `${q} unidade(s) × R$ ${round(n(input.basePlateCost), 2)}`, amount: q * n(input.basePlateCost) });
      }
    }
    if (n(input.finishingCost)) lines.push({ key: "wind-finishing", label: "Costura, sublimação e acabamento", detail: "Custo total informado para o lote", amount: n(input.finishingCost) });
    varnishArea = 0;
    materialUsage = `${q} wind banner(s) ${round(w / 1000, 2)} × ${round(h / 1000, 2)} m · ${sides === 2 ? "dupla face" : "face simples"} · ${baseType === "sem_base" ? "somente refil/haste" : `base ${baseType}`}`;
    Object.assign(metrics, { quantity: q, sides, baseType, totalFabricAreaM2: round(effectiveArea, 3) });
  } else if (input.kind === "vitrine_vidro") {
    const filmType = input.glassFilmType || "perfurado";
    const heightType = input.heightWorkType || "terreo";
    const waste = n(input.wastePercent || primary.default_waste_percent || 10);
    const vinyl = roll(primary, w, h, q, waste, 0, 0, n(input.primaryLinearMeterCost) || undefined, true);
    materialCost = vinyl.cost; purchasedArea = vinyl.purchasedArea; effectiveArea = vinyl.productionArea; wasteArea = vinyl.wasteArea; rotated = vinyl.rotated;
    calculatedWasteCost = purchasedArea ? vinyl.cost * wasteArea / purchasedArea : 0;
    lines.push({ key: "glass-vinyl", label: primary.name, detail: `${round(vinyl.length, 2)} m lineares · ${vinyl.strips > 1 ? `${vinyl.strips} faixas com emenda · ` : ""}largura útil ${vinyl.rollWidth} mm`, amount: vinyl.cost });
    stock.push({ materialId: primary.id, materialName: primary.name, quantity: vinyl.length, unit: "m", source: "vitrine-adesivo" });

    if (filmType === "impresso" && secondary && isLinearMaterial(secondary)) {
      const lam = roll(secondary, w, h, q, waste, 0, 0, undefined, true);
      lines.push({ key: "glass-lamination", label: secondary.name, detail: `${round(lam.length, 2)} m lineares de laminação`, amount: lam.cost });
      stock.push({ materialId: secondary.id, materialName: secondary.name, quantity: lam.length, unit: "m", source: "laminacao" });
      materialCost += lam.cost;
    }
    if (filmType === "recorte" && input.transferMaskIncluded && tertiary && isLinearMaterial(tertiary)) {
      const mask = roll(tertiary, w, h, q, waste, 0, 0, undefined, true);
      lines.push({ key: "glass-mask", label: tertiary.name, detail: `${round(mask.length, 2)} m lineares de máscara de transferência`, amount: mask.cost });
      stock.push({ materialId: tertiary.id, materialName: tertiary.name, quantity: mask.length, unit: "m", source: "mascara-transferencia" });
      materialCost += mask.cost;
    }
    if (n(input.removalHours)) lines.push({ key: "glass-removal", label: "Remoção de adesivo antigo e limpeza", detail: `${round(n(input.removalHours), 2)} h de equipe`, amount: n(input.removalHours) * (n(settings.labor_cost_hour) + n(settings.overhead_hour)) });
    if (n(input.designHours)) lines.push({ key: "glass-design", label: "Arte e fechamento de arquivo", detail: `${round(n(input.designHours), 2)} h`, amount: n(input.designHours) * (n(settings.labor_cost_hour) + n(settings.overhead_hour)) });
    if (filmType === "recorte" && n(input.weedingCost)) lines.push({ key: "glass-weeding", label: "Depilação e aplicação da máscara", detail: "Preparação do recorte", amount: n(input.weedingCost) });
    if (n(input.applicationCostPerM2)) lines.push({ key: "glass-application", label: `Aplicação em vidro (${heightType === "andaime" ? "andaime/altura" : heightType === "escada" ? "escada" : "térreo"})`, detail: `${round(effectiveArea, 3)} m² × R$ ${round(n(input.applicationCostPerM2), 2)}/m²`, amount: effectiveArea * n(input.applicationCostPerM2) });
    if (n(input.travelCost)) lines.push({ key: "glass-travel", label: "Deslocamento, estacionamento e limpeza", detail: "Visita técnica e insumos de aplicação", amount: n(input.travelCost) });
    if (n(input.finishingCost)) lines.push({ key: "glass-finishing", label: "Acabamento adicional", detail: "Refile, selador de borda ou outros", amount: n(input.finishingCost) });
    varnishArea = ["impresso", "perfurado"].includes(filmType) && !secondary ? effectiveArea : 0;
    materialUsage = `${round(vinyl.length, 2)} m de ${primary.name} · ${round(effectiveArea, 2)} m² de vidro (${filmType})`;
    Object.assign(metrics, { filmType, heightWorkType: heightType, vinylLengthM: round(vinyl.length, 2), strips: vinyl.strips, removalHours: n(input.removalHours), travelIncluded: n(input.travelCost) > 0 });
  }

  if (input.fixingMaterialId || input.fixingType || n(input.fixingCost)) {
    const basePerimeterM = 2 * (w + h) / 1000 * q;
    const fixingPerimeterM = input.kind === "estrutura_lona"
      ? basePerimeterM * (input.doubleFrame ? 2 : 1)
      : input.kind === "totem" || input.kind === "luminoso_backlight"
        ? basePerimeterM * Math.max(1, Math.min(2, Math.round(n(input.totemFaces || (input.kind === "totem" ? 2 : 1)))))
        : input.kind === "letra_caixa"
          ? n(metrics.perimeterM as number)
          : basePerimeterM;
    const perimeterFormula = input.kind === "estrutura_lona" && input.doubleFrame
      ? `2 quadros × [2 × (${round(w / 1000, 3)} + ${round(h / 1000, 3)})] × ${q} un`
      : input.kind === "totem"
        ? `${Math.max(1, Math.min(2, Math.round(n(input.totemFaces || 2))))} face(s) × [2 × (${round(w / 1000, 3)} + ${round(h / 1000, 3)})] × ${q} un`
        : `2 × (${round(w / 1000, 3)} + ${round(h / 1000, 3)}) × ${q} un`;
    fixingLine(input, materials, fixingPerimeterM, lines, stock, metrics, perimeterFormula);
  }

  if (input.varnishIncluded && varnishArea > 0) {
    const varnishRate = n(input.varnishRateM2 || 10);
    lines.push({ key: "protective-varnish", label: "Verniz protetor", detail: `${round(varnishArea, 4)} m² × R$ ${round(varnishRate, 2)}/m²`, amount: varnishArea * varnishRate });
  }
  machineLine(machine, settings, calculatedMachineMinutes, effectiveArea, lines, stock);
  if (["placa_adesivada", "placa_acm_letra_caixa", "adesivo_impresso_recorte"].includes(input.kind)) machineLine(secondaryMachine, settings, n(input.secondaryMachineMinutes), secondaryMachineArea, lines, stock, "secondary-machine");
  const matPerM2 = effectiveArea ? materialCost / effectiveArea : 0;
  const totalMachineMinutes = calculatedMachineMinutes + (["placa_adesivada", "placa_acm_letra_caixa", "adesivo_impresso_recorte"].includes(input.kind) ? n(input.secondaryMachineMinutes) : 0);
  return finish({ ...input, totalMachineMinutes }, settings, lines, { netAreaM2: round(effectiveArea, 4), productionAreaM2: round(effectiveArea, 4), finishingAreaM2: 0, purchasedAreaM2: round(purchasedArea, 4), wasteAreaM2: round(wasteArea, 4), wastePercent: purchasedArea ? round(wasteArea / purchasedArea * 100, 2) : 0, wasteCost: round(calculatedWasteCost, 2), finishingCost: n(input.finishingCost), materialCostPerLinearMeter: primary && isLinearMaterial(primary) ? round(unitCost(primary), 4) : 0, materialCostPerM2: round(matPerM2, 4), productionWidthMm: w, productionHeightMm: h, rotated, materialUsage }, stock, metrics);
}
