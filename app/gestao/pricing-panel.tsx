"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, Calculator, Check, Copy, Cpu, Gauge, Layers3, Pencil, Plus, Save, Settings2, SlidersHorizontal, Sparkles, Trash2, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuidedProjectsModal } from "./guided-projects-modal";
import { guidedProjectOptions } from "@/lib/guided-projects";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Não foi possível concluir a operação.");
  return payload;
}

type Material = {
  id: string; sku?: string | null; name: string; category: string; format: string; supplier?: string | null;
  vinyl_type?: "imprimivel" | "cor" | "ambos" | "laminacao" | "mascara" | null;
  package_cost: number; purchase_quantity: number; width_mm?: number | null; usable_width_mm?: number | null;
  height_mm?: number | null; length_m?: number | null; thickness_mm?: number | null; default_waste_percent: number;
  notes?: string | null; inventory?: { current_quantity: number; minimum_quantity: number; unit: string } | null;
};
type Consumable = { id?: string; name: string; material_id?: string | null; calculation_basis: "hora" | "m2" | "mes"; replacement_cost: number; useful_life_hours?: number | null; useful_life_months?: number | null; consumption_per_m2?: number | null; pricing_materials?: Material | null };
type Machine = {
  id: string; name: string; machine_type: string; purchase_cost: number; residual_value: number; useful_life_months: number;
  productive_hours_month: number; maintenance_monthly: number; power_kw: number; setup_minutes: number;
  speed_m2_hour?: number | null; minimum_minutes: number; cost_center_id?: string | null; notes?: string | null; pricing_machine_consumables: Consumable[];
};
type Product = {
  id: string; code: string; name: string; category: string;
  pricing_method: "cost_margin" | "table" | "higher_of";
  profit_calculation_mode?: "margin" | "markup";
  rate_basis: "m2" | "linear_meter" | "unit" | "fixed";
  sale_rate: number; minimum_price: number; rounding_increment: number;
  default_labor_minutes: number; default_material_id?: string | null; default_machine_id?: string | null; notes?: string | null;
  pricing_product_components?: ProductComponent[];
};
type ProductComponent = { id?: string; name: string; material_id?: string | null; calculation_basis: "net_m2" | "width_m" | "height_m" | "unit" | "fixed"; quantity_factor: number; extra_quantity: number; waste_percent: number; optional: boolean };
type FixedCost = { id: string; name: string; monthly_amount: number; cost_center_id?: string | null; notes?: string | null };
export type CostCenter = { id: string; name: string; code: string; productive_hours_month: number; is_default: boolean; notes?: string | null; active: boolean };
type Supplier = { id: string; legal_name: string; trade_name?: string | null; document?: string | null; active: boolean };
type Settings = {
  electricity_price_kwh: number; labor_cost_hour: number; overhead_hour: number; tax_percent: number;
  commission_percent: number; contingency_percent: number; target_margin_percent: number;
  maximum_margin_percent: number; productive_hours_month: number; minimum_order_value: number; rounding_increment: number;
  disabled_guided_projects?: string[] | null;
};
export type PricingCatalog = { products: Product[]; materials: Material[]; machines: Machine[]; fixedCosts: FixedCost[]; fixedCostsMonthly: number; costCenters: CostCenter[]; costCentersSetupRequired?: boolean; suppliers: Supplier[]; settings: Settings | null; configured: boolean };
type Calculation = {
  netAreaM2: number; purchasedAreaM2: number; wasteAreaM2: number; wastePercent: number; materialUsage: string;
  costLines: Array<{ key: string; label: string; detail: string; amount: number }>;
  totalCost: number; unitCost: number; costBasedPrice: number; tablePrice: number | null; pricingMethod: string;
  priceReason: string; suggestedPrice: number; suggestedUnitPrice: number; expectedGrossProfit: number; effectiveMarginPercent: number;
  minimumSuggestedPrice: number; averageSuggestedPrice: number; maximumSuggestedPrice: number; desiredMarginPercent: number; missingComponents: string[];
  profitCalculationMode?: "margin" | "markup";
};

const categoryLabels: Record<string, string> = { lona: "Lona", vinil: "Vinil / adesivo", mascara: "Máscara de transferência", papel: "Papel", tecido: "Tecido", chapa: "Chapa rígida", tinta: "Tinta", filamento: "Filamento 3D", acabamento: "Acabamento", fixacao: "Fixação", estrutura: "Estrutura", metal: "Metal / perfil", solda: "Solda", acrilico: "Acrílico", led: "LED", eletrica: "Elétrica / fontes", embalagem: "Embalagem", consumivel: "Consumível", terceirizado: "Terceirizado", outro: "Outro" };
const machineLabels: Record<string, string> = { grandes_formatos: "Impressora de grandes formatos", router_cnc: "Router CNC", laser: "Laser", impressora_3d: "Impressora 3D", plotter: "Plotter", laminadora: "Laminadora", acabamento: "Equipamento de acabamento", outro: "Outro" };
const formatLabels: Record<string, string> = { rolo: "Rolo", chapa: "Chapa", barra: "Barra / perfil", unidade: "Unidade", litro: "Litro", kg: "Quilograma", metro: "Metro linear", servico: "Serviço" };
const vinylTypeLabels: Record<string, string> = { imprimivel: "Adesivo branco imprimível", cor: "Adesivo pronto na cor", ambos: "Pode imprimir e usar como cor", laminacao: "Laminação / transparente", mascara: "Máscara de transferência" };
const methodLabels: Record<string, string> = { table: "Tabela comercial", higher_of: "Maior entre tabela e custo", cost_margin: "Custo + margem" };
const basisLabels: Record<string, string> = { m2: "m²", linear_meter: "metro linear", unit: "unidade", fixed: "serviço" };
const emptySettings: Settings = { electricity_price_kwh: 0, labor_cost_hour: 0, overhead_hour: 0, productive_hours_month: 160, tax_percent: 0, commission_percent: 0, contingency_percent: 0, target_margin_percent: 30, maximum_margin_percent: 45, minimum_order_value: 0, rounding_increment: 0.01 };
type ConsumableDraft = { id?: string; name: string; materialId: string; calculationBasis: "hora" | "m2" | "mes"; replacementCost: string; usefulLifeHours: string; usefulLifeMonths: string; consumptionPerM2: string };
const processProfiles: Record<string, ConsumableDraft[]> = {
  grandes_formatos: [
    { name: "Tinta preta (K)", materialId: "", calculationBasis: "m2", replacementCost: "0", usefulLifeHours: "", usefulLifeMonths: "", consumptionPerM2: "3" },
    { name: "Tinta ciano (C)", materialId: "", calculationBasis: "m2", replacementCost: "0", usefulLifeHours: "", usefulLifeMonths: "", consumptionPerM2: "3" },
    { name: "Tinta magenta (M)", materialId: "", calculationBasis: "m2", replacementCost: "0", usefulLifeHours: "", usefulLifeMonths: "", consumptionPerM2: "3" },
    { name: "Tinta amarela (Y)", materialId: "", calculationBasis: "m2", replacementCost: "0", usefulLifeHours: "", usefulLifeMonths: "", consumptionPerM2: "3" },
    { name: "Cabeça XP600", materialId: "", calculationBasis: "mes", replacementCost: "0", usefulLifeHours: "", usefulLifeMonths: "12", consumptionPerM2: "" },
  ],
  router_cnc: [{ name: "Fresa", materialId: "", calculationBasis: "hora", replacementCost: "0", usefulLifeHours: "", usefulLifeMonths: "", consumptionPerM2: "" }],
  laser: [
    { name: "Tubo laser", materialId: "", calculationBasis: "hora", replacementCost: "0", usefulLifeHours: "", usefulLifeMonths: "", consumptionPerM2: "" },
    { name: "Lente / espelho", materialId: "", calculationBasis: "hora", replacementCost: "0", usefulLifeHours: "", usefulLifeMonths: "", consumptionPerM2: "" },
  ],
  impressora_3d: [
    { name: "Bico de impressão", materialId: "", calculationBasis: "hora", replacementCost: "0", usefulLifeHours: "", usefulLifeMonths: "", consumptionPerM2: "" },
    { name: "Manutenção do hotend", materialId: "", calculationBasis: "hora", replacementCost: "0", usefulLifeHours: "", usefulLifeMonths: "", consumptionPerM2: "" },
  ],
};

function Feedback({ message }: { message: string }) {
  if (!message) return null;
  const success = message.startsWith("OK:");
  return <div className={`module-feedback ${success ? "success" : ""}`}>{success ? <Check/> : <X/>}{message.replace(/^OK:/, "")}</div>;
}

function MaterialForm({ material, initial, suppliers, onClose, onSaved }: { material?: Material; initial?: Material; suppliers: Supplier[]; onClose: () => void; onSaved: () => void }) {
  const source = material ?? initial;
  const duplicating = Boolean(initial && !material);
  const [format, setFormat] = useState(source?.format ?? "rolo");
  const [category, setCategory] = useState(source?.category === "vinil" && source?.vinyl_type === "mascara" ? "mascara" : source?.category ?? "lona");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(form.entries());
    try {
      await api("/api/gestao/precificacao", { method: material ? "PATCH" : "POST", body: JSON.stringify({ entity: "material", ...(material ? { id: material.id } : {}), data }) });
      onSaved();
    } catch (error) { setMessage((error as Error).message); setSaving(false); }
  }
  return <div className="workspace-modal material-editor-modal" role="dialog" aria-modal="true" aria-label={material ? `Editar ${material.name}` : duplicating ? "Duplicar insumo" : "Novo insumo"} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="workspace-dialog material-editor-dialog"><form className="module-form costing-form" onSubmit={submit}>
    <div className="form-title"><div><b>{material ? "Editar insumo" : duplicating ? "Duplicar insumo" : "Novo insumo"}</b><small>{duplicating ? `Cópia de “${source?.name}”. Revise nome, cor, medidas, SKU, preço e saldo antes de salvar.` : "Cadastre exatamente como o fornecedor vende: rolo, chapa, litro, quilo ou unidade."}</small></div><Button type="button" variant="ghost" size="icon" onClick={onClose}><X/></Button></div>
    <div className="form-grid">
      <label>Nome comercial<Input name="name" required defaultValue={duplicating ? `${source?.name ?? ""} - cópia` : source?.name ?? ""} placeholder="Ex.: Lona frontlight 440 g"/></label>
      <label>SKU / referência<Input name="sku" defaultValue={duplicating ? "" : source?.sku ?? ""}/><small>{duplicating ? "Deixado em branco para não repetir o SKU original." : "Código único do fornecedor ou do estoque."}</small></label>
      <label>Categoria<select name="category" value={category} onChange={(event) => setCategory(event.target.value)}>{Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>Formato de compra<select name="format" value={format} onChange={(event) => setFormat(event.target.value)}>{Object.entries(formatLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      {category === "vinil" ? <label>Finalidade do vinil<select name="vinylType" defaultValue={source?.vinyl_type ?? "imprimivel"}>{Object.entries(vinylTypeLabels).filter(([value]) => value !== "mascara").map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><small>Controla em quais listas este material aparece no orçamento.</small></label> : <input type="hidden" name="vinylType" value={category === "mascara" ? "mascara" : ""}/>}
      <label>Fornecedor<select name="supplier" defaultValue={source?.supplier ?? ""}><option value="">Sem fornecedor vinculado</option>{source?.supplier && !suppliers.some((supplier) => (supplier.trade_name || supplier.legal_name) === source.supplier) && <option value={source.supplier}>{source.supplier} · cadastro anterior</option>}{suppliers.map((supplier) => { const name = supplier.trade_name || supplier.legal_name; return <option value={name} key={supplier.id}>{name}{supplier.trade_name ? ` · ${supplier.legal_name}` : ""}{supplier.document ? ` · ${supplier.document}` : ""}</option>; })}</select><small>{suppliers.length ? "Lista sincronizada com Financeiro → Fornecedores." : "Cadastre primeiro o fornecedor na área Financeiro → Fornecedores."}</small></label>
      <label>Valor da embalagem / peça<Input name="packageCost" type="number" min="0" step="0.0001" required defaultValue={source?.package_cost ?? 0}/></label>
      {format === "rolo" ? <>
        <label>Comprimento total do rolo (m)<Input name="lengthM" type="number" min="0.001" step="0.001" required defaultValue={source?.length_m ?? ""}/></label>
        <label>Largura nominal (mm)<Input name="widthMm" type="number" min="1" step="0.1" required defaultValue={source?.width_mm ?? ""}/></label>
        <label>Largura útil (mm)<Input name="usableWidthMm" type="number" min="1" step="0.1" defaultValue={source?.usable_width_mm ?? source?.width_mm ?? ""}/></label>
        <input type="hidden" name="purchaseQuantity" value="1"/><input type="hidden" name="heightMm" value=""/>
      </> : format === "chapa" ? <>
        <label>Largura da chapa (mm)<Input name="widthMm" type="number" min="1" step="0.1" required defaultValue={source?.width_mm ?? ""}/></label>
        <label>Altura da chapa (mm)<Input name="heightMm" type="number" min="1" step="0.1" required defaultValue={source?.height_mm ?? ""}/></label>
        <label>Chapas por pacote<Input name="purchaseQuantity" type="number" min="0.001" step="0.001" required defaultValue={source?.purchase_quantity ?? 1}/></label>
        <input type="hidden" name="lengthM" value=""/><input type="hidden" name="usableWidthMm" value=""/>
      </> : format === "barra" ? <>
        <label>Comprimento de cada barra (m)<Input name="lengthM" type="number" min="0.001" step="0.001" required defaultValue={source?.length_m ?? 6}/></label>
        <label>Largura do perfil (mm)<Input name="widthMm" type="number" min="1" step="0.1" required defaultValue={source?.width_mm ?? ""}/></label>
        <label>Altura do perfil (mm)<Input name="heightMm" type="number" min="1" step="0.1" required defaultValue={source?.height_mm ?? ""}/></label>
        <label>Barras por pacote / compra<Input name="purchaseQuantity" type="number" min="1" step="1" required defaultValue={source?.purchase_quantity ?? 1}/></label>
        <input type="hidden" name="usableWidthMm" value=""/>
      </> : format === "metro" ? <>
        <label>Metros comprados<Input name="purchaseQuantity" type="number" min="0.0001" step="0.0001" required defaultValue={source?.purchase_quantity ?? 1}/><small>Use 1 quando o valor informado já for o preço de um metro.</small></label>
        <label>Largura nominal (mm)<Input name="widthMm" type="number" min="0.1" step="0.1" defaultValue={source?.width_mm ?? ""}/><small>Obrigatória para adesivo, máscara e laminação.</small></label>
        <label>Largura útil (mm)<Input name="usableWidthMm" type="number" min="0.1" step="0.1" defaultValue={source?.usable_width_mm ?? source?.width_mm ?? ""}/></label>
        <input type="hidden" name="heightMm" value=""/><input type="hidden" name="lengthM" value=""/>
      </> : <>
        <label>Quantidade comprada<Input name="purchaseQuantity" type="number" min="0.0001" step="0.0001" required defaultValue={source?.purchase_quantity ?? 1}/></label>
        <input type="hidden" name="widthMm" value=""/><input type="hidden" name="heightMm" value=""/><input type="hidden" name="lengthM" value=""/><input type="hidden" name="usableWidthMm" value=""/>
      </>}
      <label>Espessura (mm)<Input name="thicknessMm" type="number" min="0.001" step="0.001" defaultValue={source?.thickness_mm ?? ""}/></label>
      <label>Perda técnica adicional (%)<Input name="defaultWastePercent" type="number" min="0" max="100" step="0.01" defaultValue={source?.default_waste_percent ?? 0}/></label>
      <label>Saldo disponível no estoque<Input name="currentQuantity" type="number" min="0" step="0.001" defaultValue={duplicating ? 0 : source?.inventory?.current_quantity ?? 0}/><small>{duplicating ? "A cópia começa zerada para não duplicar o estoque." : format === "rolo" || format === "metro" ? "Em metros lineares" : format === "barra" ? "Em barras" : format === "litro" ? "Em litros" : format === "kg" ? "Em quilogramas" : "Em unidades"}</small></label>
      <label>Alerta de estoque mínimo<Input name="minimumQuantity" type="number" min="0" step="0.001" defaultValue={source?.inventory?.minimum_quantity ?? 0}/></label>
      <label className="span-2 textarea-label">Observações<textarea name="notes" rows={2} defaultValue={source?.notes ?? ""} placeholder="Marca, acabamento, condições de compra, lote mínimo..."/></label>
    </div>
    <div className="costing-explainer"><AlertTriangle/><span>Este cadastro alimenta preço e estoque ao mesmo tempo. Rolos usam metros lineares. Em chapas, o orçamento apropria a área usada e a perda técnica; a sobra grande permanece como retalho reutilizável, sem ser cobrada integralmente do primeiro cliente.</span></div>
    <Feedback message={message}/><div className="form-actions"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}><Save/>{saving ? "Salvando..." : "Salvar insumo"}</Button></div>
  </form></div></div>;
}

function MachineForm({ machine, materials, costCenters, onClose, onSaved }: { machine?: Machine; materials: Material[]; costCenters: CostCenter[]; onClose: () => void; onSaved: () => void }) {
  const [machineType, setMachineType] = useState(machine?.machine_type ?? "grandes_formatos");
  const [consumables, setConsumables] = useState<ConsumableDraft[]>(() => (machine?.pricing_machine_consumables ?? []).map((item) => ({ id: item.id, name: item.name, materialId: item.material_id ?? "", calculationBasis: item.calculation_basis, replacementCost: String(item.replacement_cost ?? 0), usefulLifeHours: String(item.useful_life_hours ?? ""), usefulLifeMonths: String(item.useful_life_months ?? ""), consumptionPerM2: String(item.consumption_per_m2 ?? "") })));
  const [inkLiterPrice, setInkLiterPrice] = useState("");
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  function updateConsumable(index: number, key: string, value: string) { setConsumables((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)); }
  function loadProcessProfile() {
    const templates = processProfiles[machineType] ?? [];
    setConsumables((current) => {
      const base = machineType === "grandes_formatos" ? current.filter((item) => item.name.trim().toLocaleLowerCase("pt-BR") !== "tinta") : current;
      return [...base, ...templates.filter((template) => !base.some((item) => item.name.toLocaleLowerCase("pt-BR") === template.name.toLocaleLowerCase("pt-BR")))];
    });
    setMessage(templates.length ? "OK:Componentes recomendados adicionados. Agora informe custos, vida útil e vínculos pendentes." : "Não há um perfil automático para este tipo de equipamento.");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); const form = new FormData(event.currentTarget);
    const data = { ...Object.fromEntries(form.entries()), consumables };
    try { await api("/api/gestao/precificacao", { method: machine ? "PATCH" : "POST", body: JSON.stringify({ entity: "machine", ...(machine ? { id: machine.id } : {}), data }) }); onSaved(); }
    catch (error) { setMessage((error as Error).message); setSaving(false); }
  }
  return <form className="module-form costing-form" onSubmit={submit}>
    <div className="form-title"><div><b>{machine ? "Editar máquina" : "Nova máquina"}</b><small>O custo-hora combina depreciação, manutenção, energia e componentes de desgaste.</small></div><Button type="button" variant="ghost" size="icon" onClick={onClose}><X/></Button></div>
    <div className="form-grid">
      <label>Nome do equipamento<Input name="name" required defaultValue={machine?.name ?? ""} placeholder="Ex.: Impressora eco-solvente"/></label>
      <label>Tipo<select name="machineType" value={machineType} onChange={(event) => setMachineType(event.target.value)}>{Object.entries(machineLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>Centro de custo<select name="costCenterId" defaultValue={machine?.cost_center_id ?? ""}><option value="">Rateio geral / não vinculado</option>{costCenters.map((center) => <option key={center.id} value={center.id}>{center.name}{center.is_default ? " · padrão" : ""}</option>)}</select><small>Define qual taxa operacional acompanha o tempo desta máquina.</small></label>
      <label>Valor de compra<Input name="purchaseCost" type="number" min="0" step="0.01" required defaultValue={machine?.purchase_cost ?? 0}/></label>
      <label>Valor residual<Input name="residualValue" type="number" min="0" step="0.01" defaultValue={machine?.residual_value ?? 0}/></label>
      <label>Vida útil (meses)<Input name="usefulLifeMonths" type="number" min="1" step="1" defaultValue={machine?.useful_life_months ?? 60}/></label>
      <label>Horas produtivas / mês<Input name="productiveHoursMonth" type="number" min="1" step="0.1" defaultValue={machine?.productive_hours_month ?? 120}/></label>
      <label>Manutenção mensal<Input name="maintenanceMonthly" type="number" min="0" step="0.01" defaultValue={machine?.maintenance_monthly ?? 0}/></label>
      <label>Potência média (kW)<Input name="powerKw" type="number" min="0" step="0.001" defaultValue={machine?.power_kw ?? 0}/></label>
      <label>Preparação por trabalho (min)<Input name="setupMinutes" type="number" min="0" step="0.1" defaultValue={machine?.setup_minutes ?? 0}/></label>
      <label>Velocidade produtiva (m²/h)<Input name="speedM2Hour" type="number" min="0.001" step="0.001" defaultValue={machine?.speed_m2_hour ?? ""}/></label>
      <label>Tempo mínimo cobrado (min)<Input name="minimumMinutes" type="number" min="0" step="0.1" defaultValue={machine?.minimum_minutes ?? 0}/></label>
      <label className="span-2 textarea-label">Observações<textarea name="notes" rows={2} defaultValue={machine?.notes ?? ""}/></label>
    </div>
    <div className="form-section-title"><Zap/><div><b>Perfil automático do processo</b><small>Estes custos serão carregados em todos os produtos vinculados à máquina, sem repetir cadastros.</small></div><Button type="button" variant="outline" onClick={loadProcessProfile}><Sparkles/>Carregar itens recomendados</Button></div>
    {machineType === "grandes_formatos" && consumables.some((item) => item.name.toLocaleLowerCase("pt-BR").startsWith("tinta")) && <div className="form-grid"><label>Preço de 1 litro de cada cor<Input type="number" min="0.01" step="0.01" value={inkLiterPrice} onChange={(event) => setInkLiterPrice(event.target.value)} placeholder="Ex.: 180,00"/><small>Use quando K, C, M e Y tiverem o mesmo preço.</small></label><div className="form-actions"><Button type="button" variant="outline" disabled={!Number(inkLiterPrice)} onClick={() => setConsumables((current) => current.map((item) => item.name.toLocaleLowerCase("pt-BR").startsWith("tinta") ? { ...item, materialId: "", replacementCost: inkLiterPrice } : item))}>Aplicar preço às 4 tintas</Button></div></div>}
    <div className="consumable-list">{consumables.map((item, index) => <article key={index}>
      <div className="consumable-heading"><b>Componente {index + 1}</b><Button type="button" variant="ghost" size="icon" onClick={() => setConsumables((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2/></Button></div>
      <div className="form-grid"><label>Nome<Input value={item.name} onChange={(event) => updateConsumable(index, "name", event.target.value)} required placeholder="Tinta, cabeça, tubo, fresa..."/></label><label>Forma de consumo<select value={item.calculationBasis} onChange={(event) => updateConsumable(index, "calculationBasis", event.target.value)}><option value="hora">Vida útil em horas</option><option value="mes">Vida útil em meses</option><option value="m2">Consumo por m²</option></select></label>
      {item.calculationBasis === "hora" ? <><label>Custo de reposição<Input type="number" min="0.01" step="0.0001" value={item.replacementCost} onChange={(event) => updateConsumable(index, "replacementCost", event.target.value)} required/></label><label>Vida útil (horas)<Input type="number" min="0.001" step="0.001" value={item.usefulLifeHours} onChange={(event) => updateConsumable(index, "usefulLifeHours", event.target.value)} required/></label></> : item.calculationBasis === "mes" ? <><label>Custo de reposição<Input type="number" min="0.01" step="0.01" value={item.replacementCost} onChange={(event) => updateConsumable(index, "replacementCost", event.target.value)} required/></label><label>Vida útil (meses)<Input type="number" min="0.1" step="0.1" value={item.usefulLifeMonths} onChange={(event) => updateConsumable(index, "usefulLifeMonths", event.target.value)} required placeholder="12"/></label></> : <><label>Como informar o preço<select value={item.materialId} onChange={(event) => updateConsumable(index, "materialId", event.target.value)}><option value="">Digitar o preço abaixo</option>{materials.map((material) => <option value={material.id} key={material.id}>{material.name}</option>)}</select></label><label>{(materials.find((material) => material.id === item.materialId)?.format === "litro" || item.name.toLocaleLowerCase("pt-BR").includes("tinta")) ? "Consumo (ml por m²)" : "Consumo por m²"}<Input type="number" min="0.000001" step="0.000001" value={item.consumptionPerM2} onChange={(event) => updateConsumable(index, "consumptionPerM2", event.target.value)} required/></label>{!item.materialId && <label>Preço por litro / unidade consumida<Input type="number" min="0.01" step="0.0001" value={item.replacementCost} onChange={(event) => updateConsumable(index, "replacementCost", event.target.value)} required/></label>}{(materials.find((material) => material.id === item.materialId)?.format === "litro" || item.name.toLocaleLowerCase("pt-BR").includes("tinta")) && <small className="span-2">Informe mililitros, não litros. Ex.: 3 significa 3 ml/m² para esta cor; quatro cores com 3 ml somam 12 ml/m².</small>}{!item.materialId && !Number(item.replacementCost) && <small className="span-2 recipe-inline-warning">Este componente está cadastrado, mas ainda não tem preço. Ele não pode gerar custo até que o valor seja informado.</small>}</>}
      </div></article>)}</div>
    <Button type="button" variant="outline" onClick={() => setConsumables((current) => [...current, { name: "", materialId: "", calculationBasis: "hora", replacementCost: "0", usefulLifeHours: "", usefulLifeMonths: "", consumptionPerM2: "" }])}><Plus/>Adicionar consumível</Button>
    <Feedback message={message}/><div className="form-actions"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}><Save/>{saving ? "Salvando..." : "Salvar máquina"}</Button></div>
  </form>;
}

function ProductForm({ product, materials, machines, onClose, onSaved }: { product?: Product; materials: Material[]; machines: Machine[]; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const [components, setComponents] = useState(() => (product?.pricing_product_components ?? []).map((item) => ({ id: item.id, name: item.name, materialId: item.material_id ?? "", calculationBasis: item.calculation_basis, quantityFactor: String(item.quantity_factor), extraQuantity: String(item.extra_quantity), wastePercent: String(item.waste_percent), optional: item.optional })));
  function updateComponent(index: number, key: string, value: string | boolean) { setComponents((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const data = { ...Object.fromEntries(new FormData(event.currentTarget).entries()), components };
    try {
      await api("/api/gestao/precificacao", { method: product ? "PATCH" : "POST", body: JSON.stringify({ entity: "product", ...(product ? { id: product.id } : {}), data }) });
      onSaved();
    } catch (error) { setMessage((error as Error).message); setSaving(false); }
  }
  return <form className="module-form costing-form" onSubmit={submit}>
    <div className="form-title"><div><b>{product ? "Editar produto" : "Novo produto / serviço"}</b><small>A tabela comercial define como a empresa vende. O custo técnico continua sendo calculado para proteger a margem.</small></div><Button type="button" variant="ghost" size="icon" onClick={onClose}><X/></Button></div>
    <div className="form-grid">
      <label>Nome do produto<Input name="name" required defaultValue={product?.name ?? ""} placeholder="Ex.: Banner impresso"/></label>
      <label>Código interno<Input name="code" required defaultValue={product?.code ?? ""} placeholder="Ex.: banner"/></label>
      <label>Categoria<Input name="category" required defaultValue={product?.category ?? "comunicacao_visual"} placeholder="Ex.: impressão digital"/></label>
      <label>Insumo principal<select name="defaultMaterialId" defaultValue={product?.default_material_id ?? ""} required><option value="">Selecione o material usado</option>{materials.map((material) => <option value={material.id} key={material.id}>{material.name}</option>)}</select></label>
      <label>Máquina padrão<select name="defaultMachineId" defaultValue={product?.default_machine_id ?? ""}><option value="">Produto sem máquina</option>{machines.map((machine) => <option value={machine.id} key={machine.id}>{machine.name}</option>)}</select></label>
      <label>Método de preço<select name="pricingMethod" defaultValue={product?.pricing_method ?? "higher_of"}>{Object.entries(methodLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>Como interpretar o percentual<select name="profitCalculationMode" defaultValue={product?.profit_calculation_mode ?? "margin"}><option value="margin">Margem real sobre a venda</option><option value="markup">Acréscimo sobre o custo (markup)</option></select><small>Use markup para faixas e produtos vendidos por acréscimo. Os demais permanecem com margem real.</small></label>
      <label>Base da tabela<select name="rateBasis" defaultValue={product?.rate_basis ?? "m2"}>{Object.entries(basisLabels).map(([value, label]) => <option value={value} key={value}>Por {label}</option>)}</select></label>
      <label>Valor da tabela<Input name="saleRate" type="number" min="0" step="0.01" required defaultValue={product?.sale_rate ?? 0}/></label>
      <label>Preço mínimo do produto<Input name="minimumPrice" type="number" min="0" step="0.01" defaultValue={product?.minimum_price ?? 0}/></label>
      <label>Arredondar para múltiplos de<Input name="roundingIncrement" type="number" min="0.01" step="0.01" defaultValue={product?.rounding_increment ?? 5}/></label>
      <label>Tempo padrão de mão de obra (min)<Input name="defaultLaborMinutes" type="number" min="0" step="0.1" defaultValue={product?.default_labor_minutes ?? 0}/></label>
      <label className="span-2 textarea-label">Observações<textarea name="notes" rows={2} defaultValue={product?.notes ?? ""} placeholder="Acabamentos inclusos, regra comercial, exceções..."/></label>
    </div>
    <div className="form-section-title"><Layers3/><div><b>Ficha técnica automática</b><small>Vincule tinta, madeirinha, cordinha, ponteiras e outros materiais. O sistema aplicará estas fórmulas em cada orçamento.</small></div></div>
    <div className="consumable-list">{components.map((item, index) => <article key={index}><div className="consumable-heading"><b>Componente {index + 1}</b><Button type="button" variant="ghost" size="icon" onClick={() => setComponents((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2/></Button></div><div className="form-grid">
      <label>Nome<Input value={item.name} onChange={(event) => updateComponent(index, "name", event.target.value)} required/></label>
      <label>Insumo vinculado<select value={item.materialId} onChange={(event) => updateComponent(index, "materialId", event.target.value)}><option value="">Pendente de vinculação</option>{materials.map((material) => <option value={material.id} key={material.id}>{material.name} · {formatLabels[material.format]}</option>)}</select></label>
      <label>Fórmula<select value={item.calculationBasis} onChange={(event) => updateComponent(index, "calculationBasis", event.target.value)}><option value="net_m2">Área líquida (m²)</option><option value="width_m">Largura (m)</option><option value="height_m">Altura (m)</option><option value="unit">Por peça</option><option value="fixed">Quantidade fixa</option></select></label>
      <label>Multiplicador<Input type="number" min="0" step="0.000001" value={item.quantityFactor} onChange={(event) => updateComponent(index, "quantityFactor", event.target.value)}/></label>
      <label>Sobra adicional<Input type="number" min="0" step="0.001" value={item.extraQuantity} onChange={(event) => updateComponent(index, "extraQuantity", event.target.value)}/></label>
      <label>Perda adicional (%)<Input type="number" min="0" max="100" step="0.01" value={item.wastePercent} onChange={(event) => updateComponent(index, "wastePercent", event.target.value)}/></label>
      <label className="checkbox-label"><input type="checkbox" checked={item.optional} onChange={(event) => updateComponent(index, "optional", event.target.checked)}/> Componente opcional</label>
    </div></article>)}</div>
    <Button type="button" variant="outline" onClick={() => setComponents((current) => [...current, { id: undefined, name: "", materialId: "", calculationBasis: "unit" as const, quantityFactor: "1", extraQuantity: "0", wastePercent: "0", optional: false }])}><Plus/>Adicionar componente</Button>
    <div className="costing-explainer"><Gauge/><span>Use “Tabela comercial” quando houver um preço de mercado definido. Use “Maior entre tabela e custo” para nunca vender abaixo do valor necessário para preservar a margem.</span></div>
    <Feedback message={message}/><div className="form-actions"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}><Save/>{saving ? "Salvando..." : "Salvar produto"}</Button></div>
  </form>;
}

function FixedCostForm({ cost, costCenters, onClose, onSaved }: { cost?: FixedCost; costCenters: CostCenter[]; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const data = Object.fromEntries(new FormData(event.currentTarget).entries()); try { await api("/api/gestao/precificacao", { method: cost ? "PATCH" : "POST", body: JSON.stringify({ entity: "fixedCost", ...(cost ? { id: cost.id } : {}), data }) }); onSaved(); } catch (error) { setMessage((error as Error).message); setSaving(false); } }
  return <form className="module-form costing-form" onSubmit={submit}><div className="form-title"><div><b>{cost ? "Editar custo fixo" : "Novo custo fixo mensal"}</b><small>Custos sem centro são gerais; custos vinculados entram somente na taxa daquela operação.</small></div><Button type="button" variant="ghost" size="icon" onClick={onClose}><X/></Button></div><div className="form-grid"><label>Descrição<Input name="name" required defaultValue={cost?.name ?? ""} placeholder="Ex.: Aluguel"/></label><label>Valor mensal<Input name="monthlyAmount" type="number" min="0" step="0.01" required defaultValue={cost?.monthly_amount ?? 0}/></label><label>Centro de custo<select name="costCenterId" defaultValue={cost?.cost_center_id ?? ""}><option value="">Geral — distribuir entre todos</option>{costCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></label><label className="span-2 textarea-label">Observações<textarea name="notes" rows={2} defaultValue={cost?.notes ?? ""}/></label></div><Feedback message={message}/><div className="form-actions"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}><Save/>{saving ? "Salvando..." : "Salvar custo"}</Button></div></form>;
}

function CostCenterForm({ center, onClose, onSaved }: { center?: CostCenter; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setMessage(""); const form = new FormData(event.currentTarget); const data = { ...Object.fromEntries(form.entries()), isDefault: form.get("isDefault") === "on" }; try { await api("/api/gestao/precificacao", { method: center ? "PATCH" : "POST", body: JSON.stringify({ entity: "costCenter", ...(center ? { id: center.id } : {}), data }) }); onSaved(); } catch (error) { setMessage((error as Error).message); setSaving(false); } }
  return <form className="module-form costing-form" onSubmit={submit}><div className="form-title"><div><b>{center ? "Editar centro de custo" : "Novo centro de custo"}</b><small>Use a média real de horas vendidas no mês, não o total de horas disponíveis.</small></div><Button type="button" variant="ghost" size="icon" onClick={onClose}><X/></Button></div><div className="form-grid"><label>Nome<Input name="name" required defaultValue={center?.name ?? ""} placeholder="Ex.: Laser"/></label><label>Código<Input name="code" required defaultValue={center?.code ?? ""} placeholder="laser" pattern="[a-z0-9_-]+"/></label><label>Horas produtivas / mês<Input name="productiveHoursMonth" type="number" min="1" step="0.1" required defaultValue={center?.productive_hours_month ?? 30}/></label><label className="checkbox-label"><input name="isDefault" type="checkbox" defaultChecked={center?.is_default}/> Centro padrão para trabalhos sem máquina</label><label className="span-2 textarea-label">Observações<textarea name="notes" rows={2} defaultValue={center?.notes ?? ""} placeholder="Área, processos e custos que pertencem a este centro"/></label></div><Feedback message={message}/><div className="form-actions"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}><Save/>{saving ? "Salvando..." : "Salvar centro"}</Button></div></form>;
}

function SettingsForm({ settings, onSaved }: { settings: Settings | null; onSaved: () => void }) {
  const values = settings ?? emptySettings; const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setMessage(""); const form = new FormData(event.currentTarget); try { await api("/api/gestao/precificacao", { method: "POST", body: JSON.stringify({ entity: "settings", data: Object.fromEntries(form.entries()) }) }); setMessage("OK:Regras comerciais atualizadas."); onSaved(); } catch (error) { setMessage((error as Error).message); } finally { setSaving(false); } }
  return <form className="module-form costing-form settings-form" onSubmit={submit}>
    <div className="form-title"><div><b>Regras gerais de formação de preço</b><small>Esses percentuais entram no preço sugerido, mas ficam separados do custo técnico.</small></div></div>
    <div className="form-grid">
      <label>Energia elétrica (R$/kWh)<Input name="electricityPriceKwh" type="number" min="0" step="0.0001" defaultValue={values.electricity_price_kwh}/></label>
      <label>Mão de obra produtiva (R$/h)<Input name="laborCostHour" type="number" min="0" step="0.01" defaultValue={values.labor_cost_hour}/></label>
      <label>Rateio operacional (R$/h)<Input name="overheadHour" type="number" min="0" step="0.01" defaultValue={values.overhead_hour}/></label>
      <label>Horas produtivas da empresa / mês<Input name="productiveHoursMonth" type="number" min="1" max="744" step="0.1" defaultValue={values.productive_hours_month}/></label>
      <label>Impostos sobre venda (%)<Input name="taxPercent" type="number" min="0" max="100" step="0.001" defaultValue={values.tax_percent}/></label>
      <label>Comissão comercial (%)<Input name="commissionPercent" type="number" min="0" max="100" step="0.001" defaultValue={values.commission_percent}/></label>
      <label>Reserva técnica (%)<Input name="contingencyPercent" type="number" min="0" max="100" step="0.001" defaultValue={values.contingency_percent}/></label>
      <label>Margem líquida-alvo (%)<Input name="targetMarginPercent" type="number" min="0" max="90" step="0.001" defaultValue={values.target_margin_percent}/></label>
      <label>Margem máxima sugerida (%)<Input name="maximumMarginPercent" type="number" min="0" max="90" step="0.001" defaultValue={values.maximum_margin_percent}/></label>
      <label>Pedido mínimo<Input name="minimumOrderValue" type="number" min="0" step="0.01" defaultValue={values.minimum_order_value}/></label>
      <label>Arredondar preço para múltiplos de<Input name="roundingIncrement" type="number" min="0.01" step="0.01" defaultValue={values.rounding_increment}/></label>
    </div>
    <div className="costing-explainer"><Gauge/><span>A regra geral continua usando margem real sobre a venda. Cada produto pode ser configurado individualmente para usar acréscimo sobre o custo, sem alterar os demais.</span></div>
    <Feedback message={message}/><div className="form-actions"><Button type="submit" disabled={saving}><Save/>{saving ? "Salvando..." : "Salvar regras"}</Button></div>
  </form>;
}

function Simulator({ catalog }: { catalog: PricingCatalog }) {
  const [materialId, setMaterialId] = useState(catalog.materials[0]?.id ?? ""); const material = catalog.materials.find((item) => item.id === materialId);
  const [productId, setProductId] = useState(catalog.products[0]?.id ?? "");
  const selectedProduct = catalog.products.find((item) => item.id === productId);
  const [model, setModel] = useState<"rolo" | "chapa" | "consumo">((material?.format as "rolo" | "chapa") ?? "consumo");
  const [machineId, setMachineId] = useState(""); const [calculation, setCalculation] = useState<Calculation | null>(null); const [message, setMessage] = useState(""); const [calculating, setCalculating] = useState(false);
  function chooseMaterial(id: string) { const next = catalog.materials.find((item) => item.id === id); setMaterialId(id); setModel(next?.format === "rolo" ? "rolo" : next?.format === "chapa" ? "chapa" : "consumo"); setCalculation(null); }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setCalculating(true); setMessage(""); const form = new FormData(event.currentTarget); try { const result = await api<{ calculation: Calculation }>("/api/gestao/precificacao/calcular", { method: "POST", body: JSON.stringify({ ...Object.fromEntries(form.entries()), allowRotation: form.get("allowRotation") === "on", invoiceIncluded: form.get("invoiceIncluded") === "on", commissionIncluded: form.get("commissionIncluded") === "on", varnishIncluded: form.get("varnishIncluded") === "on" }) }); setCalculation(result.calculation); } catch (error) { setMessage((error as Error).message); setCalculation(null); } finally { setCalculating(false); } }
  if (!catalog.materials.length) return <div className="empty-state pricing-empty"><Layers3/><b>Cadastre o primeiro insumo</b><p>O simulador será liberado assim que houver pelo menos um material com custo de compra.</p></div>;
  return <div className="pricing-simulator"><form className="module-form costing-form" onSubmit={submit}>
    <div className="form-title"><div><b>Simulador técnico</b><small>Teste o aproveitamento e valide o preço antes de usar no orçamento.</small></div></div>
    <div className="form-grid">
      <label className="span-2">Produto / ficha técnica<select name="productId" value={productId} onChange={(event) => { setProductId(event.target.value); setCalculation(null); }}><option value="">Sem ficha técnica</option>{catalog.products.map((item) => <option value={item.id} key={item.id}>{item.name}{item.sale_rate > 0 ? ` · ${currency.format(item.sale_rate)}/${basisLabels[item.rate_basis]}` : " · custo completo"}</option>)}</select></label>
      <label className="span-2">Insumo<select name="materialId" value={materialId} onChange={(event) => chooseMaterial(event.target.value)}>{catalog.materials.map((item) => <option value={item.id} key={item.id}>{item.name} · {formatLabels[item.format]}</option>)}</select></label>
      <label>Modelo de aproveitamento<select name="model" value={model} onChange={(event) => setModel(event.target.value as typeof model)}><option value="rolo">Rolo / metro linear</option><option value="chapa">Chapa / nesting</option><option value="consumo">Quantidade direta</option></select></label>
      <label>Máquina<select name="machineId" value={machineId} onChange={(event) => setMachineId(event.target.value)}><option value="">Sem máquina</option>{catalog.machines.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label>Largura da peça (mm)<Input name="widthMm" type="number" min="0" step="0.1" defaultValue="1200" required/></label>
      <label>Altura da peça (mm)<Input name="heightMm" type="number" min="0" step="0.1" defaultValue="800" required/></label>
      <label>Quantidade de peças<Input name="quantity" type="number" min="1" step="1" defaultValue="1" required/></label>
      {model === "consumo" && <label>Quantidade consumida<Input name="consumptionQuantity" type="number" min="0" step="0.0001" defaultValue="1"/></label>}
      <label>Mão de obra (min)<Input name="laborMinutes" type="number" min="0" step="0.1" defaultValue="0"/></label>
      <label>Acabamentos / terceiros<Input name="extraCost" type="number" min="0" step="0.01" defaultValue="0"/></label>
      <label>{selectedProduct?.profit_calculation_mode === "markup" ? "Acréscimo sobre o custo (%)" : "Margem desejada (%)"}<Input name="desiredMarginPercent" type="number" min="0" max="90" step="0.1" defaultValue={catalog.settings?.target_margin_percent ?? 30}/></label>
      <label className="checkbox-label"><input name="invoiceIncluded" type="checkbox"/> Emitir nota fiscal</label>
      <label className="checkbox-label"><input name="commissionIncluded" type="checkbox"/> Incluir comissão</label>
      <label className="checkbox-label"><input name="allowRotation" type="checkbox" defaultChecked/> Permitir girar a peça para melhor aproveitamento</label>
      {material && ["lona", "vinil"].includes(material.category) && <label className="checkbox-label"><input name="varnishIncluded" type="checkbox"/> Aplicar verniz protetor (+ R$ 10,00/m²)</label>}
      <input type="hidden" name="varnishRateM2" value="10"/>
    </div><Feedback message={message}/><Button type="submit" disabled={calculating}><Calculator/>{calculating ? "Calculando..." : "Calcular custo e preço"}</Button>
  </form>{calculation && <CalculationResult calculation={calculation}/>}</div>;
}

export function CalculationResult({ calculation }: { calculation: Calculation }) {
  return <aside className="calculation-result"><div className="calculation-result-head"><div><small>PREÇO SUGERIDO</small><strong>{currency.format(calculation.suggestedPrice)}</strong><span>{currency.format(calculation.suggestedUnitPrice)} por peça</span></div><div className="waste-indicator"><b>{decimal.format(calculation.wastePercent)}%</b><span>perda total</span></div></div>
    <div className="price-range"><span><small>MÍNIMO</small><b>{currency.format(calculation.minimumSuggestedPrice)}</b><em>cobre custos</em></span><span className="recommended"><small>MÉDIO</small><b>{currency.format(calculation.averageSuggestedPrice)}</b><em>{decimal.format(calculation.desiredMarginPercent)}% {calculation.profitCalculationMode === "markup" ? "sobre o custo" : "de margem"}</em></span><span><small>MÁXIMO</small><b>{currency.format(calculation.maximumSuggestedPrice)}</b><em>faixa premium</em></span></div>
    <div className="price-comparison"><span><small>{calculation.profitCalculationMode === "markup" ? "Custo + acréscimo" : "Custo + margem"}</small><b>{currency.format(calculation.costBasedPrice)}</b></span>{calculation.tablePrice !== null && <span><small>Tabela antes do arredondamento</small><b>{currency.format(calculation.tablePrice)}</b></span>}</div><p className="price-reason">{calculation.priceReason}</p>
    {calculation.missingComponents.length > 0 && <div className="recipe-warning"><AlertTriangle/><span><b>Ficha técnica incompleta</b>Vincule os insumos: {calculation.missingComponents.join(", ")}.</span></div>}
    <div className="yield-strip"><span>Área líquida <b>{decimal.format(calculation.netAreaM2)} m²</b></span><span>Material apropriado <b>{decimal.format(calculation.purchasedAreaM2)} m²</b></span><span>Perda técnica <b>{decimal.format(calculation.wasteAreaM2)} m²</b></span></div>
    <p className="usage-detail">{calculation.materialUsage}</p><div className="cost-breakdown">{calculation.costLines.map((line) => <div key={line.key}><span><b>{line.label}</b><small>{line.detail}</small></span><strong>{currency.format(line.amount)}</strong></div>)}</div>
    <div className="calculation-totals"><div><span>Custo total</span><b>{currency.format(calculation.totalCost)}</b></div><div><span>Lucro líquido previsto</span><b>{currency.format(calculation.expectedGrossProfit)}</b></div><div><span>Margem efetiva</span><b>{decimal.format(calculation.effectiveMarginPercent)}%</b></div></div>
  </aside>;
}

export function PricingPanel({ createProductRequest = 0 }: { createProductRequest?: number }) {
  const [catalog, setCatalog] = useState<PricingCatalog>({ products: [], materials: [], machines: [], fixedCosts: [], fixedCostsMonthly: 0, costCenters: [], suppliers: [], settings: null, configured: false });
  const [tab, setTab] = useState<"simulador" | "produtos" | "insumos" | "maquinas" | "centros" | "fixos" | "regras">(createProductRequest > 0 ? "produtos" : "simulador");
  const [productForm, setProductForm] = useState<Product | "new" | null>(createProductRequest > 0 ? "new" : null); const [materialForm, setMaterialForm] = useState<Material | "new" | null>(null); const [materialCopy, setMaterialCopy] = useState<Material | null>(null); const [machineForm, setMachineForm] = useState<Machine | "new" | null>(null);
  const [fixedCostForm, setFixedCostForm] = useState<FixedCost | "new" | null>(null);
  const [costCenterForm, setCostCenterForm] = useState<CostCenter | "new" | null>(null);
  const [guidedModalOpen, setGuidedModalOpen] = useState(false);
  const [message, setMessage] = useState(""); const [loading, setLoading] = useState(true);
  const load = useCallback(() => api<PricingCatalog>("/api/gestao/precificacao").then(setCatalog).finally(() => setLoading(false)), []);
  useEffect(() => { load().catch((error: Error) => setMessage(error.message)); }, [load]);
  useEffect(() => {
    if (!materialForm) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMaterialForm(null);
      setMaterialCopy(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [materialForm]);
  const setup = useMemo(() => ({ materials: catalog.materials.length > 0, machines: catalog.machines.length > 0, settings: catalog.configured }), [catalog]);
  async function saved(kind: string) { setProductForm(null); setMaterialForm(null); setMaterialCopy(null); setMachineForm(null); setFixedCostForm(null); setCostCenterForm(null); await load(); setMessage(`OK:${kind} salvo com sucesso.`); }
  async function remove(entity: "material" | "machine" | "product" | "fixedCost" | "costCenter", id: string, name: string) {
    if (!window.confirm(`Excluir “${name}”? O histórico já registrado será preservado.`)) return;
    try { await api("/api/gestao/precificacao", { method: "DELETE", body: JSON.stringify({ entity, id }) }); await load(); setMessage(`OK:${name} foi removido dos cadastros ativos.`); }
    catch (error) { setMessage((error as Error).message); }
  }
  return <>
    <header className="module-heading pricing-heading"><div><p>ENGENHARIA DE CUSTOS</p><h1>Central de precificação</h1><span>Insumos, máquinas, perdas e regras comerciais conectados ao orçamento.</span></div><div className="pricing-health"><span className={setup.materials ? "done" : ""}>{setup.materials ? <Check/> : <Boxes/>} Insumos</span><span className={setup.machines ? "done" : ""}>{setup.machines ? <Check/> : <Cpu/>} Máquinas</span><span className={setup.settings ? "done" : ""}>{setup.settings ? <Check/> : <Settings2/>} Regras</span></div></header>
    <Feedback message={message}/><nav className="pricing-tabs">{([['simulador','Simulador'],['produtos','Fichas técnicas'],['insumos','Insumos e estoque'],['maquinas','Máquinas'],['centros','Centros de custo'],['fixos','Custos fixos'],['regras','Regras de preço']] as const).map(([value,label]) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{label}</button>)}</nav>
    {loading ? <div className="empty-state"><Calculator/><b>Carregando custos...</b></div> : tab === "simulador" ? <Simulator catalog={catalog}/> : tab === "produtos" ? <>
      <div className="submodule-heading"><div><h2>Produtos e tabelas comerciais</h2><p>Defina como cada produto é vendido sem misturar o preço de mercado com o custo de produção.</p></div><div className="submodule-heading-actions"><Button type="button" variant="outline" onClick={() => setGuidedModalOpen(true)}><SlidersHorizontal/>Projetos guiados ({guidedProjectOptions.length - (catalog.settings?.disabled_guided_projects?.length ?? 0)}/{guidedProjectOptions.length})</Button><Button onClick={() => setProductForm("new")}><Plus/>Novo produto</Button></div></div>
      {productForm && <ProductForm product={productForm === "new" ? undefined : productForm} materials={catalog.materials} machines={catalog.machines} onClose={() => setProductForm(null)} onSaved={() => saved("Produto")}/>}<div className="cost-card-grid">{catalog.products.map((product) => <article className="cost-card product-card" key={product.id}><header><span>{methodLabels[product.pricing_method]}</span><div className="row-actions"><Button variant="ghost" size="icon" aria-label={`Editar ${product.name}`} onClick={() => setProductForm(product)}><Pencil/></Button><Button variant="ghost" size="icon" aria-label={`Excluir ${product.name}`} onClick={() => remove("product", product.id, product.name)}><Trash2/></Button></div></header><h3>{product.name}</h3><p>{product.code} · {product.category}</p><div><strong>{product.pricing_product_components?.length ?? 0}</strong><small>componentes na ficha técnica</small></div><footer><span>{!product.default_material_id ? "Insumo principal pendente" : `${(product.pricing_product_components ?? []).filter((item) => !item.material_id).length} componente(s) pendente(s)`}</span><span>Arredonda de {currency.format(product.rounding_increment)}</span></footer></article>)}</div>{!catalog.products.length && <div className="empty-state"><Gauge/><b>Nenhuma ficha técnica cadastrada</b><p>Cadastre Banner 280 g, Banner 440 g, adesivos, placas e outros produtos como variações independentes, cada uma com seus próprios materiais.</p></div>}
    </> : tab === "insumos" ? <>
      <div className="submodule-heading"><div><h2>Insumos e estoque</h2><p>Um único cadastro define custo, formato de compra, largura e saldo disponível.</p></div><Button onClick={() => { setMaterialCopy(null); setMaterialForm("new"); }}><Plus/>Novo insumo</Button></div>
      {materialForm && <MaterialForm key={materialForm === "new" ? materialCopy?.id ?? "new" : materialForm.id} material={materialForm === "new" ? undefined : materialForm} initial={materialForm === "new" ? materialCopy ?? undefined : undefined} suppliers={catalog.suppliers} onClose={() => { setMaterialForm(null); setMaterialCopy(null); }} onSaved={() => saved(materialCopy ? "Insumo duplicado" : "Insumo")}/>}<div className="cost-card-grid">{catalog.materials.map((material) => { const base = material.format === "rolo" ? Number(material.package_cost) / Math.max(Number(material.length_m), .0001) : Number(material.package_cost) / Math.max(Number(material.purchase_quantity), .0001); return <article className="cost-card" key={material.id}><header><span>{categoryLabels[material.category] ?? material.category}</span><div className="row-actions"><Button variant="ghost" size="icon" aria-label={`Duplicar ${material.name}`} title="Duplicar insumo" onClick={() => { setMaterialCopy(material); setMaterialForm("new"); }}><Copy/></Button><Button variant="ghost" size="icon" aria-label={`Editar ${material.name}`} title="Editar insumo" onClick={() => { setMaterialCopy(null); setMaterialForm(material); }}><Pencil/></Button><Button variant="ghost" size="icon" aria-label={`Excluir ${material.name}`} title="Excluir insumo" onClick={() => remove("material", material.id, material.name)}><Trash2/></Button></div></header><h3>{material.name}</h3><p>{material.supplier || "Fornecedor não informado"}</p><div><strong>{currency.format(base)}</strong><small>por {material.format === "rolo" ? "metro linear" : formatLabels[material.format]?.toLowerCase()}</small></div><footer><span>Estoque: {decimal.format(material.inventory?.current_quantity ?? 0)} {material.inventory?.unit ?? "—"}</span>{material.width_mm && <span>{material.width_mm} mm{material.height_mm ? ` × ${material.height_mm} mm` : ""}</span>}{material.category === "vinil" && material.vinyl_type && <span>{vinylTypeLabels[material.vinyl_type]}</span>}<span>{material.default_waste_percent}% perda técnica</span></footer></article>; })}</div>{!catalog.materials.length && <div className="empty-state"><Layers3/><b>Nenhum insumo cadastrado</b><p>Comece pelas lonas, vinis, chapas, tintas, tubos, fresas e filamentos usados com maior frequência.</p></div>}
    </> : tab === "maquinas" ? <>
      <div className="submodule-heading"><div><h2>Parque de máquinas</h2><p>Depreciação, manutenção, energia, preparação, velocidade e desgaste.</p></div><Button onClick={() => setMachineForm("new")}><Plus/>Nova máquina</Button></div>
      {machineForm && <MachineForm machine={machineForm === "new" ? undefined : machineForm} materials={catalog.materials} costCenters={catalog.costCenters} onClose={() => setMachineForm(null)} onSaved={() => saved("Máquina")}/>}<div className="cost-card-grid">{catalog.machines.map((machine) => { const productiveHours = Math.max(Number(machine.productive_hours_month), 1); const depreciation = Math.max(Number(machine.purchase_cost) - Number(machine.residual_value), 0) / Math.max(Number(machine.useful_life_months) * productiveHours, 1); const maintenance = Number(machine.maintenance_monthly) / productiveHours; const energy = Number(machine.power_kw) * Number(catalog.settings?.electricity_price_kwh ?? 0); const wear = (machine.pricing_machine_consumables ?? []).reduce((sum, item) => item.calculation_basis === "hora" ? sum + Number(item.replacement_cost) / Math.max(Number(item.useful_life_hours), .0001) : item.calculation_basis === "mes" ? sum + Number(item.replacement_cost) / Math.max(Number(item.useful_life_months) * productiveHours, .0001) : sum, 0); const center = catalog.costCenters.find((item) => item.id === machine.cost_center_id); return <article className="cost-card machine-card" key={machine.id}><header><span>{machineLabels[machine.machine_type] ?? machine.machine_type}</span><div className="row-actions"><Button variant="ghost" size="icon" aria-label={`Editar ${machine.name}`} onClick={() => setMachineForm(machine)}><Pencil/></Button><Button variant="ghost" size="icon" aria-label={`Excluir ${machine.name}`} onClick={() => remove("machine", machine.id, machine.name)}><Trash2/></Button></div></header><h3>{machine.name}</h3><p>{center ? `Centro: ${center.name}` : machine.speed_m2_hour ? `${machine.speed_m2_hour} m²/h` : "Sem centro de custo"}</p><div><strong>{currency.format(depreciation + maintenance + energy + wear)}</strong><small>custo-hora da máquina</small></div><footer><span>{machine.setup_minutes} min preparação</span><span>{machine.pricing_machine_consumables?.length ?? 0} consumível(is)</span></footer></article>; })}</div>{!catalog.machines.length && <div className="empty-state"><Cpu/><b>Nenhuma máquina cadastrada</b><p>Cadastre impressora, router, laser e impressoras 3D para calcular o custo real de produção.</p></div>}
    </> : tab === "centros" ? <>
      <div className="submodule-heading"><div><h2>Centros de custo</h2><p>Camada opcional e reversível. Se nenhuma máquina estiver vinculada, o sistema mantém o rateio global atual.</p></div><Button onClick={() => setCostCenterForm("new")}><Plus/>Novo centro</Button></div>
      {catalog.costCentersSetupRequired && <div className="recipe-warning"><AlertTriangle/><span><b>Ativação pendente</b>Aplique a migração <code>202611110001_cost_centers.sql</code> no Supabase antes de cadastrar centros.</span></div>}
      {costCenterForm && <CostCenterForm center={costCenterForm === "new" ? undefined : costCenterForm} onClose={() => setCostCenterForm(null)} onSaved={() => saved("Centro de custo")}/>}<div className="cost-card-grid">{catalog.costCenters.map((center) => { const totalHours = catalog.costCenters.reduce((sum, item) => sum + Number(item.productive_hours_month), 0); const general = catalog.fixedCosts.filter((cost) => !cost.cost_center_id).reduce((sum, cost) => sum + Number(cost.monthly_amount), 0); const specific = catalog.fixedCosts.filter((cost) => cost.cost_center_id === center.id).reduce((sum, cost) => sum + Number(cost.monthly_amount), 0); const generalRate = general / Math.max(totalHours, 1); const specificRate = specific / Math.max(Number(center.productive_hours_month), 1); const rate = Number(catalog.settings?.overhead_hour ?? 0) + generalRate + specificRate; const machines = catalog.machines.filter((machine) => machine.cost_center_id === center.id).length; return <article className="cost-card" key={center.id}><header><span>{center.is_default ? "CENTRO PADRÃO" : "CENTRO PRODUTIVO"}</span><div className="row-actions"><Button variant="ghost" size="icon" aria-label={`Editar ${center.name}`} onClick={() => setCostCenterForm(center)}><Pencil/></Button><Button variant="ghost" size="icon" aria-label={`Desativar ${center.name}`} onClick={() => remove("costCenter", center.id, center.name)}><Trash2/></Button></div></header><h3>{center.name}</h3><p>{decimal.format(center.productive_hours_month)} h produtivas · {machines} máquina(s)</p><div><strong>{currency.format(rate)}/h</strong><small>{currency.format(generalRate)} geral + {currency.format(specificRate)} específico{Number(catalog.settings?.overhead_hour ?? 0) ? ` + ${currency.format(Number(catalog.settings?.overhead_hour))} manual` : ""}</small></div><footer><span>{currency.format(specific)} em custos próprios</span><span>código {center.code}</span></footer></article>; })}</div>{!catalog.costCenters.length && !catalog.costCentersSetupRequired && <div className="empty-state"><Gauge/><b>Rateio global preservado</b><p>Crie centros somente quando quiser comparar taxas por impressão, router, laser e acabamento. Até lá nada muda nos cálculos.</p></div>}
    </> : tab === "fixos" ? <>
      <div className="submodule-heading"><div><h2>Custos fixos mensais</h2><p>Total de {currency.format(catalog.fixedCostsMonthly)} rateado em {decimal.format(catalog.settings?.productive_hours_month ?? 160)} horas produtivas: <b>{currency.format(catalog.fixedCostsMonthly / Math.max(Number(catalog.settings?.productive_hours_month ?? 160), 1))}/h</b>.</p></div><Button onClick={() => setFixedCostForm("new")}><Plus/>Novo custo</Button></div>
      {fixedCostForm && <FixedCostForm cost={fixedCostForm === "new" ? undefined : fixedCostForm} costCenters={catalog.costCenters} onClose={() => setFixedCostForm(null)} onSaved={() => saved("Custo fixo")}/>}<div className="cost-card-grid">{catalog.fixedCosts.map((cost) => { const center = catalog.costCenters.find((item) => item.id === cost.cost_center_id); return <article className="cost-card" key={cost.id}><header><span>{center ? center.name.toLocaleUpperCase("pt-BR") : "CUSTO GERAL"}</span><div className="row-actions"><Button variant="ghost" size="icon" aria-label={`Editar ${cost.name}`} onClick={() => setFixedCostForm(cost)}><Pencil/></Button><Button variant="ghost" size="icon" aria-label={`Excluir ${cost.name}`} onClick={() => remove("fixedCost", cost.id, cost.name)}><Trash2/></Button></div></header><h3>{cost.name}</h3><p>{cost.notes || (center ? `Exclusivo de ${center.name}` : "Distribuído entre todos os centros")}</p><div><strong>{currency.format(cost.monthly_amount)}</strong><small>por mês</small></div></article>; })}</div>{!catalog.fixedCosts.length && <div className="empty-state"><Gauge/><b>Nenhum custo fixo cadastrado</b><p>Cadastre aluguel, água, internet, contador, sistemas e demais despesas mensais.</p></div>}
    </> : <SettingsForm key={catalog.settings?.target_margin_percent ?? "empty"} settings={catalog.settings} onSaved={load}/>}
    {guidedModalOpen && <GuidedProjectsModal disabledKinds={catalog.settings?.disabled_guided_projects ?? []} onClose={() => setGuidedModalOpen(false)} onSaved={(nextDisabled) => { if (catalog.settings) { setCatalog((current) => ({ ...current, settings: current.settings ? { ...current.settings, disabled_guided_projects: nextDisabled } : null })); } else { void load(); } setMessage(`OK:Lista de projetos guiados atualizada (${guidedProjectOptions.length - nextDisabled.length} de ${guidedProjectOptions.length} visíveis no orçamento).`); }}/>}
  </>;
}
