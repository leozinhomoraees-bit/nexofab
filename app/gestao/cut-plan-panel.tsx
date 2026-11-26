"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Helper } from "dxf";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCode2,
  FileUp,
  Gauge,
  Layers3,
  Plus,
  RefreshCw,
  Ruler,
  Scissors,
  Settings2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  contoursToParts,
  exportCutPlanDxf,
  exportCutPlanSvg,
  scaleCutParts,
  transformContour,
  type CutPart,
  type CutPlacement,
  type CutPlan,
} from "@/lib/cut-plan";
import type { CutPlanQuotePrefill } from "@/lib/cut-plan-quote";
import { QuickRectNesting } from "./quick-rect-nesting";

type Material = { id: string; name: string; category: string; format: string; package_cost: number; purchase_quantity: number; width_mm?: number | null; height_mm?: number | null; thickness_mm?: number | null; inventory?: { current_quantity: number; unit: string } | null };
type Machine = { id: string; name: string; machine_type: string; purchase_cost: number; residual_value: number; useful_life_months: number; productive_hours_month: number; maintenance_monthly: number; power_kw: number; setup_minutes: number; minimum_minutes: number; pricing_machine_consumables?: Array<{ calculation_basis: string; replacement_cost: number; useful_life_hours?: number | null; useful_life_months?: number | null }> };
type Catalog = { materials: Material[]; machines: Machine[]; settings?: { electricity_price_kwh: number; overhead_hour: number; target_margin_percent?: number } | null };

type ScaleUnit = "mm" | "cm" | "in";
const SCALE_OPTIONS: Array<{ id: ScaleUnit; label: string; factor: number; hint: string }> = [
  { id: "mm", label: "Milímetros (1:1)", factor: 1, hint: "Padrão CAD / Corel" },
  { id: "cm", label: "Centímetros (×10)", factor: 10, hint: "Quando exportou em cm" },
  { id: "in", label: "Polegadas (×25,4)", factor: 25.4, hint: "Padrão imperial / DXF EUA" },
];

const OFFCUT_PRESETS = [
  { label: "600 × 400", w: "600", h: "400" },
  { label: "1000 × 600", w: "1000", h: "600" },
  { label: "1200 × 800", w: "1200", h: "800" },
  { label: "1500 × 1000", w: "1500", h: "1000" },
];

const number = (value: string | number | null | undefined) => Number(value || 0);
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function isBetterPlan(candidate: CutPlan, current: CutPlan) {
  return candidate.sheets < current.sheets || (candidate.sheets === current.sheets && candidate.layoutScore < current.layoutScore - 0.01);
}

function closed(points: Array<[number, number]>) {
  if (points.length < 3) return points;
  const [first, last] = [points[0], points.at(-1)!];
  return Math.hypot(first[0] - last[0], first[1] - last[1]) <= 0.05 ? points : [...points, first];
}

function svgPolylines(text: string) {
  const documentNode = new DOMParser().parseFromString(text, "image/svg+xml");
  if (documentNode.querySelector("parsererror")) throw new Error("O SVG não pôde ser lido.");
  const polylines: Array<{ vertices: Array<[number, number]>; layer?: string }> = [];
  const parsePoints = (value: string) =>
    (value.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [])
      .map(Number)
      .reduce<Array<[number, number]>>((list, item, index, all) => {
        if (index % 2 === 0 && Number.isFinite(all[index + 1])) list.push([item, all[index + 1]]);
        return list;
      }, []);
  documentNode.querySelectorAll("polygon,polyline").forEach((element) => polylines.push({ vertices: closed(parsePoints(element.getAttribute("points") || "")), layer: element.getAttribute("id") || "CORTE" }));
  documentNode.querySelectorAll("rect").forEach((element) => {
    const x = number(element.getAttribute("x"));
    const y = number(element.getAttribute("y"));
    const width = number(element.getAttribute("width"));
    const height = number(element.getAttribute("height"));
    polylines.push({ vertices: [[x, y], [x + width, y], [x + width, y + height], [x, y + height], [x, y]], layer: element.getAttribute("id") || "CORTE" });
  });
  documentNode.querySelectorAll("circle,ellipse").forEach((element) => {
    const cx = number(element.getAttribute("cx"));
    const cy = number(element.getAttribute("cy"));
    const rx = element.tagName === "circle" ? number(element.getAttribute("r")) : number(element.getAttribute("rx"));
    const ry = element.tagName === "circle" ? rx : number(element.getAttribute("ry"));
    const vertices = Array.from({ length: 73 }, (_, index) => {
      const angle = (index / 72) * Math.PI * 2;
      return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry] as [number, number];
    });
    polylines.push({ vertices, layer: element.getAttribute("id") || "CORTE" });
  });
  const paths = [...documentNode.querySelectorAll("path")];
  if (paths.length) {
    const host = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    host.setAttribute("style", "position:fixed;left:-10000px;top:-10000px;width:1px;height:1px");
    document.body.appendChild(host);
    for (const source of paths) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", source.getAttribute("d") || "");
      host.appendChild(path);
      const length = path.getTotalLength();
      const steps = Math.max(12, Math.min(2000, Math.ceil(length / 1)));
      const vertices = Array.from({ length: steps + 1 }, (_, index) => {
        const point = path.getPointAtLength((index / steps) * length);
        return [point.x, point.y] as [number, number];
      });
      polylines.push({ vertices: closed(vertices), layer: source.getAttribute("id") || "CORTE" });
      path.remove();
    }
    host.remove();
  }
  return polylines;
}

function machineHourlyCost(machine: Machine | undefined, catalog: Catalog) {
  if (!machine) return 0;
  const hours = Math.max(number(machine.productive_hours_month), 1);
  const depreciation = Math.max(number(machine.purchase_cost) - number(machine.residual_value), 0) / Math.max(number(machine.useful_life_months) * hours, 1);
  const maintenance = number(machine.maintenance_monthly) / hours;
  const energy = number(machine.power_kw) * number(catalog.settings?.electricity_price_kwh);
  const consumables = (machine.pricing_machine_consumables ?? []).reduce(
    (sum, item) =>
      item.calculation_basis === "hora"
        ? sum + number(item.replacement_cost) / Math.max(number(item.useful_life_hours), 1)
        : item.calculation_basis === "mes"
          ? sum + number(item.replacement_cost) / Math.max(number(item.useful_life_months) * hours, 1)
          : sum,
    0,
  );
  return depreciation + maintenance + energy + consumables;
}

export function CutPlanPanel({ onBuildQuote }: { onBuildQuote: (prefill: CutPlanQuotePrefill) => void }) {
  const [tab, setTab] = useState<"quick" | "vector">("quick");
  const [catalog, setCatalog] = useState<Catalog>({ materials: [], machines: [] });
  const [loadedFiles, setLoadedFiles] = useState<string[]>([]);
  const [rawParts, setRawParts] = useState<CutPart[]>([]);
  const [pieceQuantities, setPieceQuantities] = useState<Record<string, number>>({});
  const [scaleUnit, setScaleUnit] = useState<ScaleUnit>("mm");
  const [showAllParts, setShowAllParts] = useState(false);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [process, setProcess] = useState<"laser" | "router_cnc">("laser");
  const [quantity, setQuantity] = useState("1");
  const [sheetWidth, setSheetWidth] = useState("");
  const [sheetHeight, setSheetHeight] = useState("");
  const [spacing, setSpacing] = useState("2");
  const [margin, setMargin] = useState("5");
  const [speed, setSpeed] = useState("500");
  const [allowRotation, setAllowRotation] = useState(true);
  const [attemptCount, setAttemptCount] = useState(0);
  const [plan, setPlan] = useState<CutPlan | null>(null);
  const [bestPlan, setBestPlan] = useState<CutPlan | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [hoveredPlacement, setHoveredPlacement] = useState<CutPlacement | null>(null);
  const fileBatchRef = useRef(0);

  useEffect(() => {
    fetch("/api/gestao/precificacao", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setCatalog(payload))
      .catch(() => setMessage("Não foi possível carregar materiais e máquinas."));
  }, []);

  const scaleFactor = SCALE_OPTIONS.find((item) => item.id === scaleUnit)?.factor ?? 1;
  const parts = useMemo(() => scaleCutParts(rawParts, scaleFactor), [rawParts, scaleFactor]);
  const activePartCount = useMemo(
    () => parts.filter((part) => (pieceQuantities[part.id] ?? 1) > 0).length,
    [parts, pieceQuantities],
  );
  const totalCopies = useMemo(() => {
    const mult = Math.max(1, Math.floor(number(quantity)));
    return parts.reduce((sum, part) => sum + Math.max(0, Math.floor(pieceQuantities[part.id] ?? 1)) * mult, 0);
  }, [parts, pieceQuantities, quantity]);

  const materials = useMemo(() => catalog.materials.filter((item) => item.format === "chapa" && number(item.width_mm) > 0 && number(item.height_mm) > 0), [catalog.materials]);
  const machines = useMemo(() => catalog.machines.filter((item) => item.machine_type === process), [catalog.machines, process]);
  const selectedMaterial = materials.find((item) => item.id === materialId);
  const selectedMachine = machines.find((item) => item.id === machineId);
  const sheetCost = selectedMaterial ? number(selectedMaterial.package_cost) / Math.max(number(selectedMaterial.purchase_quantity), 1) : 0;
  const hourlyCost = machineHourlyCost(selectedMachine, catalog);
  const estimatedCost = plan ? plan.sheets * sheetCost + (plan.estimatedMinutes / 60) * (hourlyCost + number(catalog.settings?.overhead_hour)) : 0;
  const fileLabel = loadedFiles.length === 0 ? "" : loadedFiles.length === 1 ? loadedFiles[0] : `${loadedFiles.length} arquivos (${loadedFiles.join(", ")})`;

  function changeProcess(next: "laser" | "router_cnc") {
    setProcess(next);
    setMachineId("");
    setPlan(null);
    if (next === "laser") {
      setSpacing("2");
      setMargin("5");
      setSpeed("500");
    } else {
      setSpacing("8");
      setMargin("15");
      setSpeed("1200");
    }
  }

  function clearFiles() {
    setLoadedFiles([]);
    setRawParts([]);
    setPieceQuantities({});
    setParseWarnings([]);
    setPlan(null);
    setBestPlan(null);
    setAttemptCount(0);
    setHoveredPlacement(null);
    setMessage("");
  }

  async function readFiles(event: ChangeEvent<HTMLInputElement>, append: boolean) {
    const fileList = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!fileList.length) return;
    setPlan(null);
    setBestPlan(null);
    setAttemptCount(0);
    setHoveredPlacement(null);
    setMessage("");

    const importedParts: CutPart[] = [];
    const importedWarnings: string[] = [];
    const importedNames: string[] = [];

    for (const file of fileList) {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension === "pdf" || extension === "eps") {
        importedWarnings.push(`${file.name}: converta PDF/EPS para DXF ou SVG para confirmar escala e encaixar automaticamente.`);
        continue;
      }
      try {
        const text = await file.text();
        let raw: Array<{ vertices: Array<[number, number]>; layer?: string }> = [];
        if (extension === "dxf") {
          const helper = new Helper(text);
          const entities = helper.denormalised;
          raw = helper.toPolylines().polylines.map((item, index) => ({
            vertices: item.vertices,
            layer: entities[index]?.layer || item.layer?.name || "CORTE",
          }));
        } else if (extension === "svg") {
          raw = svgPolylines(text);
        }
        if (!raw.length) {
          importedWarnings.push(`${file.name}: o arquivo não contém vetores compatíveis.`);
          continue;
        }
        fileBatchRef.current += 1;
        const batchId = fileBatchRef.current;
        const parsed = contoursToParts(raw);
        const shortFile = file.name.replace(/\.[^.]+$/, "");
        const taggedParts = parsed.parts.map((part, index) => ({
          ...part,
          id: `f${batchId}-${part.id}`,
          name: fileList.length > 1 || append ? `${shortFile} · Peça ${index + 1}` : part.name,
        }));
        importedParts.push(...taggedParts);
        importedWarnings.push(...parsed.warnings.map((w) => (fileList.length > 1 || append ? `${file.name}: ${w}` : w)));
        importedNames.push(file.name);
      } catch (error) {
        importedWarnings.push(`${file.name}: ${(error as Error).message}`);
      }
    }

    if (append) {
      setLoadedFiles((current) => [...current, ...importedNames]);
      setRawParts((current) => [...current, ...importedParts]);
      setParseWarnings((current) => [...current, ...importedWarnings]);
      setPieceQuantities((current) => {
        const next = { ...current };
        for (const part of importedParts) next[part.id] = 1;
        return next;
      });
    } else {
      setLoadedFiles(importedNames);
      setRawParts(importedParts);
      setParseWarnings(importedWarnings);
      const nextQuantities: Record<string, number> = {};
      for (const part of importedParts) nextQuantities[part.id] = 1;
      setPieceQuantities(nextQuantities);
    }

    if (importedParts.length) {
      setMessage(
        `OK:${importedParts.length} peça(s) fechada(s) ${append ? "adicionada(s)" : "identificada(s)"}. Confira a escala (${scaleUnit}) e as quantidades antes de calcular.`,
      );
    } else if (importedWarnings.length) {
      setMessage(importedWarnings[0]);
    } else {
      setMessage("Nenhum contorno fechado foi encontrado.");
    }
  }

  function updatePartQty(partId: string, qty: number) {
    setPieceQuantities((current) => ({ ...current, [partId]: Math.max(0, Math.min(200, Math.floor(qty || 0))) }));
    setPlan(null);
  }

  function togglePart(partId: string) {
    const current = pieceQuantities[partId] ?? 1;
    updatePartQty(partId, current > 0 ? 0 : 1);
  }

  function chooseMaterial(id: string) {
    setMaterialId(id);
    setPlan(null);
    const material = materials.find((item) => item.id === id);
    if (material) {
      setSheetWidth(String(material.width_mm));
      setSheetHeight(String(material.height_mm));
    }
  }

  function applyOffcut(width: string, height: string) {
    setMaterialId("");
    setSheetWidth(width);
    setSheetHeight(height);
    setPlan(null);
  }

  function calculate(retry = false) {
    setCalculating(true);
    setMessage("");
    setHoveredPlacement(null);
    const nextAttempt = retry ? attemptCount + 1 : 1;
    const worker = new Worker(new URL("./cut-plan.worker.ts", import.meta.url));
    const timeout = window.setTimeout(() => {
      worker.terminate();
      setCalculating(false);
      setMessage("Esta estratégia demorou além do esperado. Clique novamente para o sistema tentar outra forma de encaixe.");
    }, 45000);
    worker.onmessage = (event: MessageEvent<{ ok: boolean; plan?: CutPlan; error?: string }>) => {
      window.clearTimeout(timeout);
      worker.terminate();
      setCalculating(false);
      if (!event.data.ok || !event.data.plan) {
        setMessage(event.data.error || "Não foi possível calcular o encaixe.");
        return;
      }
      setAttemptCount(nextAttempt);
      if (!retry) {
        setPlan(event.data.plan);
        setBestPlan(event.data.plan);
        setMessage("OK:Plano calculado. Confira a escala e o posicionamento antes de baixar o DXF ou SVG.");
        return;
      }
      const improved = !bestPlan || isBetterPlan(event.data.plan, bestPlan);
      setPlan(event.data.plan);
      if (improved) setBestPlan(event.data.plan);
      setMessage(`OK:Tentativa ${nextAttempt} exibida.${improved ? " Este é o melhor resultado encontrado até agora." : " O melhor resultado anterior continua salvo e pode ser restaurado."}`);
    };
    worker.onerror = () => {
      window.clearTimeout(timeout);
      worker.terminate();
      setCalculating(false);
      setMessage("O otimizador não pôde ser iniciado. Atualize a página e tente novamente.");
    };
    worker.postMessage({
      parts,
      options: {
        sheetWidth: number(sheetWidth),
        sheetHeight: number(sheetHeight),
        quantity: number(quantity),
        pieceQuantities,
        spacing: number(spacing),
        margin: number(margin),
        allowRotation,
        attemptSeed: nextAttempt,
        speedMmMin: number(speed),
        setupMinutes: Math.max(number(selectedMachine?.setup_minutes), number(selectedMachine?.minimum_minutes)),
      },
    });
  }

  function downloadDxf(sheetIndex?: number) {
    if (!plan) return;
    const baseName = (loadedFiles[0] || "plano-corte").replace(/\.[^.]+$/, "");
    const suffix = sheetIndex !== undefined ? `-chapa-${sheetIndex + 1}` : "-encaixado";
    const content = exportCutPlanDxf(plan, { sheetIndex, sheetWidth: number(sheetWidth) });
    const blob = new Blob([content], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${baseName}${suffix}.dxf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadSvg(sheetIndex = 0) {
    if (!plan) return;
    const baseName = (loadedFiles[0] || "plano-corte").replace(/\.[^.]+$/, "");
    const suffix = plan.sheets > 1 ? `-chapa-${sheetIndex + 1}` : "-encaixado";
    const content = exportCutPlanSvg(plan, number(sheetWidth), number(sheetHeight), sheetIndex);
    const blob = new Blob([content], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${baseName}${suffix}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function buildQuote() {
    if (!plan) return;
    const processLabel = process === "laser" ? "corte a laser" : "corte em router CNC";
    const materialName = selectedMaterial?.name ?? `chapa / retalho ${sheetWidth} × ${sheetHeight} mm`;
    const targetMargin = Math.max(0, Math.min(90, number(catalog.settings?.target_margin_percent) || 30));
    const suggestedPrice = estimatedCost / Math.max(1 - targetMargin / 100, 0.1);
    const materialDetail = selectedMaterial
      ? `${plan.sheets} chapa(s) de ${materialName} · ${sheetWidth} × ${sheetHeight} mm`
      : `${plan.sheets} chapa(s) (${sheetWidth} × ${sheetHeight} mm) · material a confirmar`;
    onBuildQuote({
      service: `Plano de corte — ${processLabel}`,
      details: `${totalCopies} peça(s) vetoriais em ${materialName}. O valor considera o plano de aproveitamento calculado e deve ser revisado antes do envio ao cliente.`,
      internalNotes: `Arquivo(s): ${fileLabel || "vetor importado"}\nEscala de importação: ${scaleUnit}\n${materialDetail}\nComprimento total de corte: ${decimal.format(plan.totalCutLength / 1000)} m\nTempo técnico estimado: ${decimal.format(plan.estimatedMinutes)} min\nTentativa de encaixe utilizada: ${attemptCount}`,
      item: {
        description: `${process === "laser" ? "Corte a laser" : "Corte em router CNC"} de ${totalCopies} peça(s)`,
        serviceType: process,
        material: materialName,
        quantity: "1",
        unit: "serviço",
        unitCost: String(Number(estimatedCost.toFixed(2))),
        unitPrice: String(Number(suggestedPrice.toFixed(2))),
        productionNotes: `${materialDetail}. Corte: ${decimal.format(plan.totalCutLength / 1000)} m · máquina: ${decimal.format(plan.estimatedMinutes)} min.`,
        machineId,
        machineMinutes: String(Number(plan.estimatedMinutes.toFixed(2))),
        desiredMarginPercent: String(targetMargin),
      },
    });
  }

  const visibleParts = showAllParts ? parts : parts.slice(0, 12);

  return <>
    <header className="module-heading no-print"><div><p>APROVEITAMENTO · CHAPA · BOBINA · DXF</p><h1>Plano de corte inteligente</h1><span>Simule o encaixe visual por medida (chapas e bobinas) em segundos ou importe arquivos vetoriais DXF/SVG.</span></div></header>
    <div className="attendance-tabs no-print">
      <button type="button" className={tab === "quick" ? "active" : ""} onClick={() => setTab("quick")}>
        <Layers3 />
        Encaixe rápido por medida (Chapa / Bobina)
      </button>
      <button type="button" className={tab === "vector" ? "active" : ""} onClick={() => setTab("vector")}>
        <FileUp />
        Importar vetor DXF / SVG (Laser / Router)
      </button>
    </div>
    {tab === "quick" ? (
      <QuickRectNesting
        materials={catalog.materials}
        targetMargin={number(catalog.settings?.target_margin_percent) || 30}
        onBuildQuote={onBuildQuote}
      />
    ) : <>
    <section className="cut-plan-flow">
      <article className="cut-plan-upload">
        <span><FileUp /></span>
        <div>
          <small>01 · ARQUIVOS VETORIAIS</small>
          <h2>Importe um ou mais arquivos DXF / SVG</h2>
          <p>Combine peças de vários pedidos na mesma chapa, ajuste a unidade de escala e defina a quantidade de cada peça.</p>
          <div className="cut-plan-upload-actions">
            <label>
              <input
                type="file"
                multiple
                accept=".dxf,.svg,.pdf,.eps,application/dxf,image/svg+xml,application/pdf"
                onChange={(event) => void readFiles(event, false)}
              />
              <FileUp />
              {loadedFiles.length ? "Substituir arquivo(s)" : "Escolher DXF ou SVG"}
            </label>
            {loadedFiles.length > 0 && (
              <>
                <label className="secondary-upload">
                  <input
                    type="file"
                    multiple
                    accept=".dxf,.svg,.pdf,.eps,application/dxf,image/svg+xml,application/pdf"
                    onChange={(event) => void readFiles(event, true)}
                  />
                  <Plus />
                  Adicionar outro arquivo
                </label>
                <button type="button" className="clear-files-btn" onClick={clearFiles}>
                  <Trash2 />
                  Limpar
                </button>
              </>
            )}
          </div>
          {loadedFiles.length > 0 && (
            <div className="cut-plan-files-chips">
              {loadedFiles.map((name, idx) => (
                <span key={`${name}-${idx}`}>{name}</span>
              ))}
            </div>
          )}
        </div>
      </article>

      <article className="cut-plan-settings">
        <header><small>02 · PROCESSO E MATERIAL</small><h2>Parâmetros de produção</h2></header>
        <div className="cut-plan-process">
          <button type="button" className={process === "laser" ? "active" : ""} onClick={() => changeProcess("laser")}><Scissors /><b>Laser</b><small>Saída para RDWorks / LightBurn</small></button>
          <button type="button" className={process === "router_cnc" ? "active" : ""} onClick={() => changeProcess("router_cnc")}><Gauge /><b>Router CNC</b><small>Saída para Aspire / VCarve</small></button>
        </div>
        <div className="cut-plan-offcut-bar">
          <span>Testar em retalho rápido (mm):</span>
          {OFFCUT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={!materialId && sheetWidth === preset.w && sheetHeight === preset.h ? "active" : ""}
              onClick={() => applyOffcut(preset.w, preset.h)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="cut-plan-form">
          <label>Material / chapa<select value={materialId} onChange={(event) => chooseMaterial(event.target.value)}><option value="">{sheetWidth && sheetHeight ? "Retalho / medida livre" : "Selecione do estoque..."}</option>{materials.map((item) => <option value={item.id} key={item.id}>{item.name}{item.thickness_mm ? ` · ${item.thickness_mm} mm` : ""} · {item.width_mm} × {item.height_mm} mm</option>)}</select></label>
          <label>Máquina<select value={machineId} onChange={(event) => { setMachineId(event.target.value); setPlan(null); }}><option value="">Sem máquina / somente encaixe</option>{machines.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label>Largura da chapa (mm)<Input type="number" min="1" value={sheetWidth} onChange={(event) => { setSheetWidth(event.target.value); setPlan(null); }} /></label>
          <label>Altura da chapa (mm)<Input type="number" min="1" value={sheetHeight} onChange={(event) => { setSheetHeight(event.target.value); setPlan(null); }} /></label>
          <label>Multiplicar lote inteiro por<Input type="number" min="1" step="1" value={quantity} onChange={(event) => { setQuantity(event.target.value); setPlan(null); }} /></label>
          <label>Espaço entre peças (mm)<Input type="number" min="0" step="0.1" value={spacing} onChange={(event) => { setSpacing(event.target.value); setPlan(null); }} /></label>
          <label>Margem da chapa (mm)<Input type="number" min="0" step="0.1" value={margin} onChange={(event) => { setMargin(event.target.value); setPlan(null); }} /></label>
          <label>Velocidade de corte (mm/min)<Input type="number" min="1" value={speed} onChange={(event) => { setSpeed(event.target.value); setPlan(null); }} /></label>
          <label className="cut-plan-check"><input type="checkbox" checked={allowRotation} onChange={(event) => { setAllowRotation(event.target.checked); setPlan(null); setAttemptCount(0); }} /><span><b>Encaixe inteligente v2 (ângulos, furos internos e compactação)</b><small>Testa múltiplas estratégias automaticamente, desliza as peças até o espaçamento exato e aproveita furos internos de peças vazadas. Desative a rotação somente para materiais com veio obrigatório.</small></span></label>
        </div>
        <Button type="button" onClick={() => calculate(false)} disabled={calculating || totalCopies <= 0 || !number(sheetWidth) || !number(sheetHeight)}>
          {calculating ? <RefreshCw className="spin" /> : <Settings2 />}
          {calculating ? "Otimizando sem travar a tela..." : `Calcular melhor encaixe (${totalCopies} peça${totalCopies === 1 ? "" : "s"})`}
        </Button>
      </article>
    </section>

    {message && <div className={`module-feedback ${message.startsWith("OK:") ? "success" : ""}`}>{message.startsWith("OK:") ? <CheckCircle2 /> : <AlertTriangle />}{message.replace(/^OK:/, "")}</div>}

    {(parts.length > 0 || parseWarnings.length > 0) && (
      <section className="cut-plan-file-audit">
        <header>
          <div>
            <small>LEITURA E ESCALA DO VETOR</small>
            <h2>{fileLabel || "Peças importadas"}</h2>
          </div>
          <span>{activePartCount}/{parts.length} ativa(s) · {totalCopies} no lote</span>
        </header>

        {parts.length > 0 && (
          <div className="cut-plan-scale-bar">
            <span><Ruler /> Unidade do arquivo original:</span>
            <div>
              {SCALE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.hint}
                  className={scaleUnit === opt.id ? "active" : ""}
                  onClick={() => {
                    setScaleUnit(opt.id);
                    setPlan(null);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {parts.length > 0 && (
          <>
            <div className="cut-plan-parts">
              {visibleParts.map((part) => {
                const qty = pieceQuantities[part.id] ?? 1;
                const enabled = qty > 0;
                const holes = Math.max(0, part.contours.length - 1);
                return (
                  <div key={part.id} className={`cut-plan-part-card ${enabled ? "" : "muted"}`}>
                    <label className="cut-plan-part-toggle">
                      <input type="checkbox" checked={enabled} onChange={() => togglePart(part.id)} />
                      <span>
                        <b>{part.name}</b>
                        <small>
                          {decimal.format(part.width)} × {decimal.format(part.height)} mm · {decimal.format(part.cutLength / 1000)} m
                          {holes > 0 ? ` · ${holes} furo(s)` : ""}
                        </small>
                      </span>
                    </label>
                    <label className="cut-plan-part-qty" aria-label={`Quantidade de ${part.name}`}>
                      <small>Qtd</small>
                      <Input
                        type="number"
                        min="0"
                        max="200"
                        step="1"
                        value={qty}
                        onChange={(event) => updatePartQty(part.id, Number(event.target.value))}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
            {parts.length > 12 && (
              <div className="cut-plan-more-parts">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAllParts((cur) => !cur)}>
                  {showAllParts ? "Mostrar menos peças" : `Ver e ajustar todas as ${parts.length} peças`}
                </Button>
              </div>
            )}
          </>
        )}
        {parseWarnings.map((warning, idx) => <p key={`${warning}-${idx}`}><AlertTriangle />{warning}</p>)}
      </section>
    )}

    {plan && (
      <section className="cut-plan-result">
        <header>
          <div>
            <small>{plan === bestPlan ? "MELHOR RESULTADO" : "ALTERNATIVA ATUAL"} · {attemptCount} TENTATIVA(S)</small>
            <h2>{plan.sheets} chapa(s) · {decimal.format(plan.utilisation)}% de aproveitamento</h2>
          </div>
          <div className="cut-plan-result-actions">
            {bestPlan && plan !== bestPlan && (
              <Button type="button" variant="outline" onClick={() => { setPlan(bestPlan); setMessage("OK:Melhor resultado restaurado."); }}>
                <CheckCircle2 />Voltar ao melhor
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => calculate(true)} disabled={calculating}>
              <RefreshCw className={calculating ? "spin" : ""} />
              {calculating ? "Tentando outra estratégia..." : "Tentar outro encaixe"}
            </Button>
            <Button type="button" onClick={buildQuote}><ClipboardList />Montar orçamento</Button>
            <Button type="button" variant="outline" onClick={() => downloadSvg(0)}><FileCode2 />Baixar SVG (mm)</Button>
            <Button type="button" onClick={() => downloadDxf()}><Download />Baixar DXF encaixado</Button>
          </div>
        </header>

        <div className="cut-plan-kpis">
          <span><Layers3 /><small>CHAPAS</small><b>{plan.sheets}</b></span>
          <span><Ruler /><small>LINHA DE CORTE</small><b>{decimal.format(plan.totalCutLength / 1000)} m</b></span>
          <span><Gauge /><small>TEMPO ESTIMADO</small><b>{decimal.format(plan.estimatedMinutes)} min</b></span>
          <span><Settings2 /><small>CUSTO TÉCNICO</small><b>{money.format(estimatedCost)}</b></span>
        </div>

        <div className="cut-plan-hover-tip">
          {hoveredPlacement ? (
            <>
              <b>{hoveredPlacement.part.name}</b>
              <span>{decimal.format(hoveredPlacement.part.width)} × {decimal.format(hoveredPlacement.part.height)} mm</span>
              <span>Rotação: {decimal.format(hoveredPlacement.rotation)}°</span>
              <span>Corte: {decimal.format(hoveredPlacement.part.cutLength / 1000)} m</span>
              {hoveredPlacement.part.contours.length > 1 && <span>{hoveredPlacement.part.contours.length - 1} furo(s) interno(s)</span>}
            </>
          ) : (
            <span>Passe o mouse sobre qualquer peça no mapa para ver nome, medidas reais e ângulo de encaixe. Camadas exportadas: <b>FUROS_INTERNOS</b> (1º) → <b>CORTE_EXTERNO</b> (2º).</span>
          )}
        </div>

        <div className="cut-plan-preview">
          {Array.from({ length: plan.sheets }, (_, sheet) => {
            const width = number(sheetWidth);
            const height = number(sheetHeight);
            const gridId = `cut-grid-${sheet}`;
            const sheetPlacements = plan.placements.filter((item) => item.sheet === sheet);
            return (
              <figure key={sheet} className={height > width ? "portrait" : "landscape"}>
                <figcaption>
                  <div>
                    <span>Chapa {sheet + 1}</span>
                    <b>{width} × {height} mm · {sheetPlacements.length} peça(s)</b>
                  </div>
                  {plan.sheets > 1 && (
                    <div className="cut-plan-sheet-actions">
                      <button type="button" onClick={() => downloadDxf(sheet)}><Download />DXF</button>
                      <button type="button" onClick={() => downloadSvg(sheet)}><FileCode2 />SVG</button>
                    </div>
                  )}
                </figcaption>
                <div className="cut-plan-sheet-frame">
                  <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ aspectRatio: `${width} / ${height}` }} role="img" aria-label={`Plano de corte da chapa ${sheet + 1}`}>
                    <defs><pattern id={gridId} width="100" height="100" patternUnits="userSpaceOnUse"><path d="M 100 0 L 0 0 0 100" /></pattern></defs>
                    <rect className="sheet-background" width={width} height={height} />
                    <rect className="sheet-grid" width={width} height={height} fill={`url(#${gridId})`} />
                    <rect className="sheet-margin" x={number(margin)} y={number(margin)} width={Math.max(0, width - number(margin) * 2)} height={Math.max(0, height - number(margin) * 2)} />
                    <g transform={`translate(0 ${height}) scale(1 -1)`}>
                      {sheetPlacements.map((placement) => {
                        const isHovered = hoveredPlacement?.part.id === placement.part.id;
                        return (
                          <g
                            key={placement.part.id}
                            className={isHovered ? "placement-hovered" : ""}
                            onMouseEnter={() => setHoveredPlacement(placement)}
                            onMouseLeave={() => setHoveredPlacement((cur) => (cur?.part.id === placement.part.id ? null : cur))}
                          >
                            {placement.part.contours.map((contour, index) => (
                              <polygon
                                key={`${placement.part.id}-${index}`}
                                points={transformContour(contour, placement).map((point) => `${point.x},${point.y}`).join(" ")}
                                className={index === 0 ? "outer" : "hole"}
                              >
                                <title>{`${placement.part.name} (${decimal.format(placement.part.width)} × ${decimal.format(placement.part.height)} mm · ${decimal.format(placement.rotation)}°)`}</title>
                              </polygon>
                            ))}
                          </g>
                        );
                      })}
                    </g>
                  </svg>
                </div>
                <div className="cut-plan-sheet-legend">
                  <span><i />Área útil</span>
                  <span>Margem {margin} mm</span>
                  <span>Furos → Externo</span>
                </div>
              </figure>
            );
          })}
        </div>
        <p className="cut-plan-safety"><AlertTriangle /><span><b>Conferência obrigatória:</b> abra o DXF/SVG no RDWorks, LightBurn ou Aspire, confirme unidade em milímetros, origem, compensação da ferramenta e a ordem das camadas (<code>FUROS_INTERNOS</code> antes de <code>CORTE_EXTERNO</code>) antes de produzir.</span></p>
      </section>
    )}
    </>}
  </>;
}
