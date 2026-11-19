"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Calculator, CheckCircle2, Layers3, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { materialDisplayName, materialOptionLabel } from "@/lib/material-label";
import type { PricingCatalog } from "./pricing-panel";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const uid = () => Math.random().toString(36).slice(2, 10);
const round = (value: number, decimals = 4) => Number(value.toFixed(decimals));

export type FlexibleComponent = { key: string; label: string; materialId: string; widthMm: string; heightMm: string; quantityPerProduct: string };
type CostLine = { key: string; label: string; detail: string; amount: number };
type StockUsage = { materialId: string; materialName: string; quantity: number; unit: string; source: string };
type BaseCalculation = {
  netAreaM2: number; productionAreaM2: number; finishingAreaM2: number; purchasedAreaM2: number; wasteAreaM2: number; wastePercent: number; wasteCost: number; finishingCost: number;
  materialCostPerLinearMeter: number; materialCostPerM2: number; productionWidthMm: number; productionHeightMm: number; rotated: boolean; materialUsage: string;
  totalCost: number; unitCost: number; costBasedPrice: number; tablePrice: number | null; priceReason: string; suggestedPrice: number; suggestedUnitPrice: number;
  minimumSuggestedPrice: number; averageSuggestedPrice: number; maximumSuggestedPrice: number; desiredMarginPercent: number; taxPercent: number; commissionPercent: number;
  missingComponents: string[]; expectedGrossProfit: number; effectiveMarginPercent: number; costLines: CostLine[]; stockUsages: StockUsage[];
};
export type FlexibleCalculation = BaseCalculation & {
  flexibleComposition: true;
  compositionComponents: FlexibleComponent[];
  compositionMachineId: string;
  compositionMachineMinutes: number;
  compositionMachineTimeMode: "per_unit" | "total_job";
};

type Props = {
  catalog: PricingCatalog;
  quantity: string;
  laborMinutes: string;
  installationCost: string;
  desiredMarginPercent: string;
  invoiceIncluded: boolean;
  invoicePercent: string;
  commissionIncluded: boolean;
  commissionPercent: string;
  initial?: Partial<FlexibleCalculation> | null;
  showInitialResult?: boolean;
  onCalculated: (calculation: FlexibleCalculation, summary: { material: string; widthMm: string; heightMm: string; productionNotes: string }) => void;
};

async function calculatePart(body: Record<string, unknown>) {
  const response = await fetch("/api/gestao/precificacao/calcular", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Não foi possível calcular a composição.");
  return payload.calculation as BaseCalculation;
}

const blankComponent = (label = "Material principal"): FlexibleComponent => ({ key: uid(), label, materialId: "", widthMm: "", heightMm: "", quantityPerProduct: "1" });

export function FlexibleCompositionConfigurator({ catalog, quantity, laborMinutes, installationCost, desiredMarginPercent, invoiceIncluded, invoicePercent, commissionIncluded, commissionPercent, initial, showInitialResult = true, onCalculated }: Props) {
  const [components, setComponents] = useState<FlexibleComponent[]>(initial?.compositionComponents?.length ? initial.compositionComponents : [blankComponent()]);
  const [machineId, setMachineId] = useState(initial?.compositionMachineId ?? "");
  const [machineMinutes, setMachineMinutes] = useState(String(initial?.compositionMachineMinutes ?? ""));
  const [machineTimeMode, setMachineTimeMode] = useState<"per_unit" | "total_job">(initial?.compositionMachineTimeMode ?? "per_unit");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<FlexibleCalculation | null>(showInitialResult && initial?.flexibleComposition ? initial as FlexibleCalculation : null);
  const [busy, setBusy] = useState(false);
  const totalProducts = Math.max(1, Number(quantity || 0));
  const totalMachineMinutes = machineTimeMode === "per_unit" ? Number(machineMinutes || 0) * totalProducts : Number(machineMinutes || 0);
  const selectedNames = useMemo(() => components.map((component) => materialDisplayName(catalog.materials.find((material) => material.id === component.materialId))).filter(Boolean), [catalog.materials, components]);
  const orderedMaterials = useMemo(() => [...catalog.materials].sort((a, b) => a.category.localeCompare(b.category, "pt-BR") || a.name.localeCompare(b.name, "pt-BR") || Number(a.thickness_mm || 0) - Number(b.thickness_mm || 0) || Number(a.width_mm || 0) - Number(b.width_mm || 0)), [catalog.materials]);

  function change(key: string, field: keyof FlexibleComponent, value: string) {
    setComponents((current) => current.map((component) => component.key === key ? { ...component, [field]: value } : component));
    setResult(null);
  }

  async function calculate() {
    const incomplete = components.find((component) => !component.materialId || !Number(component.quantityPerProduct));
    if (incomplete) { setMessage("Selecione o material e informe a quantidade usada em cada componente."); return; }
    for (const component of components) {
      const material = catalog.materials.find((entry) => entry.id === component.materialId);
      if (!material) { setMessage("Um dos materiais selecionados não está mais disponível."); return; }
      if (["chapa", "rolo"].includes(material.format) && (!Number(component.widthMm) || !Number(component.heightMm))) { setMessage(`Informe largura e altura do componente “${component.label || material.name}”.`); return; }
    }
    setBusy(true); setMessage("");
    try {
      const calculations = await Promise.all(components.map((component, index) => {
        const material = catalog.materials.find((entry) => entry.id === component.materialId)!;
        const pieceCount = Math.max(1, Math.ceil(totalProducts * Number(component.quantityPerProduct || 1)));
        const consumption = totalProducts * Number(component.quantityPerProduct || 1);
        return calculatePart({
          model: material.format === "rolo" ? "rolo" : material.format === "chapa" ? "chapa" : "consumo",
          materialId: material.id,
          machineId: index === 0 ? machineId : "",
          productId: "",
          widthMm: component.widthMm || 0,
          heightMm: component.heightMm || 0,
          quantity: material.format === "chapa" || material.format === "rolo" ? pieceCount : Math.max(1, Math.round(totalProducts)),
          consumptionQuantity: material.format === "chapa" || material.format === "rolo" ? 0 : consumption,
          machineMinutes: index === 0 ? totalMachineMinutes : 0,
          laborMinutes: index === 0 ? Number(laborMinutes || 0) : 0,
          extraCost: index === 0 ? Number(installationCost || 0) : 0,
          invoiceIncluded: false,
          commissionIncluded: false,
          desiredMarginPercent: 0,
          includeMaterialCost: true,
          allowRotation: true,
        });
      }));
      const totalCost = calculations.reduce((sum, calculation) => sum + calculation.totalCost, 0);
      const tax = invoiceIncluded ? Number(invoicePercent || catalog.settings?.tax_percent || 0) : 0;
      const commission = commissionIncluded ? Number(commissionPercent || catalog.settings?.commission_percent || 0) : 0;
      const margin = Number(desiredMarginPercent || catalog.settings?.target_margin_percent || 0);
      const maxMargin = Math.max(margin, Number(catalog.settings?.maximum_margin_percent ?? 45));
      if (tax + commission + maxMargin >= 95) throw new Error("Nota, comissão e margem somadas precisam ser menores que 95%.");
      const minimumOrder = Number(catalog.settings?.minimum_order_value ?? 0);
      const increment = Math.max(Number(catalog.settings?.rounding_increment ?? 0.01), 0.01);
      const price = (appliedMargin: number) => totalCost / Math.max(1 - (tax + commission + appliedMargin) / 100, 0.05);
      const rounded = (value: number) => Math.ceil(Math.max(value, minimumOrder) / increment) * increment;
      const minimum = rounded(price(0)), average = rounded(price(margin)), maximum = rounded(price(maxMargin));
      const profit = average * (1 - (tax + commission) / 100) - totalCost;
      const stockMap = new Map<string, StockUsage>();
      calculations.flatMap((calculation) => calculation.stockUsages).forEach((usage) => { const current = stockMap.get(usage.materialId); stockMap.set(usage.materialId, { ...usage, quantity: (current?.quantity ?? 0) + Number(usage.quantity) }); });
      const first = calculations[0];
      const calculation: FlexibleCalculation = {
        ...first,
        flexibleComposition: true,
        compositionComponents: components,
        compositionMachineId: machineId,
        compositionMachineMinutes: Number(machineMinutes || 0),
        compositionMachineTimeMode: machineTimeMode,
        materialUsage: selectedNames.join(" + "),
        totalCost: round(totalCost, 2), unitCost: round(totalCost / totalProducts), costBasedPrice: round(price(margin), 2), tablePrice: null,
        priceReason: "Composição rápida: materiais escolhidos no orçamento + processos + margem",
        suggestedPrice: round(average, 2), suggestedUnitPrice: round(average / totalProducts), minimumSuggestedPrice: round(minimum, 2), averageSuggestedPrice: round(average, 2), maximumSuggestedPrice: round(maximum, 2),
        desiredMarginPercent: margin, taxPercent: tax, commissionPercent: commission, expectedGrossProfit: round(profit, 2), effectiveMarginPercent: average ? round(profit / average * 100, 2) : 0,
        netAreaM2: first.netAreaM2, productionAreaM2: first.productionAreaM2, finishingAreaM2: calculations.reduce((sum, item) => sum + item.finishingAreaM2, 0), purchasedAreaM2: calculations.reduce((sum, item) => sum + item.purchasedAreaM2, 0), wasteAreaM2: calculations.reduce((sum, item) => sum + item.wasteAreaM2, 0),
        wastePercent: calculations.reduce((sum, item) => sum + item.purchasedAreaM2, 0) ? round(calculations.reduce((sum, item) => sum + item.wasteAreaM2, 0) / calculations.reduce((sum, item) => sum + item.purchasedAreaM2, 0) * 100, 2) : 0,
        wasteCost: round(calculations.reduce((sum, item) => sum + item.wasteCost, 0), 2), finishingCost: round(calculations.reduce((sum, item) => sum + item.finishingCost, 0), 2), materialCostPerLinearMeter: 0, materialCostPerM2: 0,
        costLines: calculations.flatMap((calculation, calculationIndex) => calculation.costLines.map((line) => ({ ...line, key: `composition-${calculationIndex}-${line.key}` }))),
        stockUsages: [...stockMap.values()].map((usage) => ({ ...usage, quantity: round(usage.quantity, 6) })),
        missingComponents: [...new Set(calculations.flatMap((calculation) => calculation.missingComponents))],
      };
      setResult(calculation);
      const firstComponent = components[0];
      onCalculated(calculation, { material: selectedNames.join(" + "), widthMm: firstComponent.widthMm, heightMm: firstComponent.heightMm, productionNotes: `Composição rápida: ${components.map((component) => `${component.label || "Componente"}: ${materialDisplayName(catalog.materials.find((material) => material.id === component.materialId))}`).join("; ")}.` });
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  return <div className="flexible-composer">
    <header><span><Layers3/></span><div><small>COMPOSIÇÃO RÁPIDA</small><b>Monte este trabalho sem cadastrar um produto novo</b><p>Combine chapa, aplique, adesivo, fita ou outro insumo já cadastrado. Cada componente pode ter medida e consumo próprios.</p></div></header>
    <div className="flexible-component-list">{components.map((component, index) => { const material = catalog.materials.find((entry) => entry.id === component.materialId); const dimensional = material && ["chapa", "rolo"].includes(material.format); return <article key={component.key}><div className="flexible-component-number">{index + 1}</div><div className="flexible-component-fields"><label>Nome do componente<Input value={component.label} onChange={(event) => change(component.key, "label", event.target.value)} placeholder={index ? "Ex.: Aplique espelhado" : "Ex.: Base da placa"}/></label><label className="wide">Material<select value={component.materialId} onChange={(event) => change(component.key, "materialId", event.target.value)}><option value="">Selecione um insumo...</option>{orderedMaterials.map((entry) => <option key={entry.id} value={entry.id}>{materialOptionLabel(entry)}</option>)}</select>{material && <small className="flexible-selected-material">Selecionado: {materialOptionLabel(material)}</small>}</label>{dimensional && <><label>Largura da peça (mm)<Input type="number" min="0.1" step="0.1" value={component.widthMm} onChange={(event) => change(component.key, "widthMm", event.target.value)}/></label><label>Altura da peça (mm)<Input type="number" min="0.1" step="0.1" value={component.heightMm} onChange={(event) => change(component.key, "heightMm", event.target.value)}/></label></>}<label>Uso por produto<Input type="number" min="0.001" step="0.001" value={component.quantityPerProduct} onChange={(event) => change(component.key, "quantityPerProduct", event.target.value)}/><small>{dimensional ? "Peças deste componente em cada produto" : "Unidades, metros, litros ou kg por produto"}</small></label></div>{components.length > 1 && <Button type="button" size="icon" variant="ghost" aria-label={`Remover componente ${index + 1}`} onClick={() => { setComponents((current) => current.filter((entry) => entry.key !== component.key)); setResult(null); }}><Trash2/></Button>}</article>; })}</div>
    <Button type="button" variant="outline" className="flexible-add" onClick={() => { setComponents((current) => [...current, blankComponent(`Componente ${current.length + 1}`)]); setResult(null); }}><Plus/>Adicionar outro material ou componente</Button>
    <section className="flexible-process"><div><small>PROCESSO OPCIONAL</small><b>Máquina usada neste trabalho</b></div><label>Máquina<select value={machineId} onChange={(event) => { setMachineId(event.target.value); setResult(null); }}><option value="">Sem máquina / somente montagem</option>{catalog.machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</select></label>{machineId && <><label>Tempo<Input type="number" min="0" step="0.1" value={machineMinutes} onChange={(event) => { setMachineMinutes(event.target.value); setResult(null); }}/></label><label>Forma do tempo<select value={machineTimeMode} onChange={(event) => { setMachineTimeMode(event.target.value as "per_unit" | "total_job"); setResult(null); }}><option value="per_unit">Minutos por produto</option><option value="total_job">Minutos do lote inteiro</option></select></label><p>Tempo total calculado: <b>{round(totalMachineMinutes, 2)} minutos</b>.</p></>}</section>
    <footer><div>{message ? <><AlertTriangle/><span>{message}</span></> : result ? <><CheckCircle2/><span>Custo completo {currency.format(result.totalCost)} · recomendado {currency.format(result.averageSuggestedPrice)}</span></> : <><Calculator/><span>Adicione os materiais e calcule a composição completa.</span></>}</div><Button type="button" onClick={calculate} disabled={busy}><Calculator/>{busy ? "Calculando composição..." : result ? "Recalcular composição" : "Calcular composição"}</Button></footer>
  </div>;
}
