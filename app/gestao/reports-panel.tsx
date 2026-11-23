"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Boxes, BriefcaseBusiness, CalendarDays, Check, CircleDollarSign, Download, Factory, FileText, Printer, ReceiptText, RefreshCw, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "./toast-context";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const brDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
const statusLabels: Record<string, string> = { novo: "Novo", em_analise: "Em análise", aguardando_cliente: "Aguardando cliente", aprovado: "Aprovado", recusado: "Recusado", expirado: "Expirado", convertido: "Fechado" };
const stageLabels: Record<string, string> = { briefing: "Briefing", arte: "Arte", aprovacao: "Aprovação", aguardando_aprovacao: "Aguardando aprovação", fila: "Fila", producao: "Produção", acabamento: "Acabamento", expedicao: "Expedição", instalacao: "Instalação", concluido: "Concluído", cancelado: "Cancelado" };

type Ranking = { name: string; total: number };
type Report = {
  period: { from: string; to: string; previousFrom: string; previousTo: string };
  summary: { revenue: number; expenses: number; cashResult: number; openReceivables: number; openPayables: number; quoteCount: number; quoteValue: number; approvedCount: number; convertedCount: number; conversionRate: number; averageTicket: number; estimatedCommercialProfit: number; productionCount: number; stockValue: number; criticalStock: number };
  comparison: { revenue: number; expenses: number; cashResult: number; quoteCount: number; quoteValue: number };
  dre: { grossRevenue: number; variableExpenses: number; contributionMargin: number; fixedExpenses: number; operatingResult: number };
  cashForecast: Array<{ date: string; receivable: number; payable: number; balance: number; accumulated: number }>;
  expensesByCategory: Ranking[]; expensesBySupplier: Ranking[]; revenueByCustomer: Ranking[]; topServices: Ranking[];
  quoteStatuses: Array<{ status: string; count: number; total: number }>;
  productionStages: Array<{ stage: string; count: number }>;
  criticalItems: Array<{ id: string; name: string; category: string; unit: string; current: number; minimum: number }>;
  cashEntries: Array<{ id: string; date: string; customer: string; description: string; method: string; amount: number }>;
  cashExpenses: Array<{ id: string; date: string; amount: number; description: string; category: string; classification: string; supplier: string; costCenter: string }>;
  quotes: Array<{ id: string; number: number; customer: string; service: string; status: string; value: number; cost: number; estimatedProfit: number; createdAt: string }>;
};

function monthRange(offset = 0) {
  const now = new Date(); now.setMonth(now.getMonth() + offset);
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 12);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}
function change(current: number, previous: number) { return previous ? (current - previous) / Math.abs(previous) * 100 : current ? 100 : 0; }
function ChangeBadge({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  if (!previous) return <small className="report-change neutral">Sem base no período anterior</small>;
  const value = change(current, previous); const positive = inverse ? value <= 0 : value >= 0;
  return <small className={`report-change ${positive ? "positive" : "negative"}`}>{value >= 0 ? <TrendingUp/> : <TrendingDown/>}{value >= 0 ? "+" : ""}{decimal.format(value)}% vs. período anterior</small>;
}
function RankingList({ rows, empty }: { rows: Ranking[]; empty: string }) {
  const max = Math.max(...rows.map((item) => item.total), 1);
  return rows.length ? <div className="report-ranking">{rows.map((item) => <article key={item.name}><div><b>{item.name}</b><strong>{currency.format(item.total)}</strong></div><i><span style={{ width: `${item.total / max * 100}%` }}/></i></article>)}</div> : <div className="report-empty">{empty}</div>;
}
const csvCell = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? `"${value.toFixed(2).replace(".", ",")}"` : '""';
  let text = String(value ?? "").replace(/\r\n/g, " ").replace(/[\r\n]/g, " ");
  if (/^[=+\-@\t]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

export function ReportsPanel() {
  const { notify } = useToast();
  const initial = monthRange();
  const [from, setFrom] = useState(initial.from); const [to, setTo] = useState(initial.to);
  const [view, setView] = useState<"executivo" | "financeiro" | "comercial" | "operacao">("executivo");
  const [report, setReport] = useState<Report | null>(null); const [loading, setLoading] = useState(true); const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setMessage("");
    try { const response = await fetch(`/api/gestao/relatorios?from=${from}&to=${to}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setReport(payload.report); }
    catch (error) { setMessage((error as Error).message); } finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const margin = report?.summary.quoteValue ? report.summary.estimatedCommercialProfit / report.summary.quoteValue * 100 : 0;
  const detailedCsv = useMemo(() => {
    if (!report) return "";
    const rows: unknown[][] = [
      ["RELATÓRIO GERENCIAL", `${brDate(report.period.from)} a ${brDate(report.period.to)}`], [],
      ["RESUMO"], ["Indicador", "Valor"], ["Entradas realizadas", report.summary.revenue], ["Saídas realizadas", report.summary.expenses], ["Resultado de caixa", report.summary.cashResult], ["Contas a receber", report.summary.openReceivables], ["Contas a pagar", report.summary.openPayables], ["Orçamentos", report.summary.quoteCount], ["Valor orçado", report.summary.quoteValue], ["Conversão (%)", report.summary.conversionRate], ["Ticket médio", report.summary.averageTicket], [],
      ["ENTRADAS"], ["Data", "Cliente", "Descrição", "Forma", "Valor"], ...report.cashEntries.map((item) => [item.date, item.customer, item.description, item.method, item.amount]), [],
      ["DESPESAS"], ["Data", "Fornecedor", "Descrição", "Categoria", "Centro de custo", "Valor"], ...report.cashExpenses.map((item) => [item.date, item.supplier, item.description, item.category, item.costCenter, item.amount]), [],
      ["ORÇAMENTOS"], ["Número", "Cliente", "Serviço", "Status", "Venda", "Custo", "Resultado estimado"], ...report.quotes.map((item) => [item.number, item.customer, item.service, statusLabels[item.status] ?? item.status, item.value, item.cost, item.estimatedProfit]),
    ];
    return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  }, [report]);
  function exportCsv() { if (!detailedCsv) return; const blob = new Blob([detailedCsv], { type: "text/csv;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `relatorio-gerencial-${from}-${to}.csv`; link.click(); URL.revokeObjectURL(link.href); notify("Relatório gerencial exportado em CSV."); }
  function preset(offset: number) { const range = monthRange(offset); setFrom(range.from); setTo(range.to); }

  return <section className="reports-workspace">
    <header className="reports-head"><div><small>INTELIGÊNCIA GERENCIAL</small><h1>Centro de relatórios</h1><p>Financeiro, vendas, produção e estoque reunidos para decisões mais seguras.</p></div><div className="reports-actions no-print"><Button variant="outline" onClick={exportCsv} disabled={!report}><Download/>Exportar CSV</Button><Button variant="outline" onClick={() => window.print()} disabled={!report}><Printer/>Salvar PDF</Button></div></header>
    <div className="reports-period no-print"><div><button onClick={() => preset(0)}>Este mês</button><button onClick={() => preset(-1)}>Mês anterior</button></div><label>De<Input type="date" value={from} onChange={(event) => setFrom(event.target.value)}/></label><label>Até<Input type="date" value={to} onChange={(event) => setTo(event.target.value)}/></label><Button onClick={() => void load()} disabled={loading}><RefreshCw/>{loading ? "Consolidando..." : "Atualizar"}</Button></div>
    <nav className="reports-nav no-print"><button className={view === "executivo" ? "active" : ""} onClick={() => setView("executivo")}><BarChart3/>Executivo</button><button className={view === "financeiro" ? "active" : ""} onClick={() => setView("financeiro")}><WalletCards/>Financeiro</button><button className={view === "comercial" ? "active" : ""} onClick={() => setView("comercial")}><BriefcaseBusiness/>Comercial</button><button className={view === "operacao" ? "active" : ""} onClick={() => setView("operacao")}><Factory/>Operação</button></nav>
    {message && <div className="reports-message"><AlertTriangle/>{message}</div>}
    {report && <>
      <div className="reports-print-title"><b>Relatório gerencial</b><span>{brDate(report.period.from)} a {brDate(report.period.to)}</span></div>
      {(view === "executivo" || view === "financeiro") && <>
        <div className="report-kpis"><article className="revenue"><span><CircleDollarSign/>Entradas realizadas</span><b>{currency.format(report.summary.revenue)}</b><ChangeBadge current={report.summary.revenue} previous={report.comparison.revenue}/></article><article className="expense"><span><ReceiptText/>Saídas realizadas</span><b>{currency.format(report.summary.expenses)}</b><ChangeBadge current={report.summary.expenses} previous={report.comparison.expenses} inverse/></article><article className={report.summary.cashResult < 0 ? "danger" : "result"}><span><WalletCards/>Resultado de caixa</span><b>{currency.format(report.summary.cashResult)}</b><ChangeBadge current={report.summary.cashResult} previous={report.comparison.cashResult}/></article><article><span><CalendarDays/>Compromissos do período</span><b>{currency.format(report.summary.openReceivables - report.summary.openPayables)}</b><small>{currency.format(report.summary.openReceivables)} a receber · {currency.format(report.summary.openPayables)} a pagar</small></article></div>
        <div className="reports-grid"><article className="report-card"><header><div><small>DESPESAS</small><h2>Por categoria</h2></div><ReceiptText/></header><RankingList rows={report.expensesByCategory} empty="Nenhuma despesa paga neste período."/></article><article className="report-card"><header><div><small>FORNECEDORES</small><h2>Maiores pagamentos</h2></div><FileText/></header><RankingList rows={report.expensesBySupplier} empty="Nenhum fornecedor movimentado."/></article><article className="report-card"><header><div><small>RECEITA</small><h2>Entradas por cliente</h2></div><CircleDollarSign/></header><RankingList rows={report.revenueByCustomer} empty="Nenhuma entrada recebida."/></article></div>
      </>}
      {view === "financeiro" && <><div className="report-section-title"><div><small>GESTÃO FINANCEIRA</small><h2>DRE gerencial e fluxo projetado</h2></div><span>Regime de caixa no período selecionado</span></div><div className="reports-grid two"><article className="report-card"><header><div><small>RESULTADO</small><h2>DRE gerencial</h2></div><TrendingUp/></header><div className="dre-lines"><span><b>Receita bruta recebida</b><strong>{currency.format(report.dre.grossRevenue)}</strong></span><span><b>(−) Custos e despesas variáveis</b><strong className="negative">{currency.format(report.dre.variableExpenses)}</strong></span><span><b>(=) Margem de contribuição</b><strong>{currency.format(report.dre.contributionMargin)}</strong></span><span><b>(−) Custos e despesas fixas</b><strong className="negative">{currency.format(report.dre.fixedExpenses)}</strong></span><span className="total"><b>(=) Resultado operacional</b><strong className={report.dre.operatingResult < 0 ? "negative" : "positive"}>{currency.format(report.dre.operatingResult)}</strong></span></div></article><article className="report-card"><header><div><small>PREVISÃO</small><h2>Fluxo de caixa projetado</h2></div><CalendarDays/></header><div className="cash-forecast-list">{report.cashForecast.map((item) => <span key={item.date}><time>{brDate(item.date)}</time><small>+ {currency.format(item.receivable)} · − {currency.format(item.payable)}</small><b className={item.accumulated < 0 ? "negative" : "positive"}>{currency.format(item.accumulated)}</b></span>)}{!report.cashForecast.length && <div className="report-empty">Nenhum vencimento futuro neste período.</div>}</div></article></div></>}
      {(view === "executivo" || view === "comercial") && <>
        <div className="report-section-title"><div><small>COMERCIAL</small><h2>Desempenho dos orçamentos</h2></div><span>{report.summary.quoteCount} proposta(s) no período</span></div>
        <div className="report-kpis compact"><article><span><FileText/>Valor orçado</span><b>{currency.format(report.summary.quoteValue)}</b><ChangeBadge current={report.summary.quoteValue} previous={report.comparison.quoteValue}/></article><article><span><Check/>Conversão</span><b>{decimal.format(report.summary.conversionRate)}%</b><small>{report.summary.convertedCount} fechado(s) · {report.summary.approvedCount} aprovado(s)</small></article><article><span><CircleDollarSign/>Ticket médio fechado</span><b>{currency.format(report.summary.averageTicket)}</b><small>Valor médio dos pedidos convertidos</small></article><article><span><TrendingUp/>Resultado estimado</span><b>{currency.format(report.summary.estimatedCommercialProfit)}</b><small>Margem estimada de {decimal.format(margin)}%</small></article></div>
        <div className="reports-grid two"><article className="report-card"><header><div><small>FUNIL</small><h2>Status das propostas</h2></div><BriefcaseBusiness/></header><div className="report-statuses">{report.quoteStatuses.map((item) => <span key={item.status}><i>{item.count}</i><b>{statusLabels[item.status] ?? item.status}</b><strong>{currency.format(item.total)}</strong></span>)}</div></article><article className="report-card"><header><div><small>PORTFÓLIO</small><h2>Serviços mais orçados</h2></div><BarChart3/></header><RankingList rows={report.topServices} empty="Nenhum serviço orçado."/></article></div>
      </>}
      {(view === "executivo" || view === "operacao") && <>
        <div className="report-section-title"><div><small>OPERAÇÃO</small><h2>Produção e estoque</h2></div><span>{report.summary.productionCount} ordem(ns) criada(s)</span></div>
        <div className="reports-grid two"><article className="report-card"><header><div><small>PRODUÇÃO</small><h2>Ordens por etapa</h2></div><Factory/></header><div className="report-statuses">{report.productionStages.map((item) => <span key={item.stage}><i>{item.count}</i><b>{stageLabels[item.stage] ?? item.stage}</b></span>)}{!report.productionStages.length && <div className="report-empty">Nenhuma ordem criada no período.</div>}</div></article><article className="report-card"><header><div><small>ESTOQUE ATUAL</small><h2>Valor e alertas</h2></div><Boxes/></header><div className="stock-report-summary"><span><small>Valor estimado em estoque</small><b>{currency.format(report.summary.stockValue)}</b></span><span className={report.summary.criticalStock ? "danger" : "ok"}><small>Itens abaixo do mínimo</small><b>{report.summary.criticalStock}</b></span></div>{report.criticalItems.map((item) => <div className="stock-report-item" key={item.id}><span><b>{item.name}</b><small>{item.category}</small></span><strong>{item.current} {item.unit} / mínimo {item.minimum}</strong></div>)}</article></div>
      </>}
      {view === "financeiro" && <section className="report-detail-table"><header><small>LANÇAMENTOS</small><h2>Movimentações realizadas</h2></header><div><table><thead><tr><th>Data</th><th>Descrição</th><th>Origem</th><th>Entrada</th><th>Saída</th></tr></thead><tbody>{report.cashEntries.map((item) => <tr key={`in-${item.id}`}><td>{brDate(item.date)}</td><td>{item.description}</td><td>{item.customer}</td><td className="positive">{currency.format(item.amount)}</td><td>—</td></tr>)}{report.cashExpenses.map((item) => <tr key={`out-${item.id}`}><td>{brDate(item.date)}</td><td>{item.description}</td><td>{item.supplier} · {item.category}</td><td>—</td><td className="negative">{currency.format(item.amount)}</td></tr>)}{!report.cashEntries.length && !report.cashExpenses.length && <tr><td colSpan={5}>Nenhuma movimentação no período.</td></tr>}</tbody></table></div></section>}
      {view === "comercial" && <section className="report-detail-table"><header><small>PROPOSTAS</small><h2>Resultado por orçamento</h2></header><div><table><thead><tr><th>Nº</th><th>Cliente / serviço</th><th>Status</th><th>Venda</th><th>Custo</th><th>Resultado</th></tr></thead><tbody>{report.quotes.map((item) => <tr key={item.id}><td>#{item.number}</td><td><b>{item.customer}</b><small>{item.service}</small></td><td>{statusLabels[item.status] ?? item.status}</td><td>{currency.format(item.value)}</td><td>{currency.format(item.cost)}</td><td className={item.estimatedProfit < 0 ? "negative" : "positive"}>{currency.format(item.estimatedProfit)}</td></tr>)}</tbody></table></div></section>}
    </>}
  </section>;
}
