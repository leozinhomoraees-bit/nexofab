"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, Check, CircleDollarSign, Download, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv } from "@/lib/csv-export";
import { useToast } from "./toast-context";
import styles from "./commission-report-panel.module.css";

type Report = {
  period: { from: string; to: string };
  summary: { sales: number; commissionBase: number; commission: number; tax: number; estimatedResult: number; closedQuotes: number; averageCommissionPercent: number };
  rows: Array<{ id: string; number: number; customerName: string; service: string; status: "aprovado" | "convertido"; commercialAt: string; sale: number; commissionBase: number; commission: number; tax: number; estimatedResult: number; details: Array<{ description: string; base: number; commissionPercent: number; commission: number; taxPercent: number; tax: number; recovered: boolean }> }>;
  missingCommercialMemory: number;
  recoveredCommercialMemory: number;
  unresolvedItems: Array<{ itemId: string; quoteNumber: number; customerName: string; description: string; base: number }>;
  suggestedRates: { commissionPercent: number; taxPercent: number };
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const iso = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
const brDate = (value: string) => new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

function presetRange(preset: "today" | "week" | "month") {
  const now = new Date();
  if (preset === "today") return { from: iso(now), to: iso(now) };
  if (preset === "week") {
    const start = new Date(now); const day = start.getDay(); start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    return { from: iso(start), to: iso(now) };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: iso(start), to: iso(now) };
}

export function CommissionReportPanel() {
  const { notify } = useToast();
  const initial = presetRange("month");
  const [preset, setPreset] = useState<"today" | "week" | "month" | "custom">("month");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [legacyRates, setLegacyRates] = useState<Record<string, { commission: string; tax: string }>>({});
  const load = useCallback(async () => {
    setLoading(true); setMessage("");
    try { const response = await fetch(`/api/financeiro/comissoes?from=${from}&to=${to}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setReport(payload); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível carregar as comissões."); }
    finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  function selectPreset(value: "today" | "week" | "month") { const range = presetRange(value); setPreset(value); setFrom(range.from); setTo(range.to); }
  async function correctLegacyItem(itemId: string) {
    const values = legacyRates[itemId] ?? { commission: String(report?.suggestedRates.commissionPercent ?? 0), tax: String(report?.suggestedRates.taxPercent ?? 0) };
    setCorrecting(itemId); setMessage("");
    try {
      const response = await fetch("/api/financeiro/comissoes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, commissionPercent: Number(values.commission), taxPercent: Number(values.tax) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível corrigir o item."); }
    finally { setCorrecting(null); }
  }
  const summary = report?.summary ?? { sales: 0, commissionBase: 0, commission: 0, tax: 0, estimatedResult: 0, closedQuotes: 0, averageCommissionPercent: 0 };

  function exportCommissionsCsv() {
    if (!report?.rows.length) {
      notify("Nenhuma comissão neste período para exportar.", "info");
      return;
    }
    downloadCsv(
      `comissoes-${from}-a-${to}`,
      ["Orçamento", "Data", "Status", "Cliente", "Serviço", "Venda", "Base comissionável", "Comissão", "Imposto", "Resultado estimado"],
      report.rows.map((row) => [
        `#${row.number}`,
        brDate(row.commercialAt),
        row.status === "convertido" ? "Fechado" : "Aprovado",
        row.customerName,
        row.service,
        row.sale,
        row.commissionBase,
        row.commission,
        row.tax,
        row.estimatedResult,
      ]),
    );
    notify(`Exportadas ${report.rows.length} linha(s) de comissões em CSV.`);
  }

  return (
    <section className={styles.panel}>
      <header className={styles.head}>
        <div>
          <small>RELATÓRIO COMERCIAL</small>
          <h2>Comissões de vendas aprovadas</h2>
          <p>Usa os percentuais e custos salvos no cálculo do orçamento. Propostas aprovadas e pedidos fechados entram no período.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="outline" onClick={exportCommissionsCsv} disabled={!report?.rows.length}>
            <Download />Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw />{loading ? "Atualizando" : "Atualizar"}
          </Button>
        </div>
      </header>

      <div className={styles.period}>
        <div className={styles.presets}>
          {([["today", "Hoje"], ["week", "Esta semana"], ["month", "Este mês"]] as const).map(([value, label]) => (
            <button key={value} className={preset === value ? styles.active : ""} onClick={() => selectPreset(value)}>{label}</button>
          ))}
          <button className={preset === "custom" ? styles.active : ""} onClick={() => setPreset("custom")}>Personalizado</button>
        </div>
        <label>De<Input type="date" value={from} onChange={(event) => { setPreset("custom"); setFrom(event.target.value); }} /></label>
        <label>Até<Input type="date" value={to} min={from} onChange={(event) => { setPreset("custom"); setTo(event.target.value); }} /></label>
      </div>

      {message && <div className={styles.message}><AlertTriangle />{message}</div>}

      <div className={styles.kpis}>
        <article><span><TrendingUp />Vendas com comissão</span><b>{currency.format(summary.sales)}</b><small>{summary.closedQuotes} orçamento(s) aprovado(s)</small></article>
        <article className={styles.commissionKpi}><span><CircleDollarSign />Comissão prevista</span><b>{currency.format(summary.commission)}</b><small>Média efetiva de {summary.averageCommissionPercent.toFixed(2)}%</small></article>
        <article><span><CalendarDays />Base comissionável</span><b>{currency.format(summary.commissionBase)}</b><small>Itens após desconto; frete excluído</small></article>
        <article><span><Check />Resultado estimado</span><b>{currency.format(summary.estimatedResult)}</b><small>Venda menos custos, impostos e comissão</small></article>
      </div>

      {Boolean(report?.missingCommercialMemory) && (
        <section className={styles.legacy}>
          <header><AlertTriangle /><span><b>Complete os percentuais de {report?.missingCommercialMemory} item(ns) antigo(s)</b><small>Isso atualiza somente a memória financeira; preço e proposta permanecem iguais.</small></span></header>
          {report?.unresolvedItems.map((item) => {
            const values = legacyRates[item.itemId] ?? { commission: String(report.suggestedRates.commissionPercent), tax: String(report.suggestedRates.taxPercent) };
            return (
              <article key={item.itemId}>
                <div className={styles.legacyItem}><small>ORÇAMENTO #{item.quoteNumber} · {item.customerName}</small><b>{item.description}</b><em>Base {currency.format(item.base)}</em></div>
                <label>Comissão (%)<Input type="number" min="0" max="99" step="0.01" value={values.commission} onChange={(event) => setLegacyRates((current) => ({ ...current, [item.itemId]: { ...values, commission: event.target.value } }))} /></label>
                <label>Nota (%)<Input type="number" min="0" max="99" step="0.01" value={values.tax} onChange={(event) => setLegacyRates((current) => ({ ...current, [item.itemId]: { ...values, tax: event.target.value } }))} /></label>
                <Button type="button" onClick={() => void correctLegacyItem(item.itemId)} disabled={correcting === item.itemId}><Check />{correcting === item.itemId ? "Salvando" : "Aplicar"}</Button>
              </article>
            );
          })}
        </section>
      )}

      {Boolean(report?.recoveredCommercialMemory) && <div className={styles.recovered}><Check /><span><b>{report?.recoveredCommercialMemory} item(ns) antigo(s) recuperado(s).</b> O sistema reconstruiu os percentuais usando a memória do preço e as regras comerciais cadastradas.</span></div>}

      <div className={styles.list}>
        {report?.rows.map((row) => (
          <details key={row.id}>
            <summary>
              <span><small>#{row.number} · {brDate(row.commercialAt)} · {row.status === "convertido" ? "FECHADO" : "APROVADO"}</small><b>{row.customerName}</b><em>{row.service}</em></span>
              <span><small>Venda</small><b>{currency.format(row.sale)}</b></span>
              <span className={styles.highlight}><small>Comissão</small><b>{currency.format(row.commission)}</b></span>
            </summary>
            <div className={styles.details}>
              {row.details.map((item, index) => (
                <article key={`${item.description}-${index}`}>
                  <div><b>{item.description}</b><small>Base após desconto: {currency.format(item.base)}{item.recovered ? " · percentual recuperado" : " · memória do cálculo"}</small></div>
                  <span>{item.taxPercent > 0 ? `Nota ${item.taxPercent}% · ${currency.format(item.tax)}` : "Sem nota"}</span>
                  <strong>{item.commissionPercent}% · {currency.format(item.commission)}</strong>
                </article>
              ))}
            </div>
          </details>
        ))}
        {!loading && !report?.rows.length && <div className={styles.empty}><CalendarDays /><b>Nenhuma comissão neste período</b><span>O relatório será preenchido quando uma proposta calculada com comissão for aprovada.</span></div>}
      </div>

      <footer className={styles.rule}><CircleDollarSign /><span><b>Regra usada</b> Percentual salvo no cálculo do item × valor após desconto proporcional. Orçamentos apenas aprovados aparecem como previsão; pedidos fechados ficam confirmados. Frete não entra na base.</span></footer>
    </section>
  );
}
