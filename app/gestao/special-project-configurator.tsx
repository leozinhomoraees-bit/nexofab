"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calculator, CheckCircle2, ExternalLink, FileUp, Layers3, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculateSpecialProject, type SpecialProjectInput, type SpecialProjectKind, type SpecialProjectResult, type VectorPiece } from "@/lib/special-project-engine";
import { estimateLabor } from "@/lib/labor-estimator";
import { materialDisplayName } from "@/lib/material-label";
import type { PricingCatalog } from "./pricing-panel";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const labels: Record<SpecialProjectKind, { title: string; description: string }> = {
  banner: { title: "Banner com acabamento", description: "Lona impressa, aproveitamento do rolo, duas madeirinhas, cordinha superior, quatro ponteiras e impressão." },
  faixa: { title: "Faixa com acabamento", description: "Lona impressa, aproveitamento do rolo, madeirinhas laterais, cordas laterais, quatro ponteiras e impressão." },
  lona_backdrop: { title: "Lona backdrop", description: "Painel fotográfico em lona impressa, com acabamento à escolha e sem madeirinha ou cordinha." },
  adesivo_impresso: { title: "Adesivo impresso", description: "Vinil para impressão, aproveitamento do rolo, tinta, máquina, laminação ou verniz e acabamento." },
  adesivo_impresso_recorte: { title: "Adesivo impresso com recorte", description: "Impressão digital, recorte eletrônico, depilação, máscara de transferência e proteção opcional." },
  adesivo_cor: { title: "Adesivo na cor", description: "Vinil pronto na cor, liso ou com recorte eletrônico, combinação de cores, depilação e máscara opcional." },
  gravacao_laser: { title: "Gravação a laser", description: "Copo térmico ou outro objeto, custo do insumo, área gravada, tempo por unidade, eixo rotativo, mão de obra e acabamento." },
  estrutura_lona: { title: "Estrutura metálica revestida", description: "Metalon, travessas, solda e revestimento em lona, ACM ou chapa galvanizada." },
  placa_adesivada: { title: "Placa adesivada", description: "Chapa rígida, adesivo impresso ou de cor, aproveitamento, impressão, aplicação e acabamento." },
  placa_aplique: { title: "Placa com aplique", description: "Placa principal com uma ou mais camadas em MDF, acrílico, espelhado ou outro material rígido." },
  placa_acm_letra_caixa: { title: "Placa de ACM com letras", description: "Base em ACM com letras recortadas em PVC ou produzidas em impressão 3D, iluminação, máquinas e montagem." },
  caixa_expositor: { title: "Caixas e expositores", description: "MDF, acrílico ou PVC com plano de corte, tampa, divisórias, prateleiras, máquina, ferragens e montagem." },
  envelopamento: { title: "Plotagem / envelopamento", description: "Vinil, laminação, complexidade, remoção, arte e aplicação." },
  impressao_rapida: { title: "Impressão rápida em papel", description: "Aproveitamento por folha, cliques, acerto e acabamentos." },
  letra_caixa: { title: "Letra-caixa", description: "Faces, laterais, profundidade, LED, fontes, máquina e montagem." },
  medalha: { title: "Medalhas personalizadas", description: "Aproveitamento da chapa, corte e gravação a laser, fita, adesivo e montagem." },
  neon_led: { title: "Neon LED 2ª geração", description: "Base em PVC ou acrílico, metragem da mangueira, potência, fontes, elétrica, corte e instalação." },
  impressao_3d: { title: "Impressão 3D", description: "Filamento por quilo, peso do fatiador, suportes, tempo de máquina, modelagem e pós-processamento." },
  totem: { title: "Totem personalizado", description: "Estrutura, faces simples ou duplas, pintura, fixação, base, fundação, elétrica e acabamento gráfico." },
};

type Common = { quantity: string; laborMinutes: string; machineMinutes: string; installationCost: string; desiredMarginPercent: string; invoiceIncluded: boolean; invoicePercent: string; commissionIncluded: boolean; commissionPercent: string };
type AppliqueDraft = { id: string; label: string; materialId: string; widthMm: string; heightMm: string; quantity: string };
type VinylDraft = { id: string; materialId: string; lengthM: string };
type InitialSpecialProject = { totalCost?: number; projectInput?: Partial<SpecialProjectInput>; projectMetrics?: Record<string, string | number | boolean>; specialProjectKind?: SpecialProjectKind; stockUsages?: Array<{ materialId: string; materialName: string; quantity: number; unit: string; source: string }>; [key: string]: unknown };

function vinylPurpose(item: PricingCatalog["materials"][number]) {
  if (item.vinyl_type) return item.vinyl_type;
  const name = item.name.toLocaleLowerCase("pt-BR");
  if (/m[aá]scara|transfer|application\s*tape/.test(name)) return "mascara";
  if (/lamina[cç][aã]o|laminado|transparente|clear/.test(name)) return "laminacao";
  if (/preto|vermelh|azul|amarel|verde|laranja|rosa|roxo|violeta|cinza|grafite|dourad|prat|cromad|cobre|marrom|bege/.test(name)) return "cor";
  return "imprimivel";
}

function settingsWithCostCenter(catalog: PricingCatalog, machineId: string) {
  if (!catalog.settings) return null;
  const settings = { ...catalog.settings };
  const centers = catalog.costCenters ?? [];
  const machine = catalog.machines.find((item) => item.id === machineId);
  const selectedCenter = centers.find((item) => item.id === machine?.cost_center_id) ?? centers.find((item) => item.is_default);
  if (centers.length && selectedCenter) {
    const totalHours = centers.reduce((sum, item) => sum + Number(item.productive_hours_month), 0);
    const generalMonthly = catalog.fixedCosts.filter((item) => !item.cost_center_id).reduce((sum, item) => sum + Number(item.monthly_amount), 0);
    const specificMonthly = catalog.fixedCosts.filter((item) => item.cost_center_id === selectedCenter.id).reduce((sum, item) => sum + Number(item.monthly_amount), 0);
    settings.overhead_hour = Number(settings.overhead_hour) + generalMonthly / Math.max(totalHours, 1) + specificMonthly / Math.max(Number(selectedCenter.productive_hours_month), 1);
  } else {
    settings.overhead_hour = Number(settings.overhead_hour) + Number(catalog.fixedCostsMonthly || 0) / Math.max(Number(settings.productive_hours_month || 160), 1);
  }
  return settings;
}

const emptySpecialForm = (kind: SpecialProjectKind): Record<string, string | boolean> => ({ widthMm: "", heightMm: "", depthMm: "", primaryMaterialId: "", secondaryMaterialId: "", tertiaryMaterialId: "", woodMaterialId: "", ropeMaterialId: "", endCapMaterialId: "", machineId: "", secondaryMachineId: "", machineMinutes: "0", secondaryMachineMinutes: "0", reinforcementSpacingMm: "1000", doubleFrame: false, allowanceMm: "50", weldingCostPerMeter: "0", paintIncluded: false, paintCost: "0", fixingType: kind === "lona_backdrop" ? "Ilhós em todo o perímetro" : "", fixingMaterialId: "", fixingSpacingMm: "300", fixingQuantity: "", fixingCost: "0", complexityFactor: "1.2", wastePercent: kind === "envelopamento" ? "25" : kind === "placa_aplique" ? "0" : "5", removalHours: "0", designHours: "0", printed: true, vinylCutIncluded: true, transferMaskIncluded: true, batchProduction: ["adesivo_impresso", "adesivo_impresso_recorte", "adesivo_cor", "placa_adesivada"].includes(kind), weedingCost: "0", adhesiveLengthM: "", linearMeterCost: "", printSides: "1", setupSheets: "5", clickCost: "0", finishingCost: "0", applicationCostPerM2: "0", adhesiveSides: "1", letterProduction: "pvc", letterConstruction: "face_retorno", letterCount: "1", letterWidthMm: "", letterHeightMm: "", letterSpacingMm: "3", filamentWeightGrams: "", filamentCostPerKg: "", printTimeHours: "", supportWastePercent: "10", modelingHours: "0", perimeterMm: "", illuminated: false, plateLightingType: "modules", ledModulesPerM2: "60", ledModuleWatts: "0.72", powerSupplyWatts: "100", powerSupplyUnitCost: "0", neonLengthM: "", neonCostPerMeter: "", neonWattsPerMeter: "8", wiringCost: "0", totemFaces: "2", foundationCost: "0", basePlateCost: "0", accessDoorCost: "0", electricalCost: "0", dimensionBasis: "externa", boxStyle: "aberta", lidType: "solta", jointType: "sobreposta", verticalDividers: "0", shelves: "0", panelSpacingMm: "4", hardwareCost: "0", extraCost: "0", varnishIncluded: false, varnishRateM2: "10", medalShape: "circular", medalSpacingMm: "3", customPerimeterMm: "", ribbonType: "sem_fita", ribbonLengthM: "0.8", ribbonPrintCostPerMeter: "0", medalPersonalization: "gravacao", engravingCoveragePercent: "35", cutSpeedMmMin: "600", engravingSpeedM2Hour: "0.25", assemblyCostPerUnit: "0", holeDiameterMm: "4" });

function restoredSpecialForm(kind: SpecialProjectKind, initial?: InitialSpecialProject | null, dimensions?: { widthMm: string; heightMm: string; depthMm: string }) {
  const restored = emptySpecialForm(kind);
  const input = initial?.projectInput;
  if (input) Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null || Array.isArray(value) || typeof value === "object" || key === "kind" || key === "quantity") return;
    restored[key] = typeof value === "boolean" ? value : String(value);
  });
  if (["adesivo_impresso", "adesivo_impresso_recorte", "adesivo_cor", "placa_adesivada"].includes(kind) && input?.batchProductionConfigured !== true) restored.batchProduction = true;
  if (!restored.widthMm && dimensions?.widthMm) restored.widthMm = dimensions.widthMm;
  if (!restored.heightMm && dimensions?.heightMm) restored.heightMm = dimensions.heightMm;
  if (!restored.depthMm && dimensions?.depthMm) restored.depthMm = dimensions.depthMm;
  const metrics = initial?.projectMetrics ?? {};
  if (!input?.letterCount && (metrics.lettersPerSign || metrics.letters)) restored.letterCount = String(metrics.lettersPerSign || metrics.letters);
  if (!input?.letterConstruction && typeof metrics.construction === "string") restored.letterConstruction = metrics.construction.includes("sem lateral") ? "solida" : "face_retorno";
  if (input?.paintIncluded === undefined && typeof metrics.painted === "boolean") restored.paintIncluded = metrics.painted;
  if (!input?.fixingType && typeof metrics.fixing === "string" && metrics.fixing !== "não informado") restored.fixingType = metrics.fixing;
  if (!input?.totemFaces && metrics.faces) restored.totemFaces = String(metrics.faces);
  const usages = initial?.stockUsages ?? [];
  const source = (...names: string[]) => usages.find((usage) => names.includes(usage.source))?.materialId ?? "";
  if (!restored.primaryMaterialId) restored.primaryMaterialId = source("lona-backdrop", "estrutura", "base-da-placa", "placa-base", "base-acm", "caixa-paineis", "revestimento", "papel", "faces", "medalhas", "base-neon", "impressao-3d", "estrutura-totem");
  if (!restored.secondaryMaterialId) restored.secondaryMaterialId = source("revestimento", "adesivo", "letras-pvc", "letras-3d", "laterais", "fitas", "neon-flex", "faces-totem");
  if (!restored.tertiaryMaterialId) restored.tertiaryMaterialId = source("laminacao", "mascara-transferencia", "iluminacao", "iluminacao-letras", "personalizacao");
  return restored;
}

export function SpecialProjectConfigurator({ kind, catalog, common, initial, initialDimensions, showInitialResult = true, onChanged, onCalculated, onLaborSuggested }: { kind: SpecialProjectKind; catalog: PricingCatalog; common: Common; initial?: InitialSpecialProject | null; initialDimensions?: { widthMm: string; heightMm: string; depthMm: string }; showInitialResult?: boolean; onChanged?: () => void; onCalculated: (result: SpecialProjectResult, summary: { description: string; material: string; widthMm: string; heightMm: string; depthMm: string; productionNotes: string }) => void; onLaborSuggested: (minutes: number) => void }) {
  const [liveCatalog, setLiveCatalog] = useState(catalog);
  const [catalogRefreshing, setCatalogRefreshing] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>(() => restoredSpecialForm(kind, initial, initialDimensions));
  const [appliques, setAppliques] = useState<AppliqueDraft[]>(() => initial?.projectInput?.appliques?.length ? initial.projectInput.appliques.map((item, index) => ({ id: item.id ?? `aplique-${index + 1}`, label: item.label ?? `Aplique ${index + 1}`, materialId: item.materialId, widthMm: String(item.widthMm), heightMm: String(item.heightMm), quantity: String(item.quantity) })) : [{ id: "aplique-principal", label: "Aplique principal", materialId: "", widthMm: "", heightMm: "", quantity: "1" }]);
  const [additionalVinyls, setAdditionalVinyls] = useState<VinylDraft[]>(() => initial?.projectInput?.additionalVinyls?.map((item, index) => ({ id: item.id ?? `vinyl-${index + 1}`, materialId: item.materialId, lengthM: String(item.lengthM) })) ?? []);
  const [result, setResult] = useState<SpecialProjectResult | null>(() => showInitialResult && initial?.totalCost !== undefined ? initial as unknown as SpecialProjectResult : null);
  const [message, setMessage] = useState("");
  const [vectorPieces, setVectorPieces] = useState<VectorPiece[]>(() => initial?.projectInput?.vectorPieces ?? []);
  const [vectorFileName, setVectorFileName] = useState("");
  const set = (key: string, value: string | boolean) => { setForm((current) => ({ ...current, [key]: value })); setResult(null); onChanged?.(); };
  const updateApplique = (id: string, changes: Partial<AppliqueDraft>) => { setAppliques((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item)); setResult(null); onChanged?.(); };
  const addApplique = () => { setAppliques((current) => [...current, { id: `aplique-${Date.now()}`, label: `Aplique ${current.length + 1}`, materialId: "", widthMm: "", heightMm: "", quantity: "1" }]); setResult(null); onChanged?.(); };
  const removeApplique = (id: string) => { setAppliques((current) => current.filter((item) => item.id !== id)); setResult(null); onChanged?.(); };
  const addVinyl = () => { setAdditionalVinyls((current) => [...current, { id: `vinyl-${Date.now()}`, materialId: "", lengthM: "" }]); setResult(null); onChanged?.(); };
  const updateVinyl = (id: string, changes: Partial<VinylDraft>) => { setAdditionalVinyls((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item)); setResult(null); onChanged?.(); };
  const removeVinyl = (id: string) => { setAdditionalVinyls((current) => current.filter((item) => item.id !== id)); setResult(null); onChanged?.(); };
  useEffect(() => setLiveCatalog(catalog), [catalog]);
  const materials = liveCatalog.materials;
  const machines = liveCatalog.machines;
  const material = (id: string) => materials.find((item) => item.id === id);
  const vinyls = useMemo(() => materials.filter((item) => ["rolo", "metro"].includes(item.format) && (item.category === "vinil" || /adesivo|vinil/i.test(item.name))), [materials]);
  const transferMasks = useMemo(() => materials.filter((item) => ["rolo", "metro"].includes(item.format) && vinylPurpose(item) === "mascara"), [materials]);
  const laminates = useMemo(() => materials.filter((item) => ["rolo", "metro"].includes(item.format) && vinylPurpose(item) === "laminacao"), [materials]);
  const printedVinyls = useMemo(() => vinyls.filter((item) => ["imprimivel", "ambos"].includes(vinylPurpose(item))), [vinyls]);
  const colorVinyls = useMemo(() => vinyls.filter((item) => ["imprimivel", "cor", "ambos"].includes(vinylPurpose(item))), [vinyls]);
  const canvases = useMemo(() => materials.filter((item) => ["rolo", "metro"].includes(item.format) && (item.category === "lona" || /lona/i.test(item.name))), [materials]);
  const bannerWoods = useMemo(() => materials.filter((item) => ["barra", "rolo", "metro", "unidade"].includes(item.format) && /madeira|madeirinha|sarrafo|bast[aã]o/i.test(item.name)), [materials]);
  const bannerRopes = useMemo(() => materials.filter((item) => ["rolo", "metro"].includes(item.format) && /corda|cordinha|cord[aã]o/i.test(item.name)), [materials]);
  const bannerEndCaps = useMemo(() => materials.filter((item) => item.format === "unidade" && /ponteira|terminal|acabamento.*madeira/i.test(item.name)), [materials]);
  const engravingObjects = useMemo(() => {
    const type = String(form.engravingItemType || "copo_termico");
    const patterns: Record<string, RegExp> = { copo_termico: /copo|tumbler|t[ée]rmic/i, caneca: /caneca/i, garrafa: /garrafa|squeeze/i, caneta: /caneta/i, chaveiro: /chaveiro/i };
    return materials.filter((item) => item.format === "unidade" && (patterns[type] ? patterns[type].test(item.name) : !["led", "fixacao", "eletrica"].includes(item.category)));
  }, [form.engravingItemType, materials]);
  const sheets = useMemo(() => materials.filter((item) => item.format === "chapa" && ["chapa", "acrilico", "metal", "estrutura"].includes(item.category)), [materials]);
  const structures = useMemo(() => materials.filter((item) => item.format === "barra" && ["estrutura", "metal"].includes(item.category)), [materials]);
  const coatings = useMemo(() => materials.filter((item) => ["rolo", "metro"].includes(item.format) && item.category === "lona" || item.format === "chapa" && ["chapa", "metal", "estrutura", "acrilico"].includes(item.category)), [materials]);
  const returnMaterials = useMemo(() => materials.filter((item) => ["chapa", "rolo", "metro"].includes(item.format) && ["chapa", "metal", "estrutura", "acrilico"].includes(item.category) && item.category !== "lona"), [materials]);
  const papers = useMemo(() => materials.filter((item) => item.category === "papel" && item.format === "chapa"), [materials]);
  const leds = useMemo(() => materials.filter((item) => item.category === "led" && item.format === "unidade"), [materials]);
  const medalMaterials = useMemo(() => materials.filter((item) => item.format === "chapa" && item.category !== "papel"), [materials]);
  const ribbons = useMemo(() => materials.filter((item) => ["rolo", "metro"].includes(item.format) && (item.category === "tecido" || /fita|cetim|gorgur/i.test(item.name))), [materials]);
  const medalStickers = useMemo(() => materials.filter((item) => ["rolo", "metro"].includes(item.format) && item.category === "vinil"), [materials]);
  const acmSheets = useMemo(() => materials.filter((item) => item.format === "chapa" && /acm/i.test(item.name)), [materials]);
  const pvcSheets = useMemo(() => materials.filter((item) => item.format === "chapa" && /pvc/i.test(item.name)), [materials]);
  const filaments = useMemo(() => materials.filter((item) => item.category === "filamento"), [materials]);
  const neonMaterials = useMemo(() => materials.filter((item) => item.category === "led" && (["rolo", "metro"].includes(item.format) || /neon|mangueira|flex/i.test(item.name))), [materials]);
  const fixingMaterials = useMemo(() => materials.filter((item) => item.category === "fixacao"), [materials]);
  const backdropEyelets = useMemo(() => materials.filter((item) => item.category === "fixacao" || item.category === "acabamento" && /ilh[oó]s/i.test(item.name)), [materials]);
  const laborEstimate = useMemo(() => estimateLabor({
    kind,
    widthMm: Number(form.widthMm), heightMm: Number(form.heightMm), depthMm: Number(form.depthMm), quantity: Number(common.quantity),
    letterCount: Number(form.letterCount), neonLengthM: Number(form.neonLengthM), printTimeHours: Number(form.printTimeHours), faces: Number(form.totemFaces),
    doubleFrame: Boolean(form.doubleFrame), painted: Boolean(form.paintIncluded), illuminated: Boolean(form.illuminated), installationIncluded: Number(common.installationCost) > 0, complexityFactor: Number(form.complexityFactor),
    cutIncluded: Boolean(form.vinylCutIncluded),
  }), [common.installationCost, common.quantity, form, kind]);
  const costPerMeter = (item: PricingCatalog["materials"][number]) => item.format === "rolo" && Number(item.length_m) > 0 ? Number(item.package_cost) / Number(item.length_m) : item.format === "metro" ? Number(item.package_cost) / Math.max(Number(item.purchase_quantity), .000001) : null;
  const fixingPreview = useMemo(() => {
    const item = materials.find((entry) => entry.id === String(form.fixingMaterialId));
    if (!item || !["rolo", "metro"].includes(item.format)) return null;
    const quantity = Math.max(1, Number(common.quantity) || 1);
    const widthM = Number(form.widthMm) / 1000, heightM = Number(form.heightMm) / 1000;
    if (!widthM || !heightM) return null;
    const multiplier = kind === "estrutura_lona" && Boolean(form.doubleFrame) ? 2 : kind === "totem" ? Math.max(1, Math.min(2, Number(form.totemFaces) || 2)) : 1;
    const meters = 2 * (widthM + heightM) * quantity * multiplier;
    const rate = item.format === "rolo" && Number(item.length_m) > 0 ? Number(item.package_cost) / Number(item.length_m) : Number(item.package_cost) / Math.max(Number(item.purchase_quantity), .000001);
    return { meters, total: meters * rate, formula: `${multiplier > 1 ? `${multiplier} × ` : ""}2 × (${widthM.toLocaleString("pt-BR")} + ${heightM.toLocaleString("pt-BR")}) × ${quantity}` };
  }, [common.quantity, form.doubleFrame, form.fixingMaterialId, form.heightMm, form.totemFaces, form.widthMm, kind, materials]);
  const select = (name: string, title: string, options: PricingCatalog["materials"], optional = false) => <label>{title}<select value={String(form[name] ?? "")} onChange={(event) => set(name, event.target.value)}><option value="">{optional ? "Não incluir" : "Selecione..."}</option>{options.map((item) => { const meterCost = costPerMeter(item); return <option key={item.id} value={item.id}>{item.name}{["rolo", "metro"].includes(item.format) && (item.usable_width_mm || item.width_mm) ? ` · ${Number(item.usable_width_mm || item.width_mm) / 1000} m` : item.format === "barra" && item.length_m ? ` · barra ${item.length_m} m` : item.format === "chapa" && item.thickness_mm ? ` · ${item.thickness_mm} mm` : ""}{meterCost !== null ? ` · ${currency.format(meterCost)}/m` : ""}</option>; })}</select></label>;
  const number = (name: string, title: string, step = "0.01", suffix = "") => <label>{title}<Input type="number" min="0" step={step} value={String(form[name] ?? "")} onChange={(event) => set(name, event.target.value)}/>{suffix && <small>{suffix}</small>}</label>;
  const help = (text: string) => <div className="special-material-help"><AlertTriangle/><span>{text} <a href="/gestao?secao=precificacao" target="_blank" rel="noreferrer">Abrir Precificação em nova aba <ExternalLink/></a></span></div>;

  async function refreshCatalog(silent = false) {
    setCatalogRefreshing(true); setMessage("");
    try {
      const response = await fetch("/api/gestao/precificacao", { cache: "no-store" });
      const updated = await response.json();
      if (!response.ok) throw new Error(updated.error ?? "Não foi possível atualizar os insumos.");
      setLiveCatalog(updated);
      if (!silent) setMessage(`Cadastro atualizado: ${updated.materials?.length ?? 0} insumo(s) disponível(is).`);
    } catch (error) { setMessage((error as Error).message); }
    finally { setCatalogRefreshing(false); }
  }

  useEffect(() => { void refreshCatalog(true); }, [kind]);

  async function analyzeVector(file?: File) {
    setMessage("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".svg")) { setMessage("Envie o vetor no formato SVG. Converta textos em curvas antes de exportar."); return; }
    if (file.size > 5 * 1024 * 1024) { setMessage("O SVG deve ter no máximo 5 MB."); return; }
    if (Number(form.widthMm) <= 0 || Number(form.heightMm) <= 0) { setMessage("Informe primeiro a largura e a altura finais do projeto para escalar o vetor."); return; }
    try {
      const documentSvg = new DOMParser().parseFromString(await file.text(), "image/svg+xml");
      if (documentSvg.querySelector("parsererror")) throw new Error("O arquivo SVG não pôde ser interpretado.");
      documentSvg.querySelectorAll("script,style,foreignObject,iframe,object,embed,link,image").forEach((node) => node.remove());
      documentSvg.querySelectorAll("*").forEach((node) => [...node.attributes].forEach((attribute) => {
        if (/^on/i.test(attribute.name) || /^(href|xlink:href)$/i.test(attribute.name) && /^(https?:|data:|javascript:)/i.test(attribute.value) || /url\(\s*(https?:|data:|javascript:)/i.test(attribute.value)) node.removeAttribute(attribute.name);
      }));
      const svg = documentSvg.documentElement as unknown as SVGSVGElement;
      const viewBox = svg.viewBox?.baseVal;
      const ratio = viewBox?.width && viewBox?.height ? viewBox.height / viewBox.width : 1;
      svg.setAttribute("width", "1000"); svg.setAttribute("height", String(Math.max(1, Math.min(1200, 1000 * ratio))));
      const holder = document.createElement("div");
      holder.style.cssText = "position:fixed;left:-12000px;top:0;opacity:0;pointer-events:none;z-index:-1";
      holder.appendChild(document.importNode(svg, true)); document.body.appendChild(holder);
      const renderedSvg = holder.querySelector("svg")!;
      const rootRect = renderedSvg.getBoundingClientRect();
      const raw = [...renderedSvg.querySelectorAll<SVGGraphicsElement>("path,rect,circle,ellipse,polygon,polyline,text")]
        .map((node) => node.getBoundingClientRect()).filter((rect) => rect.width > .1 && rect.height > .1)
        .map((rect) => ({ left: rect.left - rootRect.left, right: rect.right - rootRect.left, top: rect.top - rootRect.top, bottom: rect.bottom - rootRect.top }));
      holder.remove();
      if (!raw.length || !rootRect.width || !rootRect.height) throw new Error("Nenhuma forma mensurável foi encontrada. Converta textos e efeitos em curvas.");
      const groups: typeof raw = [];
      raw.sort((a, b) => a.left - b.left).forEach((box) => {
        const group = groups.find((item) => box.left <= item.right && box.right >= item.left);
        if (group) { group.left = Math.min(group.left, box.left); group.right = Math.max(group.right, box.right); group.top = Math.min(group.top, box.top); group.bottom = Math.max(group.bottom, box.bottom); }
        else groups.push({ ...box });
      });
      const scaleX = Number(form.widthMm) / rootRect.width, scaleY = Number(form.heightMm) / rootRect.height;
      const measured = groups.map((box, index) => ({ label: `Elemento ${index + 1}`, widthMm: (box.right - box.left) * scaleX, heightMm: (box.bottom - box.top) * scaleY, quantity: 1 }));
      setVectorPieces(measured); setVectorFileName(file.name); setForm((current) => ({ ...current, letterCount: String(measured.length), letterWidthMm: String(measured.reduce((sum, item) => sum + item.widthMm, 0) / measured.length), letterHeightMm: String(Math.max(...measured.map((item) => item.heightMm))) })); setResult(null); onChanged?.();
    } catch (error) { setMessage((error as Error).message); setVectorPieces([]); setVectorFileName(""); }
  }

  function validationIssues() {
    const issues: string[] = [];
    const primary = material(String(form.primaryMaterialId)), secondary = material(String(form.secondaryMaterialId)), tertiary = material(String(form.tertiaryMaterialId)), fixingMaterial = material(String(form.fixingMaterialId));
    const finishingMaterials = [material(String(form.woodMaterialId)), material(String(form.ropeMaterialId)), material(String(form.endCapMaterialId))].filter(Boolean);
    if (Number(form.widthMm) <= 0) issues.push("informe a largura final");
    if (Number(form.heightMm) <= 0) issues.push("informe a altura final");
    if (Number(common.quantity) <= 0) issues.push("informe uma quantidade válida");
    if (!primary && !(kind === "gravacao_laser" && Boolean(form.customerSuppliesMaterial))) issues.push(kind === "gravacao_laser" ? "selecione o objeto que será gravado ou marque material fornecido pelo cliente" : kind === "banner" || kind === "faixa" || kind === "lona_backdrop" ? "selecione a lona" : kind === "estrutura_lona" || kind === "totem" ? "selecione o metalon/perfil" : kind === "placa_acm_letra_caixa" ? "selecione a chapa de ACM da base" : kind === "caixa_expositor" ? "selecione a chapa da caixa ou expositor" : kind === "placa_adesivada" || kind === "placa_aplique" ? "selecione a chapa principal da placa" : kind === "impressao_rapida" ? "selecione o papel" : kind === "letra_caixa" ? "selecione o material das letras" : kind === "medalha" ? "selecione o material da medalha" : kind === "neon_led" ? "selecione a placa-base de PVC ou acrílico" : kind === "impressao_3d" ? "selecione o filamento" : "selecione o vinil/adesivo");
    if (primary && Number(primary.package_cost) <= 0 && !(kind === "gravacao_laser" && Boolean(form.customerSuppliesMaterial)) && !(kind === "envelopamento" && Number(form.linearMeterCost) > 0) && !(kind === "impressao_3d" && Number(form.filamentCostPerKg) > 0)) issues.push(`informe o custo de “${primary.name}” no cadastro do insumo`);
    if (kind === "envelopamento" && primary && (primary.format === "rolo" && !Number(primary.length_m) || !Number(primary.usable_width_mm || primary.width_mm))) issues.push(`complete a largura útil${primary.format === "rolo" ? " e o comprimento do rolo" : ""} de “${primary.name}”`);
    if (kind === "banner" || kind === "faixa") {
      if (primary && (!canvases.some((item) => item.id === primary.id))) issues.push("o material principal precisa ser uma lona em rolo ou metro linear");
      if (!String(form.woodMaterialId)) issues.push("selecione a madeirinha do acabamento");
      if (!String(form.ropeMaterialId)) issues.push("selecione a cordinha do acabamento");
      if (!String(form.endCapMaterialId)) issues.push("selecione a ponteira do acabamento");
      if (!String(form.machineId)) issues.push("selecione a impressora para calcular tinta, cabeça, energia e depreciação");
    }
    if (kind === "lona_backdrop") {
      if (primary && !canvases.some((item) => item.id === primary.id)) issues.push("o material principal precisa ser uma lona em rolo ou metro linear");
      if (!String(form.fixingType)) issues.push("escolha o acabamento do backdrop");
      if (!String(form.machineId)) issues.push("selecione a impressora para calcular tinta, cabeça, energia e depreciação");
    }
    if (kind === "adesivo_impresso" || kind === "adesivo_impresso_recorte") {
      if (primary && !printedVinyls.some((item) => item.id === primary.id)) issues.push("selecione um vinil compatível com impressão");
      if (!String(form.machineId)) issues.push("selecione a impressora para calcular tinta, cabeça, energia e depreciação");
      if (kind === "adesivo_impresso_recorte" && !String(form.secondaryMachineId)) issues.push("selecione a plotter para calcular o recorte eletrônico");
      if (kind === "adesivo_impresso_recorte" && Boolean(form.transferMaskIncluded) && !tertiary) issues.push("selecione a máscara de transferência");
    }
    if (kind === "adesivo_cor") {
      if (primary && !colorVinyls.some((item) => item.id === primary.id)) issues.push("selecione um vinil compatível com adesivo na cor");
      if (Boolean(form.vinylCutIncluded) && !String(form.machineId)) issues.push("selecione a plotter para calcular o recorte eletrônico");
      if (Boolean(form.vinylCutIncluded) && Boolean(form.transferMaskIncluded) && !tertiary) issues.push("selecione a máscara de transferência");
      additionalVinyls.forEach((entry, index) => {
        const vinyl = material(entry.materialId);
        if (!vinyl) issues.push(`selecione o adesivo da cor adicional ${index + 1}`);
        if (Number(entry.lengthM) <= 0) issues.push(`informe o consumo em metros da cor adicional ${index + 1}`);
      });
    }
    if (kind === "gravacao_laser") {
      if (primary && primary.format !== "unidade") issues.push("o objeto para gravação precisa estar cadastrado no formato Unidade");
      if (!String(form.machineId)) issues.push("selecione a máquina laser");
      if (String(form.machineId) && machines.find((item) => item.id === String(form.machineId))?.machine_type !== "laser") issues.push("a máquina selecionada precisa ser do tipo Laser");
      if (Number(form.machineMinutes) <= 0) issues.push("informe o tempo de gravação por unidade");
    }
    if (kind === "estrutura_lona") {
      if (!secondary) issues.push("selecione o revestimento: lona, ACM ou chapa galvanizada");
      if (primary && !Number(primary.length_m)) issues.push(`informe o comprimento da barra “${primary.name}”`);
    }
    if (kind === "placa_adesivada") {
      if (primary && primary.format !== "chapa") issues.push("a base da placa precisa estar cadastrada como chapa");
      if (!secondary) issues.push("selecione o adesivo que será aplicado na chapa");
      if (secondary && (!(["rolo", "metro"].includes(secondary.format)) || secondary.category !== "vinil")) issues.push("o adesivo precisa estar cadastrado como Vinil em formato Rolo ou Metro linear");
      if (secondary && !Number(secondary.usable_width_mm || secondary.width_mm)) issues.push(`informe a largura útil do adesivo “${secondary.name}”`);
      if (Boolean(form.printed) && !String(form.machineId)) issues.push("selecione a impressora para incluir tinta, cabeça, energia e depreciação");
      if (!Boolean(form.printed) && Boolean(form.vinylCutIncluded) && !String(form.machineId)) issues.push("selecione a plotter para calcular o recorte do adesivo de cor");
      if (!Boolean(form.printed) && Boolean(form.vinylCutIncluded) && Boolean(form.transferMaskIncluded) && !tertiary) issues.push("selecione a máscara de transferência usada no adesivo recortado");
      if (tertiary && !Number(tertiary.usable_width_mm || tertiary.width_mm)) issues.push(`informe a largura útil de “${tertiary.name}”`);
      if (!Boolean(form.printed)) additionalVinyls.forEach((entry, index) => {
        const vinyl = material(entry.materialId);
        if (!vinyl) issues.push(`selecione o adesivo da cor adicional ${index + 1}`);
        if (Number(entry.lengthM) <= 0) issues.push(`informe o consumo em metros da cor adicional ${index + 1}`);
        if (vinyl && Number(vinyl.package_cost) <= 0) issues.push(`informe o custo de “${vinyl.name}” no cadastro do insumo`);
      });
      if (String(form.secondaryMachineId) && Number(form.secondaryMachineMinutes) <= 0) issues.push("informe o tempo de corte/acabamento da chapa");
    }
    if (kind === "placa_aplique") {
      if (primary && primary.format !== "chapa") issues.push("a placa principal precisa estar cadastrada como chapa");
      if (!appliques.length) issues.push("adicione ao menos um aplique");
      appliques.forEach((applique, index) => {
        const appliqueMaterial = material(applique.materialId);
        if (!appliqueMaterial) issues.push(`selecione o material do aplique ${index + 1}`);
        if (appliqueMaterial && appliqueMaterial.format !== "chapa") issues.push(`o material do aplique ${index + 1} precisa estar cadastrado como chapa`);
        if (appliqueMaterial && Number(appliqueMaterial.package_cost) <= 0) issues.push(`informe o custo de “${appliqueMaterial.name}” no cadastro do insumo`);
        if (Number(applique.widthMm) <= 0 || Number(applique.heightMm) <= 0) issues.push(`informe largura e altura do aplique ${index + 1}`);
        if (Number(applique.quantity) <= 0) issues.push(`informe a quantidade do aplique ${index + 1}`);
      });
      if (String(form.machineId) && Number(form.machineMinutes) <= 0) issues.push("informe o tempo de corte da placa e dos apliques");
      if (Boolean(form.illuminated) && !tertiary) issues.push(String(form.plateLightingType) === "linear" ? "selecione a fita ou mangueira LED usada atrás da placa principal" : "selecione o módulo LED usado atrás da placa principal");
      if (Boolean(form.illuminated) && String(form.plateLightingType) === "linear" && Number(form.neonLengthM) <= 0) issues.push("informe quantos metros de fita ou mangueira LED serão usados atrás da placa");
      if (Boolean(form.illuminated) && String(form.plateLightingType) === "linear" && tertiary && !["rolo", "metro"].includes(tertiary.format) && Number(form.neonCostPerMeter) <= 0) issues.push(`“${tertiary.name}” não está cadastrado por metro; informe seu custo direto em R$/m`);
      if (Boolean(form.illuminated) && Number(form.powerSupplyUnitCost) <= 0) issues.push("informe o custo unitário da fonte do LED");
    }
    if (kind === "placa_acm_letra_caixa") {
      const production = String(form.letterProduction);
      if (primary && (primary.format !== "chapa" || !/acm/i.test(primary.name))) issues.push("a base precisa ser uma chapa de ACM cadastrada");
      if (!secondary) issues.push(production === "3d" ? "selecione o filamento das letras 3D" : "selecione a chapa de PVC das letras");
      if (production === "pvc" && secondary && (secondary.format !== "chapa" || !/pvc/i.test(secondary.name))) issues.push("o material das letras precisa ser uma chapa de PVC");
      if (production === "3d" && secondary && secondary.category !== "filamento") issues.push("o material das letras 3D precisa estar cadastrado como Filamento 3D");
      if (Number(form.letterCount) <= 0) issues.push("informe a quantidade de letras por placa");
      if (Number(form.letterWidthMm) <= 0 || Number(form.letterHeightMm) <= 0) issues.push("informe a largura e a altura média das letras");
      if (production === "3d" && Number(form.depthMm) <= 0) issues.push("informe a profundidade das letras 3D");
      if (production === "3d" && Number(form.filamentWeightGrams) <= 0) issues.push("informe o peso total de filamento indicado pelo fatiador");
      if (!String(form.secondaryMachineId)) issues.push(production === "3d" ? "selecione a impressora 3D" : "selecione a máquina de corte das letras");
      if (String(form.secondaryMachineId) && Number(form.secondaryMachineMinutes) <= 0) issues.push(production === "3d" ? "informe o tempo total de impressão 3D" : "informe o tempo de corte das letras");
      if (String(form.machineId) && Number(form.machineMinutes) <= 0) issues.push("informe o tempo de corte/acabamento da base de ACM");
      if (Boolean(form.illuminated) && !tertiary) issues.push("selecione o módulo LED");
      if (Boolean(form.illuminated) && Number(form.powerSupplyUnitCost) <= 0) issues.push("informe o custo unitário da fonte");
    }
    if (kind === "caixa_expositor") {
      if (primary && primary.format !== "chapa") issues.push("o material da caixa precisa estar cadastrado como chapa");
      if (primary && Number(primary.thickness_mm) <= 0) issues.push(`informe a espessura da chapa “${primary.name}”`);
      if (Number(form.depthMm) <= 0) issues.push("informe a profundidade da caixa ou expositor");
      if (Number(form.panelSpacingMm) < 0) issues.push("informe um espaçamento de corte válido");
      if (String(form.machineId) && Number(form.machineMinutes) <= 0) issues.push("informe o tempo total de corte das peças");
    }
    if (kind === "envelopamento" && Boolean(form.printed) && !String(form.machineId)) issues.push("selecione a impressora para incluir tinta, cabeça, energia e depreciação");
    if (kind === "impressao_rapida" && Number(form.clickCost) <= 0 && !String(form.machineId)) issues.push("informe o custo por clique ou selecione uma máquina");
    if (kind === "letra_caixa") {
      if (String(form.letterConstruction) !== "solida" && Number(form.depthMm) <= 0) issues.push("informe a profundidade da letra-caixa");
      if (String(form.letterConstruction) !== "solida" && !secondary) issues.push("selecione o material da lateral/retorno");
      if (!vectorPieces.length && (Number(form.letterWidthMm) <= 0 || Number(form.letterHeightMm) <= 0)) issues.push("informe a medida média de cada letra ou envie o arquivo SVG");
      if (Boolean(form.illuminated) && !tertiary) issues.push("selecione o módulo LED");
      if (Boolean(form.illuminated) && Number(form.powerSupplyUnitCost) <= 0) issues.push("informe o custo unitário da fonte");
    }
    if (kind === "neon_led") {
      if (primary && primary.format !== "chapa") issues.push("a base do neon precisa ser uma chapa de PVC ou acrílico");
      if (Number(form.neonLengthM) <= 0) issues.push("informe quantos metros de mangueira neon serão usados");
      if (!secondary && Number(form.neonCostPerMeter) <= 0) issues.push("selecione a mangueira neon ou informe o custo direto por metro");
      if (secondary && !["rolo", "metro"].includes(secondary.format) && Number(form.neonCostPerMeter) <= 0) issues.push(`“${secondary.name}” não está cadastrado por metro; informe o custo direto da mangueira em R$/m`);
      if (Number(form.powerSupplyUnitCost) <= 0) issues.push("informe o custo unitário da fonte");
    }
    if (kind === "impressao_3d") {
      if (primary && primary.category !== "filamento") issues.push("o material precisa estar cadastrado como Filamento 3D");
      if (Number(form.filamentWeightGrams) <= 0) issues.push("informe o peso final da peça indicado pelo fatiador");
      if (Number(form.printTimeHours) <= 0) issues.push("informe o tempo de impressão indicado pelo fatiador");
      if (!String(form.machineId)) issues.push("selecione a impressora 3D");
    }
    if (kind === "totem") {
      if (!secondary) issues.push("selecione o material das faces do totem");
      if (primary && !Number(primary.length_m)) issues.push(`informe o comprimento da barra “${primary.name}”`);
      if (Number(form.depthMm) <= 0) issues.push("informe a profundidade do totem");
    }
    if (kind === "medalha") {
      const personalization = String(form.medalPersonalization);
      const ribbonType = String(form.ribbonType);
      if (primary && primary.format !== "chapa") issues.push("cadastre o material da medalha no formato chapa");
      if (primary && Number(primary.thickness_mm) <= 0) issues.push(`informe a espessura da chapa “${primary.name}”`);
      if (String(form.medalShape) === "personalizada" && Number(form.customPerimeterMm) <= 0) issues.push("informe o perímetro da medalha personalizada");
      if (ribbonType !== "sem_fita" && !secondary) issues.push("selecione a fita da medalha");
      if (ribbonType !== "sem_fita" && Number(form.ribbonLengthM) <= 0) issues.push("informe o comprimento de fita por medalha");
      if (ribbonType === "personalizada" && Number(form.ribbonPrintCostPerMeter) <= 0) issues.push("informe o custo de personalização da fita por metro");
      if (["adesivo", "gravacao_adesivo"].includes(personalization) && !tertiary) issues.push("selecione o adesivo da medalha");
      if (!String(form.machineId)) issues.push("selecione a máquina laser");
      if (Number(form.cutSpeedMmMin) <= 0) issues.push("informe a velocidade de corte da laser");
      if (["gravacao", "gravacao_adesivo"].includes(personalization) && Number(form.engravingSpeedM2Hour) <= 0) issues.push("informe a velocidade de gravação da laser");
    }
    if (secondary && Number(secondary.package_cost) <= 0 && !(kind === "neon_led" && Number(form.neonCostPerMeter) > 0)) issues.push(`informe o custo de “${secondary.name}” no cadastro do insumo`);
    if (tertiary && Number(tertiary.package_cost) <= 0) issues.push(`informe o custo de “${tertiary.name}” no cadastro do insumo`);
    finishingMaterials.forEach((item) => { if (item && Number(item.package_cost) <= 0) issues.push(`informe o custo de “${item.name}” no cadastro do insumo`); });
    if (fixingMaterial && Number(fixingMaterial.package_cost) <= 0) issues.push(`informe o custo de “${fixingMaterial.name}” no cadastro do insumo`);
    if (fixingMaterial?.format === "rolo" && Number(fixingMaterial.length_m) <= 0) issues.push(`informe o comprimento do rolo “${fixingMaterial.name}”`);
    return [...new Set(issues)];
  }

  const issues = validationIssues();

  function calculate() {
    setMessage("");
    try {
      if (issues.length) throw new Error(`Falta completar: ${issues.join("; ")}.`);
      const settings = settingsWithCostCenter(liveCatalog, String(form.machineId));
      if (!settings) throw new Error("Configure as regras de preço antes de calcular.");
      const currentLaborMinutes = Number(common.laborMinutes);
      const previousCalculatedLabor = Number(result?.projectInput?.laborMinutes ?? 0);
      const laborWasAutomatic = Boolean(result) && currentLaborMinutes > 0 && Math.abs(currentLaborMinutes - previousCalculatedLabor) < .01;
      const appliedLaborMinutes = currentLaborMinutes <= 0 || laborWasAutomatic ? laborEstimate.minutes : currentLaborMinutes;
      const scalableProduction = (["banner", "faixa", "lona_backdrop", "adesivo_impresso", "adesivo_impresso_recorte", "adesivo_cor"] as SpecialProjectKind[]).includes(kind);
      const previousInput = result?.projectInput;
      const previousArea = Number(previousInput?.widthMm ?? 0) * Number(previousInput?.heightMm ?? 0) * Number(previousInput?.quantity ?? 0);
      const currentArea = Number(form.widthMm) * Number(form.heightMm) * Number(common.quantity);
      const areaFactor = scalableProduction && previousArea > 0 && currentArea > 0 ? currentArea / previousArea : 1;
      const currentMachineMinutes = Number(form.machineMinutes || common.machineMinutes);
      const currentSecondaryMachineMinutes = Number(form.secondaryMachineMinutes);
      const machineTimeWasTracked = Boolean(result) && currentMachineMinutes > 0 && Math.abs(currentMachineMinutes - Number(previousInput?.machineMinutes ?? 0)) < .01;
      const secondaryTimeWasTracked = Boolean(result) && currentSecondaryMachineMinutes > 0 && Math.abs(currentSecondaryMachineMinutes - Number(previousInput?.secondaryMachineMinutes ?? 0)) < .01;
      const appliedMachineMinutes = machineTimeWasTracked && Math.abs(areaFactor - 1) > .001 ? currentMachineMinutes * areaFactor : currentMachineMinutes;
      const appliedSecondaryMachineMinutes = secondaryTimeWasTracked && Math.abs(areaFactor - 1) > .001 ? currentSecondaryMachineMinutes * areaFactor : currentSecondaryMachineMinutes;
      const calc = calculateSpecialProject({
        kind, quantity: Number(common.quantity), widthMm: Number(form.widthMm), heightMm: Number(form.heightMm), depthMm: Number(form.depthMm), primaryMaterialId: String(form.primaryMaterialId), secondaryMaterialId: String(form.secondaryMaterialId), tertiaryMaterialId: String(form.tertiaryMaterialId), woodMaterialId: String(form.woodMaterialId), ropeMaterialId: String(form.ropeMaterialId), endCapMaterialId: String(form.endCapMaterialId), machineId: String(form.machineId), secondaryMachineId: String(form.secondaryMachineId), engravingItemType: String(form.engravingItemType || "copo_termico") as SpecialProjectInput["engravingItemType"], customerSuppliesMaterial: Boolean(form.customerSuppliesMaterial), rotaryEngraving: Boolean(form.rotaryEngraving),
        laborMinutes: appliedLaborMinutes, machineMinutes: appliedMachineMinutes, secondaryMachineMinutes: appliedSecondaryMachineMinutes, batchProduction: Boolean(form.batchProduction), batchProductionConfigured: true, installationCost: Number(common.installationCost), extraCost: Number(form.extraCost), desiredMarginPercent: Number(common.desiredMarginPercent), invoiceIncluded: common.invoiceIncluded, invoicePercent: Number(common.invoicePercent), commissionIncluded: common.commissionIncluded, commissionPercent: Number(common.commissionPercent),
        reinforcementSpacingMm: Number(form.reinforcementSpacingMm), doubleFrame: Boolean(form.doubleFrame), allowanceMm: Number(form.allowanceMm), weldingCostPerMeter: Number(form.weldingCostPerMeter), paintIncluded: Boolean(form.paintIncluded), paintCost: Number(form.paintCost), fixingType: String(form.fixingType), fixingMaterialId: String(form.fixingMaterialId), fixingSpacingMm: Number(form.fixingSpacingMm), fixingQuantity: Number(form.fixingQuantity), fixingCost: Number(form.fixingCost), complexityFactor: Number(form.complexityFactor), wastePercent: Number(form.wastePercent), removalHours: Number(form.removalHours), designHours: Number(form.designHours), printed: Boolean(form.printed), vinylCutIncluded: Boolean(form.vinylCutIncluded), transferMaskIncluded: Boolean(form.transferMaskIncluded), weedingCost: Number(form.weedingCost), adhesiveLengthM: Number(form.adhesiveLengthM), additionalVinyls: additionalVinyls.map((item) => ({ id: item.id, materialId: item.materialId, lengthM: Number(item.lengthM) })), primaryLinearMeterCost: Number(form.linearMeterCost), printSides: Number(form.printSides), setupSheets: Number(form.setupSheets), clickCost: Number(form.clickCost), finishingCost: Number(form.finishingCost), applicationCostPerM2: Number(form.applicationCostPerM2), adhesiveSides: Number(form.adhesiveSides), appliques: appliques.map((item) => ({ id: item.id, label: item.label, materialId: item.materialId, widthMm: Number(item.widthMm), heightMm: Number(item.heightMm), quantity: Number(item.quantity) })), letterProduction: String(form.letterProduction) as "pvc" | "3d", letterConstruction: String(form.letterConstruction) as "solida" | "face_retorno", letterCount: Number(form.letterCount), letterWidthMm: Number(form.letterWidthMm), letterHeightMm: Number(form.letterHeightMm), letterSpacingMm: Number(form.letterSpacingMm), vectorPieces, filamentWeightGrams: Number(form.filamentWeightGrams), filamentCostPerKg: Number(form.filamentCostPerKg), printTimeHours: Number(form.printTimeHours), supportWastePercent: Number(form.supportWastePercent), modelingHours: Number(form.modelingHours), perimeterMm: Number(form.perimeterMm), illuminated: Boolean(form.illuminated), plateLightingType: String(form.plateLightingType) as "modules" | "linear", ledModulesPerM2: Number(form.ledModulesPerM2), ledModuleWatts: Number(form.ledModuleWatts), powerSupplyWatts: Number(form.powerSupplyWatts), powerSupplyUnitCost: Number(form.powerSupplyUnitCost), neonLengthM: Number(form.neonLengthM), neonCostPerMeter: Number(form.neonCostPerMeter), neonWattsPerMeter: Number(form.neonWattsPerMeter), wiringCost: Number(form.wiringCost), totemFaces: Number(form.totemFaces), foundationCost: Number(form.foundationCost), basePlateCost: Number(form.basePlateCost), accessDoorCost: Number(form.accessDoorCost), electricalCost: Number(form.electricalCost), dimensionBasis: String(form.dimensionBasis) as "externa" | "interna", boxStyle: String(form.boxStyle) as "aberta" | "fechada" | "com_tampa", lidType: String(form.lidType) as "solta" | "articulada" | "correr", jointType: String(form.jointType) as "sobreposta" | "entre_laterais", verticalDividers: Number(form.verticalDividers), shelves: Number(form.shelves), panelSpacingMm: Number(form.panelSpacingMm), hardwareCost: Number(form.hardwareCost), varnishIncluded: Boolean(form.varnishIncluded), varnishRateM2: Number(form.varnishRateM2), medalShape: String(form.medalShape) as "circular" | "retangular" | "personalizada", medalSpacingMm: Number(form.medalSpacingMm), customPerimeterMm: Number(form.customPerimeterMm), ribbonType: String(form.ribbonType) as "sem_fita" | "colorida" | "personalizada", ribbonLengthM: Number(form.ribbonLengthM), ribbonPrintCostPerMeter: Number(form.ribbonPrintCostPerMeter), medalPersonalization: String(form.medalPersonalization) as "sem_personalizacao" | "gravacao" | "adesivo" | "gravacao_adesivo", engravingCoveragePercent: Number(form.engravingCoveragePercent), cutSpeedMmMin: Number(form.cutSpeedMmMin), engravingSpeedM2Hour: Number(form.engravingSpeedM2Hour), assemblyCostPerUnit: Number(form.assemblyCostPerUnit), holeDiameterMm: Number(form.holeDiameterMm),
      }, materials, machines, settings);
      if (currentLaborMinutes <= 0 || laborWasAutomatic) onLaborSuggested(appliedLaborMinutes);
      if (Math.abs(appliedMachineMinutes - currentMachineMinutes) > .01 || Math.abs(appliedSecondaryMachineMinutes - currentSecondaryMachineMinutes) > .01) setForm((current) => ({ ...current, machineMinutes: String(Number(appliedMachineMinutes.toFixed(2))), secondaryMachineMinutes: String(Number(appliedSecondaryMachineMinutes.toFixed(2))) }));
      setResult(calc);
      const primaryName = materialDisplayName(material(String(form.primaryMaterialId))) || "chapa";
      const secondaryName = materialDisplayName(material(String(form.secondaryMaterialId))) || "revestimento";
      const description = kind === "estrutura_lona" ? `Estrutura metálica com ${secondaryName} ${Number(form.widthMm) / 1000} × ${Number(form.heightMm) / 1000} m` : kind === "placa_adesivada" ? `Placa adesivada em ${primaryName} · ${form.widthMm} × ${form.heightMm} mm` : kind === "placa_aplique" ? `Placa com aplique em ${primaryName}${Boolean(form.illuminated) ? " · placa principal retroiluminada em LED" : ""} · ${form.widthMm} × ${form.heightMm} mm` : kind === "placa_acm_letra_caixa" ? `Placa de ${primaryName} com ${form.letterCount} letra(s) em ${String(form.letterProduction) === "3d" ? "impressão 3D" : "PVC"} · ${form.widthMm} × ${form.heightMm} mm` : kind === "caixa_expositor" ? `${String(form.boxStyle) === "aberta" ? "Caixa aberta" : String(form.boxStyle) === "fechada" ? "Caixa fechada" : "Caixa com tampa"} em ${primaryName} · ${form.widthMm} × ${form.heightMm} × ${form.depthMm} mm` : kind === "envelopamento" ? `Plotagem / envelopamento de ${calc.netAreaM2} m²` : kind === "impressao_rapida" ? `Impressão rápida ${form.widthMm} × ${form.heightMm} mm` : kind === "letra_caixa" ? `Letra-caixa em ${primaryName} · ${form.letterCount} peça(s) · projeto ${form.widthMm} × ${form.heightMm} mm` : kind === "neon_led" ? `Neon LED 2ª geração em ${primaryName} · ${form.widthMm} × ${form.heightMm} mm` : kind === "impressao_3d" ? `Impressão 3D · ${common.quantity} peça(s) · ${form.filamentWeightGrams} g por peça` : kind === "totem" ? `Totem ${form.totemFaces} face(s) em ${secondaryName} · ${Number(form.widthMm) / 1000} × ${Number(form.heightMm) / 1000} m` : `Medalha em ${primaryName} ${String(form.medalShape) === "circular" ? `Ø ${form.widthMm}` : `${form.widthMm} × ${form.heightMm}`} mm · ${common.quantity} unidade(s)`;
      const engravingTypeLabel = ({ copo_termico: "Copo térmico", caneca: "Caneca", garrafa: "Garrafa / squeeze", caneta: "Caneta", chaveiro: "Chaveiro", placa: "Placa", outro: "Objeto" } as Record<string, string>)[String(form.engravingItemType || "copo_termico")];
      const finalDescription = kind === "banner" ? `Banner em ${primaryName} · ${form.widthMm} × ${form.heightMm} mm` : kind === "faixa" ? `Faixa em ${primaryName} · ${form.widthMm} × ${form.heightMm} mm` : kind === "lona_backdrop" ? `Lona backdrop em ${primaryName} · ${form.widthMm} × ${form.heightMm} mm · ${form.fixingType}` : kind === "adesivo_impresso" ? `Adesivo impresso em ${primaryName} · ${form.widthMm} × ${form.heightMm} mm` : kind === "adesivo_impresso_recorte" ? `Adesivo impresso com recorte em ${primaryName} · ${form.widthMm} × ${form.heightMm} mm` : kind === "adesivo_cor" ? `Adesivo na cor ${Boolean(form.vinylCutIncluded) ? "com recorte" : "liso"} em ${primaryName} · ${form.widthMm} × ${form.heightMm} mm` : kind === "gravacao_laser" ? `${engravingTypeLabel} personalizado com gravação a laser · arte ${form.widthMm} × ${form.heightMm} mm` : description;
      const appliqueMaterials = kind === "placa_aplique" ? appliques.map((item) => materialDisplayName(material(item.materialId))) : [];
      const extraVinylMaterials = kind === "placa_adesivada" ? additionalVinyls.map((item) => materialDisplayName(material(item.materialId))) : [];
      onCalculated(calc, { description: finalDescription, material: [materialDisplayName(material(String(form.primaryMaterialId))), materialDisplayName(material(String(form.secondaryMaterialId))), ...extraVinylMaterials, materialDisplayName(material(String(form.tertiaryMaterialId))), materialDisplayName(material(String(form.woodMaterialId))), materialDisplayName(material(String(form.ropeMaterialId))), materialDisplayName(material(String(form.endCapMaterialId))), materialDisplayName(material(String(form.fixingMaterialId))), ...appliqueMaterials].filter(Boolean).join(" + "), widthMm: String(form.widthMm), heightMm: String(form.heightMm), depthMm: String(form.depthMm), productionNotes: `${labels[kind].title}: ${calc.materialUsage}. ${Object.entries(calc.projectMetrics).map(([key, value]) => `${key}: ${value}`).join("; ")}` });
    } catch (error) { setMessage((error as Error).message); }
  }

  return <div className="special-configurator">
    <header className="special-configurator-head"><span className="special-configurator-icon"><Calculator/></span><div><small>CONFIGURADOR TÉCNICO</small><b>{labels[kind].title}</b><p>{labels[kind].description}</p></div><span className="special-quantity">{common.quantity || 0} item(ns)</span></header>

    <section className="special-step">
      <div className="special-step-title"><span>01</span><div><b>Medidas do projeto</b><small>Informe as dimensões finais; sobras e perdas são calculadas depois.</small></div></div>
      <div className="special-fields">
        {kind === "envelopamento" && <label className="wide">Estimativa inicial do veículo<select defaultValue="" onChange={(event) => { const area = Number(event.target.value); if (area) { set("widthMm", "1000"); set("heightMm", String(area * 1000)); } }}><option value="">Medidas próprias / por painel</option><option value="18">Carro compacto · estimativa 18 m²</option><option value="22">Sedã médio · estimativa 22 m²</option><option value="27">SUV / picape · estimativa 27 m²</option><option value="38">Van · estimativa 38 m²</option></select><small>Estimativa editável. Confirme as medidas dos painéis antes de fechar.</small></label>}
        {kind === "impressao_rapida" && <label className="wide">Formato acabado<select defaultValue="" onChange={(event) => { const [width, height] = event.target.value.split("x"); if (width && height) { set("widthMm", width); set("heightMm", height); } }}><option value="">Medida personalizada</option><option value="90x50">Cartão 90 × 50 mm</option><option value="105x148">A6 · 105 × 148 mm</option><option value="148x210">A5 · 148 × 210 mm</option><option value="210x297">A4 · 210 × 297 mm</option><option value="297x420">A3 · 297 × 420 mm</option></select></label>}
        {kind === "gravacao_laser" && <label className="wide">Objeto a personalizar<select value={String(form.engravingItemType || "copo_termico")} onChange={(event) => { set("engravingItemType", event.target.value); set("primaryMaterialId", ""); }}><option value="copo_termico">Copo térmico</option><option value="caneca">Caneca</option><option value="garrafa">Garrafa / squeeze</option><option value="caneta">Caneta</option><option value="chaveiro">Chaveiro</option><option value="placa">Placa pequena</option><option value="outro">Outro objeto</option></select><small>Os insumos compatíveis serão filtrados conforme o tipo escolhido.</small></label>}
        {kind === "medalha" && <label>Formato da medalha<select value={String(form.medalShape)} onChange={(event) => set("medalShape", event.target.value)}><option value="circular">Circular</option><option value="retangular">Retangular / quadrada</option><option value="personalizada">Contorno personalizado</option></select></label>}
        {kind === "medalha" && String(form.medalShape) === "circular" ? <label>Diâmetro (mm)<Input type="number" min="0" step="1" value={String(form.widthMm)} onChange={(event) => { set("widthMm", event.target.value); setForm((current) => ({ ...current, heightMm: event.target.value })); }}/></label> : <>{number("widthMm", kind === "gravacao_laser" ? "Largura da gravação (mm)" : kind === "envelopamento" ? "Largura-base da área (mm)" : "Largura final (mm)", "1")}{number("heightMm", kind === "gravacao_laser" ? "Altura da gravação (mm)" : kind === "envelopamento" ? "Comprimento equivalente (mm)" : "Altura final (mm)", "1")}</>}
        {(kind === "estrutura_lona" || kind === "totem") && number("depthMm", "Profundidade / avanço (mm)", "1")}
        {kind === "caixa_expositor" && <>
          {number("depthMm", "Profundidade (mm)", "1")}
          <label className="wide">Referência das medidas<select value={String(form.dimensionBasis)} onChange={(event) => set("dimensionBasis", event.target.value)}><option value="externa">Medidas externas — tamanho final por fora</option><option value="interna">Medidas internas — espaço útil por dentro</option></select><small>O sistema compensa automaticamente a espessura da chapa para gerar as dimensões externas e internas.</small></label>
        </>}
        {kind === "letra_caixa" && <>
          <div className="wide special-dimension-note"><b>Medida final x medida de cada letra</b><span>A largura e a altura finais representam o letreiro montado. O aproveitamento da chapa é calculado pelas medidas individuais das letras abaixo — não pela caixa total de 3.000 × 800 mm, por exemplo.</span></div>
          {String(form.letterConstruction) !== "solida" && number("depthMm", "Profundidade da letra (mm)", "1")}
          {number("letterCount", "Quantidade de letras por letreiro", "1")}
          {number("letterWidthMm", "Largura média de cada letra (mm)", "1", "Não use aqui a largura do projeto inteiro.")}
          {number("letterHeightMm", "Altura média de cada letra (mm)", "1")}
          {number("letterSpacingMm", "Espaçamento mínimo no encaixe (mm)", "0.1")}
          {number("perimeterMm", "Perímetro médio por letra (mm)", "1", "Zero = estimativa pelas dimensões médias.")}
          <label className="wide vector-upload-field"><span>Arquivo vetorial para pré-encaixe</span><div><FileUp/><input type="file" accept=".svg,image/svg+xml" onChange={(event) => analyzeVector(event.target.files?.[0])}/><b>{vectorFileName || "Selecionar SVG"}</b></div><small>{vectorPieces.length ? `${vectorPieces.length} elemento(s) medido(s). O cálculo usa caixas delimitadoras, rotação e o espaçamento informado.` : "Opcional. Converta os textos em curvas. O sistema separa os elementos do SVG e verifica o encaixe nas chapas."}</small></label>
        </>}
        {kind === "placa_acm_letra_caixa" && <>{number("letterCount", "Quantidade de letras por placa", "1")}{number("letterWidthMm", "Largura média de cada letra (mm)", "1")}{number("letterHeightMm", "Altura média de cada letra (mm)", "1")}{String(form.letterProduction) === "3d" && number("depthMm", "Profundidade das letras 3D (mm)", "1")}</>}
        {kind === "medalha" && <>{number("medalSpacingMm", "Espaço entre medalhas (mm)", "0.1", "Usado no plano de corte e no aproveitamento da chapa.")}{number("holeDiameterMm", "Furo para fita (mm)", "0.1")}{String(form.medalShape) === "personalizada" && number("customPerimeterMm", "Perímetro do contorno (mm)", "0.1", "Use a medida obtida no arquivo vetorial.")}</>}
      </div>
    </section>

    <section className="special-step">
      <div className="special-step-title"><span>02</span><div><b>Materiais</b><small>Somente insumos tecnicamente compatíveis aparecem em cada lista.</small></div><Button type="button" size="sm" variant="outline" className="special-refresh-catalog" onClick={() => void refreshCatalog()} disabled={catalogRefreshing}><RefreshCw/>{catalogRefreshing ? "Atualizando..." : "Atualizar insumos"}</Button></div>
      <div className="special-fields">
        {kind === "gravacao_laser" && <>
          <label className="special-check wide"><input type="checkbox" checked={Boolean(form.customerSuppliesMaterial)} onChange={(event) => { set("customerSuppliesMaterial", event.target.checked); if (event.target.checked) set("primaryMaterialId", ""); }}/><span><b>Objeto fornecido pelo cliente</b><small>Calcula somente gravação, preparação, mão de obra e acabamento; não baixa o copo do estoque.</small></span></label>
          {!Boolean(form.customerSuppliesMaterial) && select("primaryMaterialId", "Objeto / insumo a gravar", engravingObjects)}
          {!Boolean(form.customerSuppliesMaterial) && !engravingObjects.length && help("Cadastre o objeto no formato Unidade. Para o preset de copo térmico, use “copo” ou “térmico” no nome e informe quantidade e preço de compra.")}
        </>}
        {(kind === "banner" || kind === "faixa") && <>
          {select("primaryMaterialId", "Lona para impressão", canvases)}
          {select("woodMaterialId", kind === "banner" ? "Madeirinha superior e inferior" : "Madeirinha das laterais", bannerWoods)}
          {select("ropeMaterialId", kind === "banner" ? "Cordinha superior" : "Cordinha das laterais", bannerRopes)}
          {select("endCapMaterialId", "Ponteiras (4 por unidade)", bannerEndCaps)}
          {!canvases.length && help("Cadastre a lona na categoria Lona, formato Rolo ou Metro linear, com largura útil, comprimento e preço.")}
          {!bannerWoods.length && help("Cadastre a madeirinha como Barra/perfil, Metro linear ou Unidade e use “madeira”, “madeirinha”, “sarrafo” ou “bastão” no nome.")}
          {!bannerRopes.length && help("Cadastre a cordinha como Rolo ou Metro linear e use “corda”, “cordinha” ou “cordão” no nome.")}
          {!bannerEndCaps.length && help("Cadastre a ponteira no formato Unidade e use “ponteira” no nome do insumo.")}
        </>}
        {kind === "lona_backdrop" && <>
          {select("primaryMaterialId", "Lona para impressão", canvases)}
          {!canvases.length && help("Cadastre a lona na categoria Lona, formato Rolo ou Metro linear, com largura útil, comprimento e preço.")}
          <div className="wide special-dimension-note"><b>Backdrop sem acessórios de banner</b><span>Este projeto não inclui madeirinha, cordinha nem ponteiras. O acabamento é escolhido na próxima etapa.</span></div>
        </>}
        {(kind === "adesivo_impresso" || kind === "adesivo_impresso_recorte") && <>
          {select("primaryMaterialId", "Adesivo para impressão", printedVinyls)}
          {select("secondaryMaterialId", "Laminação protetora / adesivo transparente", laminates, true)}
          {kind === "adesivo_impresso_recorte" && Boolean(form.transferMaskIncluded) && select("tertiaryMaterialId", "Máscara de transferência", transferMasks)}
          {!printedVinyls.length && help("Cadastre o adesivo como Vinil imprimível, formato Rolo ou Metro linear, com largura útil e custo.")}
          {kind === "adesivo_impresso_recorte" && Boolean(form.transferMaskIncluded) && !transferMasks.length && help("Cadastre a máscara como Rolo ou Metro linear, com largura útil e custo por metro.")}
        </>}
        {kind === "adesivo_cor" && <>
          {select("primaryMaterialId", "Adesivo principal / primeira cor", colorVinyls)}
          {Boolean(form.vinylCutIncluded) && Boolean(form.transferMaskIncluded) && select("tertiaryMaterialId", "Máscara de transferência", transferMasks)}
          {!colorVinyls.length && help("Cadastre o material como Vinil, finalidade Adesivo na cor ou Ambos, formato Rolo ou Metro linear, com largura útil e custo por metro.")}
          {Boolean(form.vinylCutIncluded) && Boolean(form.transferMaskIncluded) && !transferMasks.length && help("Cadastre a máscara como Rolo ou Metro linear, com largura útil e custo por metro.")}
          <div className="vinyl-mix-builder wide"><div className="vinyl-mix-head"><div><b>Combinação de cores</b><small>O adesivo principal é calculado automaticamente pelas medidas. Acrescente outras cores somente quando o mesmo trabalho usar mais de um vinil.</small></div><Button type="button" size="sm" variant="outline" onClick={addVinyl}><Plus/>Adicionar cor</Button></div>{additionalVinyls.map((entry, index) => <div className="vinyl-mix-row" key={entry.id}><label>Cor adicional {index + 1}<select value={entry.materialId} onChange={(event) => updateVinyl(entry.id, { materialId: event.target.value })}><option value="">Selecione o adesivo...</option>{colorVinyls.map((item) => <option value={item.id} key={item.id}>{item.name} · {costPerMeter(item) !== null ? `${currency.format(costPerMeter(item)!)}/m` : "sem custo por metro"}</option>)}</select></label><label>Consumo (m)<Input type="number" min="0.01" step="0.01" value={entry.lengthM} onChange={(event) => updateVinyl(entry.id, { lengthM: event.target.value })}/></label><Button type="button" variant="ghost" size="icon" aria-label={`Remover cor adicional ${index + 1}`} onClick={() => removeVinyl(entry.id)}><Trash2/></Button></div>)}</div>
        </>}
        {kind === "estrutura_lona" && <>{select("primaryMaterialId", "Metalon / perfil estrutural", structures)}{select("secondaryMaterialId", "Revestimento da estrutura", coatings)}{!structures.length && help("Cadastre o metalon como categoria Estrutura ou Metal, formato Barra/perfil, com comprimento, seção, espessura, preço e saldo.")}{!coatings.length && help("Cadastre lona como Rolo, ou ACM/galvanizado como Chapa, com dimensões e preço de compra.")}</>}
        {kind === "placa_adesivada" && <>
          {select("primaryMaterialId", "Chapa / base da placa", sheets)}
          <label>Tipo do adesivo<select value={Boolean(form.printed) ? "impresso" : "cor"} onChange={(event) => { const printed = event.target.value === "impresso"; set("printed", printed); set("secondaryMaterialId", ""); set("machineId", ""); set("tertiaryMaterialId", ""); setAdditionalVinyls([]); if (!printed) { set("vinylCutIncluded", true); set("transferMaskIncluded", true); } }}><option value="impresso">Adesivo impresso</option><option value="cor">Adesivo na cor / recorte eletrônico</option></select></label>
          {select("secondaryMaterialId", Boolean(form.printed) ? "Adesivo para impressão" : "Adesivo principal / primeira cor", Boolean(form.printed) ? printedVinyls : colorVinyls)}
          {Boolean(form.printed) ? select("tertiaryMaterialId", "Laminação protetora / adesivo transparente", laminates, true) : Boolean(form.vinylCutIncluded) && Boolean(form.transferMaskIncluded) ? select("tertiaryMaterialId", "Máscara de transferência", transferMasks) : null}
          {!sheets.length && help("Cadastre PVC, PS, ACM, acrílico, MDF ou galvanizado como Chapa, informando largura, altura, espessura e preço.")}
          {!(Boolean(form.printed) ? printedVinyls : colorVinyls).length && help("Cadastre o material como Vinil, informe sua finalidade e use formato Rolo ou Metro linear, com largura útil e custo por metro. Depois clique em Atualizar insumos.")}
          {!Boolean(form.printed) && Boolean(form.transferMaskIncluded) && !transferMasks.length && help("Cadastre a máscara de transferência como Rolo ou Metro linear. Use “máscara” ou “transfer” no nome e informe a largura útil e o custo.")}
          {!Boolean(form.printed) && <div className="vinyl-mix-builder wide"><div className="vinyl-mix-head"><div><b>Composição com mais de uma cor</b><small>O adesivo principal é calculado automaticamente pela placa. Se souber o consumo real, informe-o abaixo. Acrescente preto, branco, vermelho ou outras cores separadamente.</small></div><Button type="button" size="sm" variant="outline" onClick={addVinyl}><Plus/>Adicionar cor</Button></div><label>Consumo do adesivo principal (m)<Input type="number" min="0" step="0.01" value={String(form.adhesiveLengthM)} onChange={(event) => set("adhesiveLengthM", event.target.value)}/><small>Opcional. Vazio ou zero = cálculo automático pelas medidas da placa.</small></label>{additionalVinyls.map((entry, index) => <div className="vinyl-mix-row" key={entry.id}><label>Cor adicional {index + 1}<select value={entry.materialId} onChange={(event) => updateVinyl(entry.id, { materialId: event.target.value })}><option value="">Selecione o adesivo...</option>{colorVinyls.map((item) => <option value={item.id} key={item.id}>{item.name} · {costPerMeter(item) !== null ? `${currency.format(costPerMeter(item)!)}/m` : "sem custo por metro"}</option>)}</select></label><label>Consumo (m)<Input type="number" min="0.01" step="0.01" value={entry.lengthM} onChange={(event) => updateVinyl(entry.id, { lengthM: event.target.value })}/></label><Button type="button" variant="ghost" size="icon" aria-label={`Remover cor adicional ${index + 1}`} onClick={() => removeVinyl(entry.id)}><Trash2/></Button></div>)}</div>}
        </>}
        {kind === "placa_aplique" && <div className="applique-builder wide">
          <div className="applique-builder-intro"><Layers3/><span><b>Composição em camadas</b><small>Escolha a chapa principal e descreva cada aplique. O sistema calcula cada material separadamente e preserva o valor dos retalhos reaproveitáveis.</small></span></div>
          {select("primaryMaterialId", "Chapa principal / fundo", medalMaterials)}
          {!medalMaterials.length && help("Cadastre MDF, acrílico, PVC, PS, ACM ou outro material rígido como Chapa, com dimensões, espessura e preço.")}
          <div className="applique-list">
            {appliques.map((applique, index) => <article className="applique-card" key={applique.id}>
              <header><span><b>{applique.label || `Aplique ${index + 1}`}</b><small>Camada {index + 1} sobre a placa principal</small></span>{appliques.length > 1 && <Button type="button" variant="ghost" size="icon-sm" aria-label={`Excluir aplique ${index + 1}`} onClick={() => removeApplique(applique.id)}><Trash2/></Button>}</header>
              <div className="applique-fields">
                <label className="wide">Nome / função<Input value={applique.label} onChange={(event) => updateApplique(applique.id, { label: event.target.value })} placeholder="Ex.: pictograma, texto, moldura"/></label>
                <label className="wide">Material do aplique<select value={applique.materialId} onChange={(event) => updateApplique(applique.id, { materialId: event.target.value })}><option value="">Selecione a chapa...</option>{medalMaterials.map((item) => <option key={item.id} value={item.id}>{item.name}{item.thickness_mm ? ` · ${item.thickness_mm} mm` : ""}</option>)}</select></label>
                <label>Largura (mm)<Input type="number" min="0" step="1" value={applique.widthMm} onChange={(event) => updateApplique(applique.id, { widthMm: event.target.value })}/></label>
                <label>Altura (mm)<Input type="number" min="0" step="1" value={applique.heightMm} onChange={(event) => updateApplique(applique.id, { heightMm: event.target.value })}/></label>
                <label>Qtd. por placa<Input type="number" min="1" step="1" value={applique.quantity} onChange={(event) => updateApplique(applique.id, { quantity: event.target.value })}/></label>
              </div>
            </article>)}
          </div>
          <Button type="button" variant="outline" onClick={addApplique}><Plus/>Adicionar outro aplique</Button>
        </div>}
        {kind === "placa_acm_letra_caixa" && <>
          {select("primaryMaterialId", "Chapa de ACM da base", acmSheets)}
          <label>Fabricação das letras<select value={String(form.letterProduction)} onChange={(event) => { set("letterProduction", event.target.value); set("secondaryMaterialId", ""); set("secondaryMachineId", ""); set("secondaryMachineMinutes", "0"); }}><option value="pvc">Letras recortadas em chapa de PVC</option><option value="3d">Letras produzidas em impressão 3D</option></select></label>
          {String(form.letterProduction) === "3d" ? select("secondaryMaterialId", "Filamento das letras", filaments) : select("secondaryMaterialId", "Chapa de PVC das letras", pvcSheets)}
          {!acmSheets.length && help("Cadastre a base com “ACM” no nome, formato Chapa, dimensões, espessura e preço de compra.")}
          {String(form.letterProduction) === "pvc" && !pvcSheets.length && help("Cadastre cada PVC com “PVC” no nome, formato Chapa, dimensões, espessura e preço.")}
          {String(form.letterProduction) === "3d" && !filaments.length && help("Cadastre o material das letras na categoria Filamento 3D, preferencialmente em quilograma.")}
        </>}
        {kind === "caixa_expositor" && <>
          {select("primaryMaterialId", "Chapa e espessura da caixa", medalMaterials)}
          {!medalMaterials.length && help("Cadastre MDF, acrílico, PVC ou outro material rígido no formato Chapa, com largura, altura, espessura e preço de compra.")}
          <div className="wide special-dimension-note"><b>Plano de corte automático</b><span>Frente, fundo, laterais, base, tampa, divisórias e prateleiras serão encaixados individualmente na chapa. O retalho útil não será cobrado como perda integral.</span></div>
        </>}
        {kind === "envelopamento" && <><label>Tipo de adesivo<select value={Boolean(form.printed) ? "impresso" : "cor"} onChange={(event) => { set("printed", event.target.value === "impresso"); set("primaryMaterialId", ""); }}><option value="impresso">Adesivo impresso</option><option value="cor">Adesivo de recorte / cor pronta</option></select></label>{select("primaryMaterialId", "Vinil / adesivo", Boolean(form.printed) ? printedVinyls : colorVinyls)}{select("secondaryMaterialId", "Laminação / adesivo transparente", laminates, true)}{number("linearMeterCost", "Custo por metro neste trabalho", "0.01", "Vazio = preço cadastrado por metro.")}{!(Boolean(form.printed) ? printedVinyls : colorVinyls).length && help("Cadastre o adesivo como Vinil, informe sua finalidade e use formato Rolo ou Metro linear.")}</>}
        {kind === "impressao_rapida" && <>{select("primaryMaterialId", "Papel / folha de impressão", papers)}{!papers.length && help("Cadastre o papel como categoria Papel, formato Chapa/folha, com largura, altura, folhas por pacote e preço.")}</>}
        {kind === "letra_caixa" && <>
          <label>Construção da letra<select value={String(form.letterConstruction)} onChange={(event) => { set("letterConstruction", event.target.value); if (event.target.value === "solida") { set("secondaryMaterialId", ""); set("illuminated", false); } }}><option value="face_retorno">Face + lateral / retorno</option><option value="solida">Letra maciça em PVC, acrílico ou MDF — sem lateral</option></select></label>
          {select("primaryMaterialId", String(form.letterConstruction) === "solida" ? "Chapa da letra maciça" : "Material da face", sheets)}
          {String(form.letterConstruction) !== "solida" && select("secondaryMaterialId", "Material da lateral / retorno", returnMaterials)}
          {!sheets.length && help("Cadastre acrílico, ACM, PVC, PS, MDF ou galvanizado como Chapa, com dimensões, espessura e preço.")}
          {String(form.letterConstruction) !== "solida" && !returnMaterials.length && help("Cadastre a lateral como chapa ou bobina nas categorias Metal, Chapa, Estrutura ou Acrílico.")}
        </>}
        {kind === "neon_led" && <>{select("primaryMaterialId", "Placa-base em PVC ou acrílico", sheets.filter((item) => /pvc|acr[ií]l/i.test(item.name) || ["chapa", "acrilico"].includes(item.category)))}{select("secondaryMaterialId", "Mangueira neon LED cadastrada", neonMaterials, true)}{number("neonCostPerMeter", "Custo direto da mangueira (R$/m)", "0.01", "Opcional para Rolo/Metro. Obrigatório se o insumo foi cadastrado como Unidade; este valor prevalece neste orçamento.")}{material(String(form.secondaryMaterialId)) && !["rolo", "metro"].includes(material(String(form.secondaryMaterialId))!.format) && help("Este neon foi cadastrado como Unidade. Para cálculo e baixa automática de estoque, edite-o para Metro linear ou Rolo. Enquanto isso, informe acima o custo correto por metro.")}{!neonMaterials.length && help("Cadastre a mangueira como categoria LED e formato Rolo ou Metro linear. Insumos com “neon” ou “mangueira” no nome também são reconhecidos.")}</>}
        {kind === "impressao_3d" && <>{select("primaryMaterialId", "Filamento", filaments)}{number("filamentCostPerKg", "Custo direto do filamento (R$/kg)", "0.01", "Opcional: use para uma compra ou cor específica sem alterar o cadastro.")}{!filaments.length && help("Cadastre PLA, PETG, ABS ou outro material na categoria Filamento 3D, com preço e quantidade de compra em kg.")}</>}
        {kind === "totem" && <>{select("primaryMaterialId", "Metalon / perfil estrutural", structures)}{select("secondaryMaterialId", "Material das faces / revestimento", coatings)}{!structures.length && help("Cadastre o perfil como Estrutura ou Metal, formato Barra/perfil, informando comprimento e custo.")}{!coatings.length && help("Cadastre ACM, galvanizado, PVC, acrílico ou lona com dimensões e preço de compra.")}</>}
        {kind === "medalha" && <>
          {select("primaryMaterialId", "Material e espessura da medalha", medalMaterials)}
          <label>Tipo de fita<select value={String(form.ribbonType)} onChange={(event) => { set("ribbonType", event.target.value); if (event.target.value === "sem_fita") set("secondaryMaterialId", ""); }}><option value="sem_fita">Sem fita</option><option value="colorida">Fita colorida lisa</option><option value="personalizada">Fita personalizada</option></select></label>
          {String(form.ribbonType) !== "sem_fita" && <>{select("secondaryMaterialId", "Fita cadastrada", ribbons)}{number("ribbonLengthM", "Fita por medalha (m)", "0.01")}{String(form.ribbonType) === "personalizada" && number("ribbonPrintCostPerMeter", "Personalização da fita (R$/m)")}</>}
          <label>Personalização da medalha<select value={String(form.medalPersonalization)} onChange={(event) => { set("medalPersonalization", event.target.value); if (!["adesivo", "gravacao_adesivo"].includes(event.target.value)) set("tertiaryMaterialId", ""); }}><option value="sem_personalizacao">Sem personalização</option><option value="gravacao">Gravação a laser</option><option value="adesivo">Adesivo aplicado</option><option value="gravacao_adesivo">Gravação + adesivo</option></select></label>
          {["adesivo", "gravacao_adesivo"].includes(String(form.medalPersonalization)) && select("tertiaryMaterialId", "Adesivo da personalização", medalStickers)}
          {!medalMaterials.length && help("Cadastre MDF, acrílico, PS, PVC ou metal como Chapa, informando largura, altura, espessura, quantidade e preço do pacote.")}
          {String(form.ribbonType) !== "sem_fita" && !ribbons.length && help("Cadastre a fita como Rolo ou Metro. Inclua “fita”, “cetim” ou “gorgurão” no nome e informe comprimento e preço.")}
          {["adesivo", "gravacao_adesivo"].includes(String(form.medalPersonalization)) && !medalStickers.length && help("Cadastre o adesivo como categoria Vinil e formato Rolo, com largura útil, comprimento e preço.")}
        </>}
      </div>
    </section>

    <section className="special-step">
      <div className="special-step-title"><span>03</span><div><b>Fabricação e acabamento</b><small>Inclua processo, perdas, máquina e custos complementares.</small></div></div>
      <div className="special-fields">
        <div className="labor-suggestion wide"><Sparkles/><span><small>ESTIMATIVA INTELIGENTE DE MÃO DE OBRA</small><b>{laborEstimate.minutes} minutos sugeridos</b><p>{laborEstimate.factors.join(" · ")}. O tempo continua editável conforme a experiência real da equipe.</p></span><Button type="button" variant={Number(common.laborMinutes) === laborEstimate.minutes ? "secondary" : "outline"} onClick={() => { setResult(null); onLaborSuggested(laborEstimate.minutes); }}>{Number(common.laborMinutes) === laborEstimate.minutes ? "Sugestão aplicada" : "Usar esta sugestão"}</Button></div>
        {kind === "gravacao_laser" && <>
          <label>Máquina laser<select value={String(form.machineId)} onChange={(event) => set("machineId", event.target.value)}><option value="">Selecione...</option>{machines.filter((item) => item.machine_type === "laser").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {number("machineMinutes", "Tempo de gravação por unidade (min)", "0.1", `O sistema multiplica automaticamente pelas ${Number(common.quantity) || 0} unidade(s).`)}
          <label className="special-check"><input type="checkbox" checked={Boolean(form.rotaryEngraving)} onChange={(event) => set("rotaryEngraving", event.target.checked)}/><span><b>Usar eixo rotativo</b><small>Recomendado para copos, canecas e garrafas cilíndricas.</small></span></label>
          {number("finishingCost", "Limpeza, acabamento e embalagem (total)", "0.01")}
        </>}
        {(kind === "banner" || kind === "faixa") && <>
          {number("allowanceMm", kind === "banner" ? "Sobra para madeirinha em cima e embaixo (mm por lado)" : "Sobra para madeirinha nas laterais (mm por lado)", "1")}
          {number("wastePercent", "Perda técnica adicional (%)", "0.1")}
          {number("finishingCost", "Cola, refile ou acabamento adicional", "0.01", "Madeirinhas, cordinha e ponteiras já são calculadas pelos insumos selecionados.")}
          <label>Impressora de grandes formatos<select value={String(form.machineId)} onChange={(event) => set("machineId", event.target.value)}><option value="">Selecione...</option>{machines.filter((item) => item.machine_type === "grandes_formatos").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {String(form.machineId) && number("machineMinutes", "Tempo de impressão (min)", "0.1")}
        </>}
        {kind === "lona_backdrop" && <>
          <label className="wide">Acabamento do backdrop<select value={String(form.fixingType)} onChange={(event) => { set("fixingType", event.target.value); if (!/ilhós/i.test(event.target.value)) set("fixingMaterialId", ""); }}><option value="Ilhós em todo o perímetro">Ilhós em todo o perímetro (mais comum)</option><option value="Bainha reforçada com ilhós">Bainha reforçada + ilhós</option><option value="Bainha reforçada">Bainha reforçada, sem ilhós</option><option value="Refile simples">Refile simples</option><option value="Sem acabamento">Sem acabamento</option><option value="Outro acabamento">Outro acabamento</option></select><small>Backdrops normalmente usam ilhós e não levam madeirinha nem cordinha.</small></label>
          {number("allowanceMm", "Sobra para acabamento em todo o perímetro (mm por lado)", "1")}
          {/ilhós/i.test(String(form.fixingType)) && <>
            {select("fixingMaterialId", "Ilhós cadastrado (opcional)", backdropEyelets, true)}
            {String(form.fixingMaterialId) && number("fixingSpacingMm", "Espaçamento entre ilhós (mm)", "1", "O sistema calcula a quantidade ao redor de todo o perímetro.")}
            {String(form.fixingMaterialId) && number("fixingQuantity", "Quantidade manual de ilhós", "1", "Opcional. Deixe vazio para calcular pelo espaçamento.")}
          </>}
          {number("wastePercent", "Perda técnica adicional (%)", "0.1")}
          {number("finishingCost", "Custo adicional do acabamento", "0.01", "Use para bainha, reforço, aplicação dos ilhós ou outro serviço não cadastrado como insumo.")}
          <label>Impressora de grandes formatos<select value={String(form.machineId)} onChange={(event) => set("machineId", event.target.value)}><option value="">Selecione...</option>{machines.filter((item) => item.machine_type === "grandes_formatos").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {String(form.machineId) && number("machineMinutes", "Tempo de impressão (min)", "0.1")}
        </>}
        {(kind === "adesivo_impresso" || kind === "adesivo_impresso_recorte") && <>
          {number("wastePercent", "Perda técnica adicional (%)", "0.1")}
          <label>Impressora de grandes formatos<select value={String(form.machineId)} onChange={(event) => set("machineId", event.target.value)}><option value="">Selecione...</option>{machines.filter((item) => item.machine_type === "grandes_formatos").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {String(form.machineId) && number("machineMinutes", "Tempo de impressão (min)", "0.1")}
          {kind === "adesivo_impresso_recorte" && <><label>Plotter de recorte<select value={String(form.secondaryMachineId)} onChange={(event) => set("secondaryMachineId", event.target.value)}><option value="">Selecione...</option>{machines.filter((item) => item.machine_type === "plotter").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{String(form.secondaryMachineId) && number("secondaryMachineMinutes", "Tempo de recorte (min)", "0.1")}<label className="special-check"><input type="checkbox" checked={Boolean(form.transferMaskIncluded)} onChange={(event) => { set("transferMaskIncluded", event.target.checked); if (!event.target.checked) set("tertiaryMaterialId", ""); }}/><span><b>Usar máscara de transferência</b><small>Para aplicar o adesivo após o recorte e a depilação.</small></span></label>{number("weedingCost", "Depilação e preparação (custo direto)", "0.01")}</>}
          {number("finishingCost", "Refilo, separação e embalagem", "0.01")}
        </>}
        {kind === "adesivo_cor" && <>
          <label>Tipo de fornecimento<select value={Boolean(form.vinylCutIncluded) ? "recorte" : "liso"} onChange={(event) => { const cut = event.target.value === "recorte"; set("vinylCutIncluded", cut); if (!cut) { set("transferMaskIncluded", false); set("tertiaryMaterialId", ""); set("machineId", ""); set("machineMinutes", "0"); } else set("transferMaskIncluded", true); }}><option value="liso">Adesivo na cor liso — somente refile</option><option value="recorte">Adesivo na cor com recorte eletrônico</option></select></label>
          {number("wastePercent", "Perda técnica adicional (%)", "0.1")}
          {Boolean(form.vinylCutIncluded) && <><label>Plotter de recorte<select value={String(form.machineId)} onChange={(event) => set("machineId", event.target.value)}><option value="">Selecione...</option>{machines.filter((item) => item.machine_type === "plotter").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{String(form.machineId) && number("machineMinutes", "Tempo de recorte (min)", "0.1")}<label className="special-check"><input type="checkbox" checked={Boolean(form.transferMaskIncluded)} onChange={(event) => { set("transferMaskIncluded", event.target.checked); if (!event.target.checked) set("tertiaryMaterialId", ""); }}/><span><b>Usar máscara de transferência</b><small>Para posicionar e aplicar as partes recortadas.</small></span></label>{number("weedingCost", "Depilação e preparação (custo direto)", "0.01")}</>}
          {number("finishingCost", Boolean(form.vinylCutIncluded) ? "Separação e embalagem" : "Refilo, separação e embalagem", "0.01")}
        </>}
        {(["adesivo_impresso", "adesivo_impresso_recorte", "adesivo_cor", "placa_adesivada"] as SpecialProjectKind[]).includes(kind) && <label className="special-check wide"><input type="checkbox" checked={Boolean(form.batchProduction)} onChange={(event) => set("batchProduction", event.target.checked)}/><span><b>Produção agrupada com outros trabalhos</b><small>Recomendado para pedidos pequenos e lotes de plaquinhas. O custo real de materiais, máquina e mão de obra permanece; somente o rateio mensal é distribuído pela fração produtiva ocupada. Desative quando este pedido ocupar a produção de forma exclusiva.</small></span></label>}
        {kind === "estrutura_lona" && <>{number("reinforcementSpacingMm", "Espaçamento das travessas (mm)", "1")}<label className="special-check"><input type="checkbox" checked={Boolean(form.doubleFrame)} onChange={(event) => set("doubleFrame", event.target.checked)}/><span><b>Estrutura dupla / caixa</b><small>Calcula dois quadros e ligações de profundidade.</small></span></label>{["rolo", "metro"].includes(material(String(form.secondaryMaterialId))?.format ?? "") && number("allowanceMm", "Sobra do revestimento por lado (mm)", "1")}{number("weldingCostPerMeter", "Solda/consumíveis por metro", "0.01")}<label className="special-check"><input type="checkbox" checked={Boolean(form.paintIncluded)} onChange={(event) => set("paintIncluded", event.target.checked)}/><span><b>Aplicar fundo / primer e pintura</b><small>O custo pode ser informado somente neste orçamento.</small></span></label>{Boolean(form.paintIncluded) && number("paintCost", "Custo direto da pintura (total)")}<label>Fixação do revestimento<select value={String(form.fixingType)} onChange={(event) => set("fixingType", event.target.value)}><option value="">Não incluir / ainda não definido</option><option value="Fita dupla face">Fita dupla face</option><option value="Parafusos">Parafusos</option><option value="Rebites">Rebites</option><option value="Cola estrutural">Cola estrutural</option><option value="Ilhós e abraçadeiras">Ilhós e abraçadeiras</option><option value="Outro sistema">Outro sistema</option></select></label>{String(form.fixingType) && number("fixingCost", "Custo adicional da fixação", "0.01", "Opcional: use somente para custos que não estejam no insumo cadastrado.")}</>}
        {kind === "placa_adesivada" && <>
          <label>Faces adesivadas<select value={String(form.adhesiveSides)} onChange={(event) => set("adhesiveSides", event.target.value)}><option value="1">Somente frente</option><option value="2">Frente e verso</option></select></label>
          {number("wastePercent", "Perda técnica adicional (%)", "0.1")}
          {number("applicationCostPerM2", "Aplicação do adesivo (R$/m²)", "0.01", "Custo da limpeza, posicionamento e aplicação sobre a chapa.")}
          {number("finishingCost", "Recorte, furos e acabamento")}
          {!Boolean(form.printed) && <label className="special-check"><input type="checkbox" checked={Boolean(form.vinylCutIncluded)} onChange={(event) => { set("vinylCutIncluded", event.target.checked); if (!event.target.checked) { set("transferMaskIncluded", false); set("tertiaryMaterialId", ""); set("machineId", ""); } }}/><span><b>Recorte eletrônico do adesivo</b><small>Inclui plotter, depilação e opção de máscara de transferência.</small></span></label>}
          {!Boolean(form.printed) && Boolean(form.vinylCutIncluded) && <label className="special-check"><input type="checkbox" checked={Boolean(form.transferMaskIncluded)} onChange={(event) => { set("transferMaskIncluded", event.target.checked); if (!event.target.checked) set("tertiaryMaterialId", ""); }}/><span><b>Usar máscara de transferência</b><small>Calculada pela mesma área linear do adesivo recortado.</small></span></label>}
          <label>{Boolean(form.printed) ? "Impressora do adesivo" : "Plotter de recorte"}<select value={String(form.machineId)} onChange={(event) => set("machineId", event.target.value)}><option value="">{!Boolean(form.printed) && !Boolean(form.vinylCutIncluded) ? "Sem recorte" : "Selecione..."}</option>{machines.filter((item) => Boolean(form.printed) ? item.machine_type === "grandes_formatos" : item.machine_type === "plotter").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {String(form.machineId) && number("machineMinutes", Boolean(form.printed) ? "Tempo de impressão (min)" : "Tempo de recorte (min)", "0.1")}
          {!Boolean(form.printed) && Boolean(form.vinylCutIncluded) && number("weedingCost", "Depilação + aplicação da máscara (custo total)", "0.01", "Mão de obra específica para retirar o excesso e preparar a aplicação.")}
          <label>Máquina de corte da chapa<select value={String(form.secondaryMachineId)} onChange={(event) => set("secondaryMachineId", event.target.value)}><option value="">Corte manual / sem máquina</option>{machines.filter((item) => ["router_cnc", "laser", "plotter", "acabamento"].includes(item.machine_type)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {String(form.secondaryMachineId) && number("secondaryMachineMinutes", "Tempo de corte/acabamento (min)", "0.1")}
        </>}
        {kind === "placa_aplique" && <>
          {number("wastePercent", "Perda técnica / margem de corte (%)", "0.1", "O custo é proporcional ao aproveitamento; o restante da chapa continua disponível como retalho.")}
          <label className="special-check"><input type="checkbox" checked={Boolean(form.illuminated)} onChange={(event) => { set("illuminated", event.target.checked); if (!event.target.checked) set("tertiaryMaterialId", ""); }}/><span><b>Retroiluminação LED atrás da placa principal</b><small>Os apliques permanecem na frente. O sistema calcula os módulos pela área total da placa, além da potência e das fontes.</small></span></label>
          {Boolean(form.illuminated) && <>
            <label>Sistema de iluminação<select value={String(form.plateLightingType)} onChange={(event) => { set("plateLightingType", event.target.value); set("tertiaryMaterialId", ""); }}><option value="modules">Módulos LED por unidade</option><option value="linear">Fita / mangueira neon LED por metro</option></select></label>
            {String(form.plateLightingType) === "linear" ? <>
              {select("tertiaryMaterialId", "Fita / mangueira LED", neonMaterials)}
              {number("neonLengthM", "Comprimento usado atrás da placa (m)", "0.01")}
              {number("neonCostPerMeter", "Substituir custo da mangueira (R$/m)", "0.01", "Opcional: deixe zero para usar o custo por metro do rolo cadastrado.")}
              {number("neonWattsPerMeter", "Consumo da mangueira (W/m)", "0.1")}
              {!neonMaterials.length && help("Cadastre a fita ou mangueira na categoria LED, formato Rolo ou Metro linear, com comprimento e preço.")}
            </> : <>
              {select("tertiaryMaterialId", "Módulo LED", leds)}
              {number("ledModulesPerM2", "Módulos LED por m² de placa", "0.1", "A densidade é aplicada à área total da placa principal retroiluminada.")}
              {number("ledModuleWatts", "Potência por módulo (W)", "0.01")}
              {!leds.length && help("Cadastre o módulo como categoria LED, formato Unidade, com quantidade e preço da embalagem.")}
            </>}
            {number("powerSupplyWatts", "Capacidade de cada fonte (W)", "1")}
            {number("powerSupplyUnitCost", "Custo unitário da fonte")}
            {number("wiringCost", "Fiação, conectores e elétrica")}
          </>}
          {number("finishingCost", Boolean(form.illuminated) ? "Colagem, espaçadores e montagem (total)" : "Colagem, fita e montagem (total)")}
        </>}
        {kind === "placa_acm_letra_caixa" && <>
          {number("wastePercent", "Perda técnica dos materiais (%)", "0.1", "O restante das chapas permanece como retalho reutilizável.")}
          {String(form.letterProduction) === "3d" && number("filamentWeightGrams", "Peso total de filamento por placa (g)", "0.1", "Use o peso informado pelo fatiador da impressão 3D.")}
          <label>Máquina da base de ACM<select value={String(form.machineId)} onChange={(event) => set("machineId", event.target.value)}><option value="">Corte manual / base já cortada</option>{machines.filter((item) => ["router_cnc", "laser", "acabamento"].includes(item.machine_type)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {String(form.machineId) && number("machineMinutes", "Tempo da base de ACM (min)", "0.1")}
          <label>{String(form.letterProduction) === "3d" ? "Impressora 3D" : "Máquina de corte das letras"}<select value={String(form.secondaryMachineId)} onChange={(event) => set("secondaryMachineId", event.target.value)}><option value="">Selecione...</option>{machines.filter((item) => String(form.letterProduction) === "3d" ? item.machine_type === "impressora_3d" : ["router_cnc", "laser"].includes(item.machine_type)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {String(form.secondaryMachineId) && number("secondaryMachineMinutes", String(form.letterProduction) === "3d" ? "Tempo total de impressão 3D (min)" : "Tempo de corte das letras (min)", "0.1", String(form.letterProduction) === "3d" ? "Use o tempo total informado pelo fatiador." : "Inclua preparação e corte de todas as letras.")}
          <label className="special-check"><input type="checkbox" checked={Boolean(form.illuminated)} onChange={(event) => set("illuminated", event.target.checked)}/><span><b>Iluminação com LED</b><small>Inclui módulos, potência e fontes para as letras.</small></span></label>
          {Boolean(form.illuminated) && <>{select("tertiaryMaterialId", "Módulo LED", leds)}{number("ledModulesPerM2", "Módulos LED por m² de letras", "0.1")}{number("ledModuleWatts", "Potência por módulo (W)", "0.01")}{number("powerSupplyWatts", "Capacidade de cada fonte (W)", "1")}{number("powerSupplyUnitCost", "Custo unitário da fonte")}{!leds.length && help("Cadastre o módulo como categoria LED, formato Unidade, com quantidade e preço da embalagem.")}</>}
          {number("finishingCost", "Montagem das letras no ACM (total)", "0.01", "Colagem, espaçadores, gabarito, elétrica e acabamento.")}
        </>}
        {kind === "caixa_expositor" && <>
          <label>Modelo da caixa<select value={String(form.boxStyle)} onChange={(event) => set("boxStyle", event.target.value)}><option value="aberta">Aberta em cima</option><option value="fechada">Fechada — topo fixo</option><option value="com_tampa">Com tampa móvel</option></select></label>
          {String(form.boxStyle) === "com_tampa" && <label>Tipo de tampa<select value={String(form.lidType)} onChange={(event) => set("lidType", event.target.value)}><option value="solta">Tampa solta / encaixada</option><option value="articulada">Tampa articulada</option><option value="correr">Tampa de correr</option></select></label>}
          <label>Construção dos painéis<select value={String(form.jointType)} onChange={(event) => set("jointType", event.target.value)}><option value="sobreposta">Frente e fundo sobrepostos às laterais</option><option value="entre_laterais">Frente e fundo entre as laterais</option></select></label>
          {number("verticalDividers", "Divisórias verticais", "1")}
          {number("shelves", "Prateleiras internas", "1")}
          {number("panelSpacingMm", "Espaçamento entre cortes (mm)", "0.1", "Folga considerada no encaixe de todas as peças na chapa.")}
          {number("wastePercent", "Perda técnica adicional (%)", "0.1", "Aplicada apenas à área apropriada; o retalho restante continua reutilizável.")}
          {number("hardwareCost", "Ferragens e acessórios (total)", "0.01", "Dobradiças, fechos, puxadores, corrediças ou pés.")}
          {number("finishingCost", "Cola, montagem e acabamento (total)", "0.01")}
        </>}
        {kind === "envelopamento" && <><label>Complexidade<select value={String(form.complexityFactor)} onChange={(event) => set("complexityFactor", event.target.value)}><option value="1">Superfície plana</option><option value="1.2">Curvas moderadas</option><option value="1.4">Para-choques / vincos complexos</option></select></label>{number("wastePercent", "Perda técnica (%)", "0.1")}{number("removalHours", "Remoção anterior (horas)", "0.1")}{number("designHours", "Criação / fechamento (horas)", "0.1")}</>}
        {kind === "impressao_rapida" && <><label>Impressão<select value={String(form.printSides)} onChange={(event) => set("printSides", event.target.value)}><option value="1">Só frente (4×0 / 1×0)</option><option value="2">Frente e verso (4×4 / 1×1)</option></select></label>{number("setupSheets", "Folhas de acerto", "1")}{number("wastePercent", "Perda adicional (%)", "0.1")}{number("clickCost", "Custo por clique / face")}{number("finishingCost", "Corte, vinco, dobra e acabamento")}</>}
        {kind === "letra_caixa" && <>{String(form.letterConstruction) !== "solida" && <label className="special-check"><input type="checkbox" checked={Boolean(form.illuminated)} onChange={(event) => set("illuminated", event.target.checked)}/><span><b>Iluminação com LED</b><small>Inclui módulos, potência e fontes.</small></span></label>}{Boolean(form.illuminated) && String(form.letterConstruction) !== "solida" && <>{select("tertiaryMaterialId", "Módulo LED", leds)}{number("ledModulesPerM2", "Módulos LED por m²", "0.1")}{number("ledModuleWatts", "Potência por módulo (W)", "0.01")}{number("powerSupplyWatts", "Capacidade de cada fonte (W)", "1")}{number("powerSupplyUnitCost", "Custo unitário da fonte")}{!leds.length && help("Cadastre o módulo como categoria LED, formato Unidade, com quantidade e preço da embalagem.")}</>}<label className="special-check"><input type="checkbox" checked={Boolean(form.paintIncluded)} onChange={(event) => set("paintIncluded", event.target.checked)}/><span><b>Incluir pintura</b><small>Primer, tinta e preparação com custo direto neste orçamento.</small></span></label>{Boolean(form.paintIncluded) && number("paintCost", "Custo direto da pintura")}<label>Forma de fixação<select value={String(form.fixingType)} onChange={(event) => set("fixingType", event.target.value)}><option value="">Não incluir</option><option value="Fita dupla face">Fita dupla face</option><option value="Cola estrutural">Cola estrutural</option><option value="Espaçadores">Espaçadores</option><option value="Parafusos">Parafusos</option><option value="Pinos + gabarito">Pinos + gabarito</option><option value="Outro sistema">Outro sistema</option></select></label>{String(form.fixingType) && number("fixingCost", "Custo adicional da fixação", "0.01", "Opcional: use somente para custos que não estejam no insumo cadastrado.")}</>}
        {kind === "neon_led" && <>{number("neonLengthM", "Comprimento total da mangueira neon (m)", "0.01")}{number("neonWattsPerMeter", "Consumo do neon (W/m)", "0.1")}{number("powerSupplyWatts", "Capacidade de cada fonte (W)", "1")}{number("powerSupplyUnitCost", "Custo unitário da fonte")}{number("wiringCost", "Fiação, conectores e elétrica")}{number("finishingCost", "Canal, colagem, solda e montagem")}<label>Forma de fixação<select value={String(form.fixingType)} onChange={(event) => set("fixingType", event.target.value)}><option value="">Não incluir</option><option value="Fita dupla face">Fita dupla face</option><option value="Espaçadores">Espaçadores</option><option value="Parafusos">Parafusos</option><option value="Cola estrutural">Cola estrutural</option></select></label>{String(form.fixingType) && number("fixingCost", "Custo adicional da fixação", "0.01", "Opcional: use somente para custos que não estejam no insumo cadastrado.")}</>}
        {kind === "impressao_3d" && <>{number("filamentWeightGrams", "Peso final por peça (g)", "0.1", "Use o peso informado pelo fatiador antes dos suportes.")}{number("supportWastePercent", "Suportes, purga e perdas (%)", "0.1")}{number("printTimeHours", "Tempo de impressão por peça (h)", "0.01")}{number("modelingHours", "Modelagem / preparação (h)", "0.1")}{number("finishingCost", "Pós-processamento (total)", "0.01", "Remoção de suporte, lixamento, primer, pintura ou montagem.")}</>}
        {kind === "totem" && <><label>Quantidade de faces<select value={String(form.totemFaces)} onChange={(event) => set("totemFaces", event.target.value)}><option value="1">Uma face</option><option value="2">Duas faces</option></select></label>{number("reinforcementSpacingMm", "Espaçamento das travessas (mm)", "1")}{number("weldingCostPerMeter", "Solda/consumíveis por metro", "0.01")}<label className="special-check"><input type="checkbox" checked={Boolean(form.paintIncluded)} onChange={(event) => set("paintIncluded", event.target.checked)}/><span><b>Fundo / primer e pintura da estrutura</b><small>Custo direto específico deste totem.</small></span></label>{Boolean(form.paintIncluded) && number("paintCost", "Custo direto da pintura")}<label>Fixação das faces<select value={String(form.fixingType)} onChange={(event) => set("fixingType", event.target.value)}><option value="">Não incluir</option><option value="Fita VHB">Fita VHB</option><option value="Parafusos">Parafusos</option><option value="Rebites">Rebites</option><option value="Cola estrutural">Cola estrutural</option></select></label>{String(form.fixingType) && number("fixingCost", "Custo adicional da fixação", "0.01", "Opcional: use somente para custos que não estejam no insumo cadastrado.")}{number("basePlateCost", "Base, sapatas e chumbadores")}{number("foundationCost", "Fundação / concretagem")}{number("accessDoorCost", "Porta de inspeção e acabamento")}{number("electricalCost", "LED, fontes, cabos e elétrica")}{number("finishingCost", "Adesivo / acabamento gráfico")}</>}
        {(["placa_adesivada", "placa_aplique", "placa_acm_letra_caixa"] as SpecialProjectKind[]).includes(kind) && <label>Forma de fixação do conjunto<select value={String(form.fixingType)} onChange={(event) => set("fixingType", event.target.value)}><option value="">Não incluir</option><option value="Fita dupla face">Fita dupla face / VHB</option><option value="Parafusos">Parafusos</option><option value="Rebites">Rebites</option><option value="Cola estrutural">Cola estrutural</option><option value="Espaçadores">Espaçadores</option><option value="Outro sistema">Outro sistema</option></select></label>}
        {(["estrutura_lona", "placa_adesivada", "placa_aplique", "placa_acm_letra_caixa", "letra_caixa", "neon_led", "totem"] as SpecialProjectKind[]).includes(kind) && String(form.fixingType) && <>
          {select("fixingMaterialId", "Insumo de fixação cadastrado", fixingMaterials, true)}
          {fixingPreview && <div className="wide special-dimension-note"><b>Consumo automático da fita</b><span>{fixingPreview.formula} = <strong>{fixingPreview.meters.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} m</strong>. Custo total calculado: <strong>{currency.format(fixingPreview.total)}</strong>.</span></div>}
          {material(String(form.fixingMaterialId))?.format === "unidade" && number("fixingSpacingMm", "Distância entre fixações (mm)", "1", "O sistema divide todo o perímetro por este espaçamento e arredonda para cima.")}
          {number("fixingQuantity", "Substituir consumo automático", "0.001", "Opcional. Deixe vazio ou zero para calcular pelo perímetro.")}
          {(["placa_adesivada", "placa_aplique", "placa_acm_letra_caixa"] as SpecialProjectKind[]).includes(kind) && number("fixingCost", "Custo adicional da fixação", "0.01", "Opcional: mão de obra ou material não cadastrado.")}
          {!fixingMaterials.length && help("Cadastre fita dupla face, VHB, parafusos, rebites, espaçadores ou cola na categoria Fixação. Use formato Metro/Rolo para fita e Unidade para parafusos.")}
        </>}
        {kind === "medalha" && <>{number("wastePercent", "Perda técnica adicional (%)", "0.1")}{number("cutSpeedMmMin", "Velocidade de corte (mm/min)", "1", "O sistema calcula o tempo pelo perímetro total das medalhas.")}{["gravacao", "gravacao_adesivo"].includes(String(form.medalPersonalization)) && <>{number("engravingCoveragePercent", "Área média gravada (%)", "0.1")}{number("engravingSpeedM2Hour", "Velocidade de gravação (m²/h)", "0.01")}</>}{number("assemblyCostPerUnit", "Montagem e acabamento por unidade")}</>}
        {(((["banner", "faixa", "lona_backdrop", "adesivo_impresso", "adesivo_impresso_recorte"] as SpecialProjectKind[]).includes(kind) && !String(form.secondaryMaterialId)) || (kind === "envelopamento" && material(String(form.primaryMaterialId))?.category === "vinil") || (kind === "estrutura_lona" && material(String(form.secondaryMaterialId))?.category === "lona") || (kind === "placa_adesivada" && material(String(form.secondaryMaterialId))?.category === "vinil" && !String(form.tertiaryMaterialId))) && <label className="special-check"><input type="checkbox" checked={Boolean(form.varnishIncluded)} onChange={(event) => set("varnishIncluded", event.target.checked)}/><span><b>Aplicar verniz protetor</b><small>Acrescenta automaticamente R$ 10,00 por m² produzido.</small></span></label>}
        {!(["banner", "faixa", "lona_backdrop", "adesivo_impresso", "adesivo_impresso_recorte", "adesivo_cor", "gravacao_laser", "placa_adesivada", "placa_acm_letra_caixa"] as SpecialProjectKind[]).includes(kind) && <label>{kind === "placa_aplique" || kind === "letra_caixa" || kind === "neon_led" ? "Máquina de corte" : kind === "impressao_3d" ? "Impressora 3D" : "Máquina principal"}<select value={String(form.machineId)} onChange={(event) => set("machineId", event.target.value)}><option value="">{kind === "medalha" ? "Selecione a máquina laser..." : kind === "impressao_3d" ? "Selecione a impressora 3D..." : "Sem máquina / custo manual"}</option>{machines.filter((item) => kind === "medalha" ? item.machine_type === "laser" : kind === "impressao_3d" ? item.machine_type === "impressora_3d" : kind === "placa_aplique" || kind === "letra_caixa" || kind === "neon_led" ? ["router_cnc", "laser", "plotter", "acabamento"].includes(item.machine_type) : kind !== "envelopamento" || Boolean(form.printed) ? true : item.machine_type !== "grandes_formatos").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {!(["banner", "faixa", "lona_backdrop", "adesivo_impresso", "adesivo_impresso_recorte", "adesivo_cor", "gravacao_laser", "placa_adesivada", "placa_acm_letra_caixa", "impressao_3d"] as SpecialProjectKind[]).includes(kind) && String(form.machineId) && number("machineMinutes", kind === "medalha" ? "Substituir tempo automático (min)" : kind === "placa_aplique" ? "Tempo total de corte (min)" : "Tempo produtivo da máquina (min)", "0.1", kind === "medalha" ? "Deixe zero para calcular pelo corte e pela gravação." : kind === "placa_aplique" ? "Inclua placa principal e todos os apliques deste item." : "")}
        {number("extraCost", "Outros custos diretos")}
      </div>
    </section>

    <div className="special-footer">
      <div className={issues.length ? "special-validation" : "special-ready"}>{issues.length ? <><AlertTriangle/><div><b>{issues.length} pendência(s) para calcular</b><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div></> : <><CheckCircle2/><div><b>Configuração completa</b><small>Os dados já podem ser processados.</small></div></>}</div>
      <Button type="button" onClick={calculate}><Calculator/>Calcular projeto completo</Button>
    </div>
    {message && <div className="special-configurator-error"><AlertTriangle/><span>{message}</span></div>}
    {result && <div className="special-configurator-result"><CheckCircle2/><span><b>{result.materialUsage}</b><small>Custo {currency.format(result.totalCost)} · mínimo {currency.format(result.minimumSuggestedPrice)} · recomendado {currency.format(result.averageSuggestedPrice)} · premium {currency.format(result.maximumSuggestedPrice)}</small></span></div>}
  </div>;
}
