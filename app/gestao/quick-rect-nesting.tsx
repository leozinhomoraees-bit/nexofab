"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, Layers3, Plus, Printer, RotateCw, Ruler, ScrollText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeRectNesting, type RectPieceInput } from "@/lib/rect-nesting";
import type { CutPlanQuotePrefill } from "@/lib/cut-plan-quote";

type CatalogMaterial = {
  id: string;
  name: string;
  category: string;
  format: string;
  package_cost: number;
  purchase_quantity: number;
  width_mm?: number | null;
  height_mm?: number | null;
  thickness_mm?: number | null;
};

type PieceRow = {
  id: string;
  label: string;
  widthCm: string;
  heightCm: string;
  quantity: string;
};

const sheetPresets = [
  { label: "ACM 122×500 cm", wCm: "122", hCm: "500" },
  { label: "PVC 122×244 cm", wCm: "122", hCm: "244" },
  { label: "Acrílico / PS 100×200 cm", wCm: "100", hCm: "200" },
  { label: "MDF 185×275 cm", wCm: "185", hCm: "275" },
];

const rollPresets = [
  { label: "Vinil 100 cm", wCm: "100" },
  { label: "Vinil 122 cm", wCm: "122" },
  { label: "Lona 160 cm", wCm: "160" },
  { label: "Lona 320 cm", wCm: "320" },
];

const pieceColors = [
  { fill: "#d8f3ee", stroke: "#0c7d73", text: "#094d47" },
  { fill: "#dcebfb", stroke: "#2865b8", text: "#163d73" },
  { fill: "#fef0d5", stroke: "#c47d14", text: "#6e4406" },
  { fill: "#ebe3fb", stroke: "#6c48bd", text: "#3d2475" },
  { fill: "#fde3dc", stroke: "#c44b32", text: "#732515" },
  { fill: "#e4f5d2", stroke: "#588b1e", text: "#2e4d0c" },
];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function QuickRectNesting({
  materials,
  targetMargin = 30,
  onBuildQuote,
}: {
  materials: CatalogMaterial[];
  targetMargin?: number;
  onBuildQuote: (prefill: CutPlanQuotePrefill) => void;
}) {
  const [mode, setMode] = useState<"chapa" | "bobina">("chapa");
  const [materialId, setMaterialId] = useState("");
  const [sheetWidthCm, setSheetWidthCm] = useState("122");
  const [sheetHeightCm, setSheetHeightCm] = useState("244");
  const [unitMaterialCost, setUnitMaterialCost] = useState("");
  const [marginMm, setMarginMm] = useState("10");
  const [spacingMm, setSpacingMm] = useState("5");
  const [allowRotation, setAllowRotation] = useState(true);
  const [pieces, setPieces] = useState<PieceRow[]>([
    { id: "p-1", label: "Placa principal", widthCm: "60", heightCm: "40", quantity: "12" },
  ]);

  const matchingMaterials = useMemo(
    () =>
      materials.filter((m) =>
        mode === "chapa"
          ? m.format === "chapa" && Number(m.width_mm) > 0 && Number(m.height_mm) > 0
          : /rolo|metro|bobina/i.test(m.format) && Number(m.width_mm) > 0,
      ),
    [materials, mode],
  );

  const selectedMaterial = matchingMaterials.find((m) => m.id === materialId);

  function switchMode(next: "chapa" | "bobina") {
    setMode(next);
    setMaterialId("");
    setUnitMaterialCost("");
    if (next === "chapa") {
      setSheetWidthCm("122");
      setSheetHeightCm("244");
      setMarginMm("10");
      setSpacingMm("5");
    } else {
      setSheetWidthCm("122");
      setMarginMm("10");
      setSpacingMm("5");
    }
  }

  function handleSelectMaterial(id: string) {
    setMaterialId(id);
    const mat = matchingMaterials.find((m) => m.id === id);
    if (!mat) return;
    if (Number(mat.width_mm) > 0) setSheetWidthCm(String(Number((Number(mat.width_mm) / 10).toFixed(1))));
    if (mode === "chapa" && Number(mat.height_mm) > 0) {
      setSheetHeightCm(String(Number((Number(mat.height_mm) / 10).toFixed(1))));
    }
    const perUnit = Number(mat.package_cost || 0) / Math.max(Number(mat.purchase_quantity || 1), 1);
    if (perUnit > 0) setUnitMaterialCost(String(Number(perUnit.toFixed(2))));
  }

  function addPieceRow() {
    setPieces((current) => [
      ...current,
      { id: `p-${Date.now()}-${current.length}`, label: `Peça ${current.length + 1}`, widthCm: "40", heightCm: "30", quantity: "4" },
    ]);
  }

  function updatePiece(id: string, field: keyof Omit<PieceRow, "id">, value: string) {
    setPieces((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  function removePiece(id: string) {
    setPieces((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  }

  const result = useMemo(() => {
    const parsedPieces: RectPieceInput[] = pieces.map((row) => ({
      id: row.id,
      label: row.label.trim() || "Peça",
      widthMm: Math.max(0, Number(row.widthCm || 0) * 10),
      heightMm: Math.max(0, Number(row.heightCm || 0) * 10),
      quantity: Math.max(0, Math.floor(Number(row.quantity || 0))),
    }));
    return computeRectNesting({
      mode,
      sheetWidthMm: Math.max(10, Number(sheetWidthCm || 0) * 10),
      sheetHeightMm: Math.max(10, Number(sheetHeightCm || 0) * 10),
      marginMm: Math.max(0, Number(marginMm || 0)),
      spacingMm: Math.max(0, Number(spacingMm || 0)),
      allowRotation,
      pieces: parsedPieces,
    });
  }, [allowRotation, marginMm, mode, pieces, sheetHeightCm, sheetWidthCm, spacingMm]);

  const unitCostNum = Math.max(0, Number(unitMaterialCost || 0));
  const estimatedMaterialCost =
    mode === "chapa" ? result.totalSheets * unitCostNum : result.linearMeters * unitCostNum;

  function sendToQuote() {
    if (!result.totalPiecesPlaced) return;
    const matName = selectedMaterial?.name || (mode === "chapa" ? `Chapa ${sheetWidthCm}×${sheetHeightCm} cm` : `Bobina ${sheetWidthCm} cm`);
    const summaryLines = pieces
      .filter((p) => Number(p.quantity) > 0 && Number(p.widthCm) > 0 && Number(p.heightCm) > 0)
      .map((p) => `${p.quantity}× ${p.label || "Peça"} (${p.widthCm}×${p.heightCm} cm)`)
      .join(", ");
    const safeMargin = Math.max(5, Math.min(85, targetMargin || 30));
    const suggestedPrice = estimatedMaterialCost > 0 ? estimatedMaterialCost / Math.max(1 - safeMargin / 100, 0.15) : 0;
    const consumptionText =
      mode === "chapa"
        ? `${result.totalSheets} chapa(s) de ${sheetWidthCm}×${sheetHeightCm} cm`
        : `${decimal.format(result.linearMeters)} m lineares (bobina ${sheetWidthCm} cm)`;

    onBuildQuote({
      service: `Corte / produção em ${matName}`,
      details: `${result.totalPiecesPlaced} peça(s): ${summaryLines}.`,
      internalNotes: `Encaixe rápido (${mode === "chapa" ? "chapa" : "bobina"}): ${consumptionText}\nAproveitamento: ${decimal.format(result.utilizationPercent)}% · Sobra: ${decimal.format(result.wastePercent)}%\nÁrea útil: ${decimal.format(result.usedAreaM2)} m² / Área comprada: ${decimal.format(result.purchasedAreaM2)} m²`,
      item: {
        description: `${matName} — ${summaryLines}`,
        serviceType: "router_cnc",
        material: matName,
        quantity: "1",
        unit: "serviço",
        unitCost: String(Number(estimatedMaterialCost.toFixed(2))),
        unitPrice: String(Number(suggestedPrice.toFixed(2))),
        productionNotes: `${consumptionText} · Aproveitamento ${decimal.format(result.utilizationPercent)}%`,
        machineId: "",
        machineMinutes: "",
        desiredMarginPercent: String(safeMargin),
      },
    });
  }

  return (
    <div className="rect-nesting-workspace">
      <div className="rect-nesting-setup no-print">
        <article className="rect-nesting-card">
          <header>
            <small>01 · SUBSTRATO</small>
            <h2>Chapa rígida ou bobina</h2>
          </header>

          <div className="cut-plan-process">
            <button type="button" className={mode === "chapa" ? "active" : ""} onClick={() => switchMode("chapa")}>
              <Layers3 />
              <b>Chapa rígida</b>
              <small>ACM, MDF, Acrílico, PVC, PS</small>
            </button>
            <button type="button" className={mode === "bobina" ? "active" : ""} onClick={() => switchMode("bobina")}>
              <ScrollText />
              <b>Bobina / Rolo</b>
              <small>Vinil adesivo, lona, papel</small>
            </button>
          </div>

          <div className="rect-presets">
            {(mode === "chapa" ? sheetPresets : rollPresets).map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setMaterialId("");
                  setSheetWidthCm(preset.wCm);
                  if ("hCm" in preset && typeof preset.hCm === "string") setSheetHeightCm(preset.hCm);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="cut-plan-form">
            <label className="span-full">
              Material cadastrado (opcional — puxa medida e custo)
              <select value={materialId} onChange={(e) => handleSelectMaterial(e.target.value)}>
                <option value="">Informar medida manualmente...</option>
                {matchingMaterials.map((mat) => (
                  <option key={mat.id} value={mat.id}>
                    {mat.name}
                    {mat.thickness_mm ? ` · ${mat.thickness_mm}mm` : ""} · {Number(mat.width_mm) / 10}
                    {mode === "chapa" && mat.height_mm ? `×${Number(mat.height_mm) / 10}` : ""} cm
                  </option>
                ))}
              </select>
            </label>
            <label>
              {mode === "chapa" ? "Largura da chapa (cm)" : "Largura útil da bobina (cm)"}
              <Input type="number" min="1" step="0.1" value={sheetWidthCm} onChange={(e) => setSheetWidthCm(e.target.value)} />
            </label>
            {mode === "chapa" ? (
              <label>
                Comprimento / Altura (cm)
                <Input type="number" min="1" step="0.1" value={sheetHeightCm} onChange={(e) => setSheetHeightCm(e.target.value)} />
              </label>
            ) : (
              <label>
                Custo por metro linear (R$)
                <Input type="number" min="0" step="0.01" placeholder="Opcional" value={unitMaterialCost} onChange={(e) => setUnitMaterialCost(e.target.value)} />
              </label>
            )}
            {mode === "chapa" && (
              <label>
                Custo por chapa (R$)
                <Input type="number" min="0" step="0.01" placeholder="Opcional" value={unitMaterialCost} onChange={(e) => setUnitMaterialCost(e.target.value)} />
              </label>
            )}
            <label>
              Espaço entre peças (mm)
              <Input type="number" min="0" step="0.5" value={spacingMm} onChange={(e) => setSpacingMm(e.target.value)} />
            </label>
            <label>
              Margem de borda (mm)
              <Input type="number" min="0" step="1" value={marginMm} onChange={(e) => setMarginMm(e.target.value)} />
            </label>
            <label className="cut-plan-check">
              <input type="checkbox" checked={allowRotation} onChange={(e) => setAllowRotation(e.target.checked)} />
              <span>
                <b><RotateCw className="inline-icon" /> Permitir girar peças em 90°</b>
                <small>Testa automaticamente a rotação para reduzir sobras. Desmarque se o material tiver veio ou sentido de impressão fixo.</small>
              </span>
            </label>
          </div>
        </article>

        <article className="rect-nesting-card">
          <header className="rect-pieces-head">
            <div>
              <small>02 · MEDIDAS DAS PEÇAS (EM CM)</small>
              <h2>Lista de cortes</h2>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addPieceRow}>
              <Plus />
              Adicionar medida
            </Button>
          </header>

          <div className="rect-piece-rows">
            {pieces.map((row, idx) => {
              const color = pieceColors[idx % pieceColors.length];
              return (
                <div key={row.id} className="rect-piece-row">
                  <span className="rect-piece-swatch" style={{ background: color.fill, borderColor: color.stroke }} />
                  <label>
                    Descrição
                    <Input
                      value={row.label}
                      placeholder={`Peça ${idx + 1}`}
                      onChange={(e) => updatePiece(row.id, "label", e.target.value)}
                    />
                  </label>
                  <label>
                    Larg. (cm)
                    <Input
                      type="number"
                      min="0.5"
                      step="0.1"
                      value={row.widthCm}
                      onChange={(e) => updatePiece(row.id, "widthCm", e.target.value)}
                    />
                  </label>
                  <label>
                    Alt. (cm)
                    <Input
                      type="number"
                      min="0.5"
                      step="0.1"
                      value={row.heightCm}
                      onChange={(e) => updatePiece(row.id, "heightCm", e.target.value)}
                    />
                  </label>
                  <label>
                    Qtd
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(e) => updatePiece(row.id, "quantity", e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="rect-piece-del"
                    aria-label="Remover medida"
                    disabled={pieces.length <= 1}
                    onClick={() => removePiece(row.id)}
                  >
                    <Trash2 />
                  </button>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      {result.unplacedLabels.length > 0 && (
        <div className="module-feedback">
          <AlertTriangle />
          <span>
            Peça(s) maior(es) que a largura/área útil informada: <b>{result.unplacedLabels.join(", ")}</b>. Ajuste as medidas ou o formato do material.
          </span>
        </div>
      )}

      <section className="cut-plan-result">
        <header>
          <div>
            <small>MAPA DE APROVEITAMENTO INSTANTÂNEO</small>
            <h2>
              {mode === "chapa"
                ? `${result.totalSheets} chapa(s) · ${decimal.format(result.utilizationPercent)}% de aproveitamento`
                : `${decimal.format(result.linearMeters)} m lineares · ${decimal.format(result.utilizationPercent)}% de aproveitamento`}
            </h2>
          </div>
          <div className="cut-plan-result-actions no-print">
            <Button type="button" variant="outline" onClick={() => window.print()} disabled={!result.totalPiecesPlaced}>
              <Printer />
              Imprimir mapa
            </Button>
            <Button type="button" onClick={sendToQuote} disabled={!result.totalPiecesPlaced}>
              <ClipboardList />
              Montar orçamento
            </Button>
          </div>
        </header>

        <div className="cut-plan-kpis">
          <span>
            {mode === "chapa" ? <Layers3 /> : <Ruler />}
            <small>{mode === "chapa" ? "CHAPAS" : "METROS LINEARES"}</small>
            <b>{mode === "chapa" ? result.totalSheets : `${decimal.format(result.linearMeters)} m`}</b>
          </span>
          <span>
            <RotateCw />
            <small>APROVEITAMENTO / SOBRA</small>
            <b>{decimal.format(result.utilizationPercent)}% / {decimal.format(result.wastePercent)}%</b>
          </span>
          <span>
            <Ruler />
            <small>ÁREA PEÇAS / COMPRADA</small>
            <b>{decimal.format(result.usedAreaM2)} / {decimal.format(result.purchasedAreaM2)} m²</b>
          </span>
          <span>
            <ClipboardList />
            <small>CUSTO DE MATERIAL</small>
            <b>{estimatedMaterialCost > 0 ? money.format(estimatedMaterialCost) : `${result.totalPiecesPlaced} pç`}</b>
          </span>
        </div>

        {result.sheets.length > 0 ? (
          <div className="cut-plan-preview">
            {result.sheets.map((sheet) => {
              const isPortrait = sheet.heightMm > sheet.widthMm;
              const fontSize = Math.max(Math.min(sheet.widthMm, sheet.heightMm) * 0.028, 18);
              const gridStep = Math.max(100, Math.round(sheet.widthMm / 12 / 50) * 50);
              return (
                <figure key={sheet.index} className={isPortrait ? "portrait" : "landscape"}>
                  <figcaption>
                    <span>
                      {mode === "chapa" ? `Chapa ${sheet.index}` : `Bobina · ${decimal.format(sheet.heightMm / 1000)} m`}
                      {" "}({sheet.placements.length} peças)
                    </span>
                    <b>{decimal.format(sheet.utilizationPercent)}% útil</b>
                  </figcaption>
                  <div className="cut-plan-sheet-frame">
                    <svg
                      viewBox={`0 0 ${sheet.widthMm} ${sheet.heightMm}`}
                      preserveAspectRatio="xMidYMid meet"
                      style={{ aspectRatio: `${sheet.widthMm} / ${Math.max(sheet.heightMm, 1)}` }}
                      role="img"
                      aria-label={`Mapa de corte ${sheet.index}`}
                    >
                      <defs>
                        <pattern id={`rect-grid-${sheet.index}`} width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
                          <path d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`} fill="none" stroke="#e3ecee" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        </pattern>
                      </defs>
                      <rect width={sheet.widthMm} height={sheet.heightMm} fill="#ffffff" />
                      <rect width={sheet.widthMm} height={sheet.heightMm} fill={`url(#rect-grid-${sheet.index})`} />
                      {Number(marginMm) > 0 && (
                        <rect
                          x={Number(marginMm)}
                          y={Number(marginMm)}
                          width={Math.max(0, sheet.widthMm - Number(marginMm) * 2)}
                          height={Math.max(0, sheet.heightMm - Number(marginMm) * 2)}
                          fill="none"
                          stroke="#e69e60"
                          strokeWidth="1.2"
                          strokeDasharray="6 4"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                      {sheet.placements.map((item, idx) => {
                        const palette = pieceColors[item.colorIndex % pieceColors.length];
                        const showText = item.width >= sheet.widthMm * 0.08 && item.height >= Math.min(sheet.widthMm, sheet.heightMm) * 0.06;
                        const labelFont = Math.min(fontSize, item.width * 0.22, item.height * 0.34);
                        return (
                          <g key={`${item.pieceId}-${idx}`}>
                            <rect
                              x={item.x}
                              y={item.y}
                              width={item.width}
                              height={item.height}
                              fill={palette.fill}
                              stroke={palette.stroke}
                              strokeWidth="1.5"
                              vectorEffect="non-scaling-stroke"
                            />
                            {showText && (
                              <text
                                x={item.x + item.width / 2}
                                y={item.y + item.height / 2 + labelFont * 0.35}
                                textAnchor="middle"
                                fill={palette.text}
                                fontSize={labelFont}
                                fontWeight="800"
                              >
                                {`${Number((item.origWidth / 10).toFixed(1))}×${Number((item.origHeight / 10).toFixed(1))}${item.rotated ? " ↻" : ""}`}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                  <div className="cut-plan-sheet-legend">
                    <span>
                      Dimensão: {decimal.format(sheet.widthMm / 10)} × {decimal.format(sheet.heightMm / 10)} cm
                    </span>
                    <span>Margem {marginMm || 0} mm · Espaço {spacingMm || 0} mm</span>
                  </div>
                </figure>
              );
            })}
          </div>
        ) : (
          <div className="exec-chart-empty">Informe as medidas das peças acima para gerar o mapa visual de aproveitamento.</div>
        )}
      </section>
    </div>
  );
}
