"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Boxes, CalendarClock, Check, CheckCircle2, CircleDollarSign, ClipboardCheck, ClipboardList, Columns3, Factory, FileText, Gauge, GripVertical, LayoutGrid, MessageCircle, PackageCheck, Palette, Play, Plus, Printer, RefreshCw, Sparkles, Tag, Target, TrendingUp, Tv, Users, WalletCards, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { whatsappUrl } from "@/lib/whatsapp";
import { useToast } from "./toast-context";
import { CashflowBarLineChart, CommercialFunnelChart, type CashSeriesPoint, type CommercialFunnelData } from "./executive-charts";
import { OsQrCode } from "./os-qr-code";
import { OsShippingLabelsDialog } from "./os-shipping-labels";
import { ShopFloorTvBoard } from "./shop-floor-tv-board";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const showDate = (value?: string | null) => value ? new Date(value).toLocaleDateString("pt-BR") : "—";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Não foi possível concluir a operação.");
  return payload;
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="module-heading"><div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>{action}</header>;
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Boxes; title: string; text: string }) {
  return <div className="empty-state"><Icon/><b>{title}</b><p>{text}</p></div>;
}

function Feedback({ message }: { message: string }) {
  if (!message) return null;
  const success = message.startsWith("OK:");
  return <div className={`module-feedback ${success ? "success" : ""}`}>{success ? <Check/> : <X/>}{message.replace(/^OK:/, "")}</div>;
}

type Dashboard = {
  permissions?: { finance: boolean; receivables: boolean };
  onboarding?: { companyConfigured: boolean; pricingConfigured: boolean; portalEnabled: boolean; hasQuote: boolean; canManageDemo?: boolean; hasDemoData?: boolean };
  revenue: number; openQuotes: number; openQuoteValue: number; approvedQuotes: number; approvedPendingProduction: number; unpaidClosedQuotes: number; unpaidClosedValue: number; overdueReceivableQuotes: number; overdueReceivableValue: number; followUpQuotesDue: number; expiringQuotes: number; productionOrders: number; overdueProduction: number; criticalStock: number; customerCount: number;
  recentQuotes: Array<{ id: string; number: number; customerName: string; service: string; status: string; value: number; createdAt: string; validUntil?: string | null }>;
  productionByStage: Array<{ stage: string; count: number }>;
  monthlyCashflow?: CashSeriesPoint[];
  commercialFunnel?: CommercialFunnelData;
  criticalItems: Array<{ id: string; name: string; unit: string; current: number; minimum: number }>;
  breakEven: { configured: boolean; grossRevenue: number; fixedCosts: number; variableCosts: number; contribution: number; accounting: number; financial: number; economic: number; remaining: number; progress: number; contributionRate: number; dailyTarget: number; calculationBasis: "realized" | "projected" | "incomplete"; historicalMonths: number; recurringSource: "current" | "previous" | "pricing" | "empty"; recurringSourceMonth: string | null };
};

const emptyDashboard: Dashboard = { revenue: 0, openQuotes: 0, openQuoteValue: 0, approvedQuotes: 0, approvedPendingProduction: 0, unpaidClosedQuotes: 0, unpaidClosedValue: 0, overdueReceivableQuotes: 0, overdueReceivableValue: 0, followUpQuotesDue: 0, expiringQuotes: 0, productionOrders: 0, overdueProduction: 0, criticalStock: 0, customerCount: 0, recentQuotes: [], productionByStage: [], criticalItems: [], breakEven: { configured: false, grossRevenue: 0, fixedCosts: 0, variableCosts: 0, contribution: 0, accounting: 0, financial: 0, economic: 0, remaining: 0, progress: 0, contributionRate: 0, dailyTarget: 0, calculationBasis: "incomplete", historicalMonths: 0, recurringSource: "empty", recurringSourceMonth: null } };
const overviewStatus: Record<string, string> = { novo: "Novo", em_analise: "Em análise", aguardando_cliente: "Aguardando cliente", aprovado: "Aprovado", recusado: "Recusado", expirado: "Expirado", convertido: "Fechado" };
const stageLabel: Record<string, string> = { briefing: "Aguardando programação", arte: "Arte", aprovacao: "Aprovação", producao: "Produção", acabamento: "Acabamento", expedicao: "Expedição", instalacao: "Instalação", concluido: "Concluído", cancelado: "Cancelado" };

export function OverviewPanel({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { notify } = useToast();
  const [data, setData] = useState<Dashboard>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [demoBusy, setDemoBusy] = useState(false);
  const load = useCallback(() => api<{ dashboard: Dashboard }>("/api/gestao/dashboard").then((result) => setData(result.dashboard)).finally(() => setLoading(false)), []);
  useEffect(() => { load().catch(() => setLoading(false)); }, [load]);

  async function toggleDemoData(mode: "seed" | "clear") {
    setDemoBusy(true);
    try {
      const result = await api<{ message: string }>("/api/gestao/exemplo", { method: mode === "seed" ? "POST" : "DELETE" });
      notify(result.message);
      await load();
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setDemoBusy(false);
    }
  }
  const empty = !loading && data.revenue === 0 && data.openQuotes === 0 && data.productionOrders === 0 && data.criticalStock === 0;
  const maxStage = Math.max(...data.productionByStage.map((item) => item.count), 1);
  const breakEvenNegative = data.breakEven.configured && data.breakEven.grossRevenue > 0 && data.breakEven.contributionRate <= 0;
  const breakEvenReady = data.breakEven.configured && data.breakEven.accounting > 0;
  const breakEvenProjected = breakEvenReady && data.breakEven.calculationBasis === "projected";
  const recurringSource = data.breakEven.recurringSource === "previous"
    ? `configuração recorrente de ${data.breakEven.recurringSourceMonth ? new Date(`${data.breakEven.recurringSourceMonth}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "competência anterior"}`
    : data.breakEven.recurringSource === "pricing" ? "custos fixos cadastrados na Precificação" : "competência atual";
  const canViewFinance = data.permissions?.finance ?? true;
  const canViewReceivables = data.permissions?.receivables ?? true;
  const onboardingSteps = data.onboarding ? [
    { key: "company", done: data.onboarding.companyConfigured, title: "Identidade da empresa", desc: "Logo, CNPJ e WhatsApp para propostas", target: "empresa" },
    { key: "pricing", done: data.onboarding.pricingConfigured, title: "Regras de precificação", desc: "Margem, custos e insumos base", target: "precificacao" },
    { key: "portal", done: data.onboarding.portalEnabled, title: "Portal público /p/slug", desc: "Receba pedidos de clientes pelo link", target: "empresa" },
    { key: "quote", done: data.onboarding.hasQuote, title: "Primeiro orçamento", desc: "Crie e envie sua primeira proposta", target: "orcamentos" },
  ] : [];
  const onboardingCompleted = onboardingSteps.filter((step) => step.done).length;
  const showOnboarding = !loading && onboardingSteps.length > 0 && onboardingCompleted < onboardingSteps.length;
  const today = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date());
  return <>
    <header className="overview-hero"><div><p>PAINEL EXECUTIVO</p><h1>Visão geral da operação</h1><span className="overview-date">{today}</span><small>Comercial, produção, estoque e financeiro reunidos em uma leitura rápida.</small></div><Button variant="outline" onClick={() => load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""}/>{loading ? "Atualizando" : "Atualizar dados"}</Button></header>
    {showOnboarding && (
      <section className="onboarding-checklist" aria-label="Checklist de primeiros passos">
        <div className="onboarding-checklist-head">
          <div>
            <small>PRIMEIROS PASSOS</small>
            <h2>Deixe o NexoFab pronto para vender</h2>
            <p>Conclua estas etapas rápidas para aproveitar ao máximo o período de avaliação.</p>
          </div>
          <div className="onboarding-checklist-progress">
            <b>{onboardingCompleted} de {onboardingSteps.length}</b>
            <div className="onboarding-checklist-bar"><span style={{ width: `${(onboardingCompleted / onboardingSteps.length) * 100}%` }}/></div>
          </div>
        </div>
        <div className="onboarding-checklist-steps">
          {onboardingSteps.map((step) => (
            <button key={step.key} type="button" className={`onboarding-step ${step.done ? "done" : ""}`} onClick={() => onNavigate(step.target)}>
              <span className="onboarding-step-icon">{step.done ? <Check/> : <ArrowRight/>}</span>
              <div><b>{step.title}</b><small>{step.desc}</small></div>
            </button>
          ))}
        </div>
        {data.onboarding?.canManageDemo && !data.onboarding.hasQuote && !data.onboarding.hasDemoData && (
          <div className="onboarding-demo-bar">
            <span><Sparkles/>Quer explorar o sistema preenchido em 10 segundos? Carregue um conjunto de exemplo (insumos, máquina, cliente e orçamento).</span>
            <Button type="button" size="sm" variant="outline" disabled={demoBusy} onClick={() => void toggleDemoData("seed")}>
              <Sparkles/>{demoBusy ? "Carregando..." : "Carregar dados de exemplo"}
            </Button>
          </div>
        )}
      </section>
    )}
    {!loading && data.onboarding?.canManageDemo && data.onboarding.hasDemoData && (
      <div className="onboarding-demo-bar active">
        <span><Sparkles/>Existem registros demonstrativos <b>[Exemplo]</b> nesta empresa. Quando começar a operar de verdade, remova tudo com 1 clique.</span>
        <Button type="button" size="sm" variant="outline" disabled={demoBusy} onClick={() => void toggleDemoData("clear")}>
          <X/>{demoBusy ? "Removendo..." : "Remover dados de exemplo"}
        </Button>
      </div>
    )}
    {canViewFinance && <section className={`overview-break-even ${breakEvenReady ? "ready" : breakEvenNegative ? "danger" : "pending"}`}>
      <div className={`overview-break-even-ring ${breakEvenNegative ? "negative" : ""}`} style={{ "--progress": `${breakEvenReady ? Math.min(Math.max(data.breakEven.progress, 0), 100) : 0}%` } as React.CSSProperties}><div><b>{breakEvenReady ? `${Math.round(data.breakEven.progress)}%` : breakEvenNegative ? `${data.breakEven.contributionRate.toFixed(1)}%` : "—"}</b><span>{breakEvenNegative ? "margem" : "da meta"}</span></div></div>
      <div className="overview-break-even-main"><small>CORAÇÃO DA GESTÃO {breakEvenReady && <span className={`overview-break-even-basis ${breakEvenProjected ? "projected" : "realized"}`}>{breakEvenProjected ? "PROJETADO" : "REALIZADO"}</span>}</small><h2>Ponto de equilíbrio do mês</h2>{breakEvenReady ? <><strong>{currency.format(data.breakEven.accounting)}</strong><p>{breakEvenProjected ? <>Margem média de <b>{data.breakEven.historicalMonths} competência(s)</b> · custos vindos da {recurringSource}</> : <>{currency.format(data.breakEven.grossRevenue)} realizados · <b>{currency.format(data.breakEven.remaining)} ainda necessários para cobrir a operação</b></>}</p><i><em style={{ width: `${Math.min(Math.max(data.breakEven.progress, 0), 100)}%` }}/></i></> : breakEvenNegative ? <><strong>Margem negativa — não calculável</strong><p>{currency.format(data.breakEven.grossRevenue)} de receita − {currency.format(data.breakEven.variableCosts)} variáveis = <b>{currency.format(data.breakEven.contribution)} de contribuição</b></p></> : <><strong>{data.breakEven.configured ? "Complete a competência" : "Configure a competência"}</strong><p>Cadastre custos fixos e tenha ao menos uma competência anterior com receita e custos variáveis para gerar a projeção automática.</p></>}</div>
      <div className="overview-break-even-metrics"><span><small>Equilíbrio financeiro</small><b>{breakEvenReady ? currency.format(data.breakEven.financial) : breakEvenNegative ? "Não calculável" : "—"}</b></span><span><small>Meta com lucro</small><b>{breakEvenReady ? currency.format(data.breakEven.economic) : breakEvenNegative ? "Não calculável" : "—"}</b></span><span><small>Custos fixos</small><b>{data.breakEven.configured ? currency.format(data.breakEven.fixedCosts) : "—"}</b></span><span className={breakEvenNegative ? "danger" : ""}><small>Margem de contribuição</small><b>{breakEvenReady ? `${data.breakEven.contributionRate.toFixed(1)}%${breakEvenProjected ? " projetada" : ` · ${currency.format(data.breakEven.contribution)}`}` : "—"}</b></span></div>
      <Button type="button" variant="outline" onClick={() => onNavigate("ponto-equilibrio")}><Target/>{data.breakEven.configured ? "Ver análise completa" : "Configurar agora"}<ArrowRight/></Button>
    </section>}
    <section className="overview-kpis">
      {canViewFinance && <button className="primary" onClick={() => onNavigate("financeiro")}><span className="overview-kpi-icon"><WalletCards/></span><small>Recebido no mês</small><b>{currency.format(data.revenue)}</b><em>Entradas confirmadas</em><ArrowRight/></button>}
      <button onClick={() => onNavigate("orcamentos")}><span className="overview-kpi-icon"><TrendingUp/></span><small>Carteira em aberto</small><b>{currency.format(data.openQuoteValue)}</b><em>{data.openQuotes} proposta(s) · {data.approvedQuotes} aprovada(s)</em><ArrowRight/></button>
      <button className={data.overdueProduction ? "attention" : ""} onClick={() => onNavigate("producao")}><span className="overview-kpi-icon"><Factory/></span><small>Produção ativa</small><b>{data.productionOrders} <i>ordens</i></b><em>{data.overdueProduction ? `${data.overdueProduction} prazo(s) vencido(s)` : "Nenhum prazo vencido"}</em><ArrowRight/></button>
      <button className={data.criticalStock ? "attention" : ""} onClick={() => onNavigate("estoque")}><span className="overview-kpi-icon"><Boxes/></span><small>Estoque crítico</small><b>{data.criticalStock} <i>itens</i></b><em>{data.criticalStock ? "Reposição requer atenção" : "Estoque sem alertas"}</em><ArrowRight/></button>
    </section>

    <section className={`overview-charts-grid ${canViewFinance ? "" : "single"}`}>
      {canViewFinance && (
        <article className="overview-card">
          <header>
            <div><small>RESULTADO REALIZADO · 6 MESES</small><h2>Faturamento × Despesas × Saldo</h2></div>
            <button onClick={() => onNavigate("relatorios")}>Ver relatórios <ArrowRight/></button>
          </header>
          <div className="exec-chart-card-body">
            <CashflowBarLineChart data={data.monthlyCashflow ?? []} />
          </div>
        </article>
      )}
      <article className="overview-card">
        <header>
          <div><small>DESEMPENHO COMERCIAL</small><h2>Funil de conversão e ticket médio</h2></div>
          <button onClick={() => onNavigate("orcamentos")}>Abrir funil <ArrowRight/></button>
        </header>
        <div className="exec-chart-card-body">
          <CommercialFunnelChart
            data={data.commercialFunnel ?? {
              totalCount: 0,
              totalValue: 0,
              negotiatingCount: 0,
              negotiatingValue: 0,
              approvedCount: 0,
              approvedValue: 0,
              convertedCount: 0,
              convertedValue: 0,
              conversionRate: 0,
              averageTicket: 0,
            }}
          />
        </div>
      </article>
    </section>

    <section className="overview-main-grid">
      <article className="overview-card commercial-overview"><header><div><small>COMERCIAL</small><h2>Movimento das propostas</h2></div><button onClick={() => onNavigate("orcamentos")}>Ver orçamentos <ArrowRight/></button></header>{data.recentQuotes.length ? <div className="overview-quote-list">{data.recentQuotes.map((quote) => <button key={quote.id} onClick={() => onNavigate("orcamentos")}><span className={`overview-status ${quote.status}`}>{overviewStatus[quote.status] ?? quote.status}</span><div><b>#{quote.number} · {quote.customerName}</b><small>{quote.service}</small></div><strong>{currency.format(quote.value)}</strong></button>)}</div> : <div className="overview-card-empty"><ClipboardList/><b>Nenhuma proposta ainda</b><span>O primeiro orçamento aparecerá aqui automaticamente.</span><Button size="sm" onClick={() => onNavigate("orcamentos")}><Plus/>Criar orçamento</Button></div>}</article>

      <article className="overview-card production-overview"><header><div><small>CHÃO DE FÁBRICA</small><h2>Distribuição da produção</h2></div><button onClick={() => onNavigate("producao")}>Abrir produção <ArrowRight/></button></header>{data.productionByStage.length ? <div className="stage-overview">{data.productionByStage.map((item) => <div key={item.stage}><span><b>{stageLabel[item.stage] ?? item.stage}</b><strong>{item.count}</strong></span><i><em style={{ width: `${Math.max(8, item.count / maxStage * 100)}%` }}/></i></div>)}</div> : <div className="overview-card-empty compact"><Factory/><b>Fila de produção livre</b><span>Ordens surgem aqui quando um orçamento é fechado.</span></div>}</article>

      <article className="overview-card attention-overview"><header><div><small>CENTRAL DE ATENÇÃO</small><h2>O que precisa de ação</h2></div><Gauge/></header><div className="attention-list">{data.followUpQuotesDue > 0 && <button onClick={() => onNavigate("orcamentos")}><span className="warning"><ClipboardList/></span><div><b>{data.followUpQuotesDue} proposta(s) aguardando retorno há pelo menos 2 dias</b><small>Entre em contato para confirmar interesse, dúvida ou fechamento.</small></div><ArrowRight/></button>}{data.expiringQuotes > 0 && <button onClick={() => onNavigate("orcamentos")}><span className="warning"><AlertTriangle/></span><div><b>{data.expiringQuotes} proposta(s) vencem nos próximos 2 dias</b><small>Faça o retorno antes de perder a validade comercial.</small></div><ArrowRight/></button>}{canViewReceivables && data.overdueReceivableQuotes > 0 && <button onClick={() => onNavigate("financeiro")}><span className="danger"><CircleDollarSign/></span><div><b>{data.overdueReceivableQuotes} cliente(s) com pagamento vencido</b><small>{currency.format(data.overdueReceivableValue)} em atraso.</small></div><ArrowRight/></button>}{canViewReceivables && data.unpaidClosedQuotes > 0 && <button onClick={() => onNavigate("financeiro")}><span className="danger"><CircleDollarSign/></span><div><b>{data.unpaidClosedQuotes} pedido(s) fechado(s) com saldo em aberto</b><small>{currency.format(data.unpaidClosedValue)} aguardando recebimento.</small></div><ArrowRight/></button>}{data.approvedPendingProduction > 0 && <button onClick={() => onNavigate("orcamentos")}><span className="warning"><ClipboardList/></span><div><b>{data.approvedPendingProduction} orçamento(s) aprovado(s) aguardando fechamento</b><small>Confirme pagamento e gere a ordem de produção.</small></div><ArrowRight/></button>}{data.overdueProduction > 0 && <button onClick={() => onNavigate("producao")}><span className="danger"><AlertTriangle/></span><div><b>{data.overdueProduction} ordem(ns) com prazo vencido</b><small>Revise a prioridade e a etapa atual.</small></div><ArrowRight/></button>}{data.criticalItems.map((item) => <button key={item.id} onClick={() => onNavigate("estoque")}><span className="warning"><Boxes/></span><div><b>{item.name}</b><small>Saldo {item.current} {item.unit} · mínimo {item.minimum} {item.unit}</small></div><ArrowRight/></button>)}{data.followUpQuotesDue === 0 && data.expiringQuotes === 0 && (!canViewReceivables || data.unpaidClosedQuotes === 0) && data.approvedPendingProduction === 0 && data.overdueProduction === 0 && !data.criticalItems.length && <div className="attention-clear"><PackageCheck/><div><b>Nenhuma pendência crítica</b><small>Cobranças, aprovações, prazos e estoque estão sob controle.</small></div></div>}</div></article>

      <article className="overview-card shortcuts-overview"><header><div><small>ATALHOS</small><h2>Comece por aqui</h2></div><Sparkles/></header><div className="overview-shortcuts"><button onClick={() => onNavigate("orcamentos")}><ClipboardList/><span><b>Novo orçamento</b><small>Calcular e enviar proposta</small></span><ArrowRight/></button><button onClick={() => onNavigate("precificacao")}><CircleDollarSign/><span><b>Precificação</b><small>Insumos, máquinas e margens</small></span><ArrowRight/></button><button onClick={() => onNavigate("clientes")}><Users/><span><b>Clientes</b><small>{data.customerCount} cadastro(s) ativo(s)</small></span><ArrowRight/></button>{canViewFinance && <button onClick={() => onNavigate("financeiro")}><WalletCards/><span><b>Financeiro</b><small>Contas e ponto de equilíbrio</small></span><ArrowRight/></button>}</div></article>
    </section>
    {empty && <section className="overview-onboarding"><span><Sparkles/></span><div><small>PRIMEIROS PASSOS</small><h2>Seu painel está pronto para receber a operação real</h2><p>Cadastre os custos, monte o primeiro orçamento e os indicadores serão preenchidos automaticamente — sem dados fictícios.</p></div><Button onClick={() => onNavigate("precificacao")}>Configurar precificação <ArrowRight/></Button></section>}
  </>;
}

type Quote = { id: string; number: number; customerName: string; company?: string | null; phone: string; email?: string | null; service: string; dimensions?: string | null; material: string; details?: string | null; quantity: number; status: string; createdAt: string; estimatedValue: number | null };

export function QuotesPanel({ search }: { search: string }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [closing, setClosing] = useState<Quote | null>(null);
  const [message, setMessage] = useState("");
  const load = useCallback(() => api<{ quotes: Quote[] }>("/api/orcamentos").then((result) => setQuotes(result.quotes)).finally(() => setLoading(false)), []);
  useEffect(() => { load().catch((error: Error) => setMessage(error.message)); }, [load]);
  const filtered = useMemo(() => quotes.filter((quote) => `${quote.number} ${quote.customerName} ${quote.service} ${quote.status}`.toLowerCase().includes(search.toLowerCase())), [quotes, search]);

  async function changeStatus(id: string, status: string) {
    try { await api("/api/orcamentos", { method: "PATCH", body: JSON.stringify({ id, status }) }); await load(); setMessage("OK:Status atualizado."); } catch (error) { setMessage((error as Error).message); }
  }

  return <>
    <SectionHeading eyebrow="COMERCIAL" title="Orçamentos" description="Propostas recebidas pelo site e cadastradas pela equipe." action={<Button onClick={() => setNewOpen(true)}><Plus/>Novo orçamento</Button>}/>
    <Feedback message={message}/>
    {newOpen && <NewQuoteForm onClose={() => setNewOpen(false)} onSaved={() => { setNewOpen(false); load(); }}/>} 
    {closing && <CloseQuoteForm quote={closing} onClose={() => setClosing(null)} onSaved={() => { setClosing(null); load(); setMessage("OK:Orçamento fechado, entrada registrada e ordem de produção criada."); }}/>} 
    {!loading && !filtered.length ? <EmptyState icon={ClipboardList} title="Nenhum orçamento cadastrado" text="Cadastre o primeiro orçamento ou aguarde uma solicitação enviada pelo site."/> : <div className="module-table"><Table><TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Cliente / serviço</TableHead><TableHead>Contato</TableHead><TableHead>Status</TableHead><TableHead>Valor</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{filtered.map((quote) => <TableRow key={quote.id}><TableCell>#{quote.number}</TableCell><TableCell><b>{quote.customerName}</b><small>{quote.service}</small></TableCell><TableCell>{quote.phone}</TableCell><TableCell><select value={quote.status} disabled={quote.status === "convertido"} onChange={(event) => changeStatus(quote.id, event.target.value)}><option value="novo">Novo</option><option value="em_analise">Em análise</option><option value="aguardando_cliente">Aguardando cliente</option><option value="aprovado">Aprovado</option><option value="recusado">Recusado</option><option value="expirado">Expirado</option><option value="convertido">Convertido</option></select></TableCell><TableCell>{quote.estimatedValue ? currency.format(quote.estimatedValue) : "—"}</TableCell><TableCell className="text-right">{quote.status !== "convertido" && <Button size="sm" onClick={() => setClosing(quote)}>Fechar</Button>}</TableCell></TableRow>)}</TableBody></Table></div>}
  </>;
}

function NewQuoteForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await api("/api/orcamentos", { method: "POST", body: JSON.stringify({ customerName: form.get("customerName"), phone: form.get("phone"), email: form.get("email"), service: form.get("service"), dimensions: form.get("dimensions"), material: form.get("material"), details: form.get("details"), quantity: form.get("quantity") }) }); onSaved(); } catch (error) { setMessage((error as Error).message); }
  }
  return <form className="module-form" onSubmit={submit}><div className="form-title"><b>Novo orçamento</b><Button type="button" variant="ghost" size="icon" onClick={onClose}><X/></Button></div><div className="form-grid"><label>Cliente<Input name="customerName" required/></label><label>WhatsApp<Input name="phone" required/></label><label>E-mail<Input name="email" type="email"/></label><label>Serviço<Input name="service" required/></label><label>Medidas<Input name="dimensions"/></label><label>Material<Input name="material" defaultValue="A definir"/></label><label>Quantidade<Input name="quantity" type="number" min="1" defaultValue="1"/></label><label className="span-2">Detalhes<Input name="details"/></label></div>{message && <p className="form-error">{message}</p>}<Button type="submit">Salvar orçamento</Button></form>;
}

function CloseQuoteForm({ quote, onClose, onSaved }: { quote: Quote; onClose: () => void; onSaved: () => void }) {
  const [message, setMessage] = useState("");
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await api("/api/gestao/orcamentos/fechar", { method: "POST", body: JSON.stringify({ quoteId: quote.id, totalValue: form.get("totalValue"), deposit: form.get("deposit"), paymentMethod: form.get("paymentMethod"), receivedOn: form.get("receivedOn") }) }); onSaved(); } catch (error) { setMessage((error as Error).message); }
  }
  return <form className="module-form accent" onSubmit={submit}><div className="form-title"><div><b>Fechar orçamento #{quote.number}</b><small>{quote.customerName} · {quote.service}</small></div><Button type="button" variant="ghost" size="icon" onClick={onClose}><X/></Button></div><div className="form-grid"><label>Valor total<Input name="totalValue" type="number" min="0.01" step="0.01" defaultValue={quote.estimatedValue ?? ""} required/></label><label>Entrada recebida<Input name="deposit" type="number" min="0" step="0.01" required/></label><label>Forma de pagamento<select name="paymentMethod" defaultValue="pix"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option><option value="transferencia">Transferência</option><option value="outro">Outro</option></select></label><label>Data do recebimento<Input name="receivedOn" type="date" defaultValue={today} required/></label></div><p className="form-hint">Ao confirmar, a entrada irá para o financeiro e uma ordem será aberta na produção.</p>{message && <p className="form-error">{message}</p>}<Button type="submit">Confirmar fechamento</Button></form>;
}

type ProductionItem = { id: string; description: string; service_type?: string | null; material?: string | null; width_mm?: number | null; height_mm?: number | null; depth_mm?: number | null; quantity: number; unit: string; production_notes?: string | null; pricing_snapshot?: { cost?: number; totalCost?: number; unitCost?: number } | null; sort_order: number; selected_by_customer?: boolean | null };
type ProductionReservation = { id: string; planned_quantity: number; reserved_quantity: number; consumed_quantity: number; unit: string; status: string; inventory_items?: { id: string; name: string; current_quantity: number; unit: string; average_cost: number } | null };
type ProductionActualEntry = { id: string; entry_type: string; description: string; quantity: number; unit: string; unit_cost: number; total_cost: number; notes?: string | null; occurred_at: string };
type ProductionArtworkApproval = { id: string; version: number; title: string; file_url: string; content_type?: string | null; public_token: string; status: string; customer_notes?: string | null; responded_at?: string | null; created_at: string };
type ProductionStaff = { id: string; full_name?: string | null; role: string };
type ProductionOrder = { id: string; number: number; quote_id?: string | null; title: string; description?: string | null; stage: string; priority: string; due_at?: string | null; scheduled_start_at?: string | null; responsible_id?: string | null; started_at?: string | null; completed_at?: string | null; created_at: string; updated_at?: string; production_material_reservations?: ProductionReservation[]; production_actual_entries?: ProductionActualEntry[]; production_artwork_approvals?: ProductionArtworkApproval[]; quotes?: { id?: string; number?: number; customer_name?: string; company?: string | null; phone?: string | null; email?: string | null; service?: string; details?: string | null; internal_notes?: string | null; estimated_value?: number | null; delivery_days?: number | null; payment_terms?: string | null; installation_included?: boolean; quote_items?: ProductionItem[] } | null };
type ProductionReminder = { order: ProductionOrder; kind: "overdue" | "due" | "pending"; title: string; text: string };
type ProductionUpdateResult = { ok: boolean; stockDeducted?: boolean; negativeStockAllowed?: boolean; error?: string };
type ProductionChanges = Record<string, string | boolean | null>;
const stages = ["briefing", "arte", "aprovacao", "producao", "acabamento", "expedicao", "instalacao", "concluido", "cancelado"];
const kanbanStages = ["briefing", "arte", "aprovacao", "producao", "acabamento", "expedicao", "instalacao", "concluido"] as const;
const kanbanShortLabel: Record<string, string> = {
  briefing: "A programar",
  arte: "Arte",
  aprovacao: "Aprovação",
  producao: "Produção",
  acabamento: "Acabamento",
  expedicao: "Expedição",
  instalacao: "Instalação",
  concluido: "Concluído",
};
const priorities = ["baixa", "normal", "alta", "urgente"];
const productionViewStorageKey = "nexofab-production-view";

export function ProductionPanel({ search, initialOrderId }: { search: string; initialOrderId?: string }) {
  const { notify } = useToast();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [selected, setSelected] = useState<ProductionOrder | null>(null);
  const [selectedAutoFinalize, setSelectedAutoFinalize] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const [staff, setStaff] = useState<ProductionStaff[]>([]);
  const [advancedControl, setAdvancedControl] = useState(true);
  const [stageFilter, setStageFilter] = useState("ativos");
  const [viewMode, setViewMode] = useState<"kanban" | "grid">("kanban");
  const [dragOrderId, setDragOrderId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [movingOrderId, setMovingOrderId] = useState<string | null>(null);
  const [hasMoreOrders, setHasMoreOrders] = useState(false);
  const [loadingMoreOrders, setLoadingMoreOrders] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const saved = window.localStorage.getItem(productionViewStorageKey);
      if (saved === "grid" || saved === "kanban") setViewMode(saved);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!initialOrderId || loading || deepLinkHandled) return;
    const t = window.setTimeout(() => {
      const found = orders.find((order) => order.id === initialOrderId || String(order.number) === initialOrderId);
      setDeepLinkHandled(true);
      if (found) {
        setSelectedAutoFinalize(false);
        setSelected(found);
        const url = new URL(window.location.href);
        url.searchParams.delete("os");
        window.history.replaceState({}, "", url.toString());
      } else {
        notify("Ordem de serviço do QR Code não encontrada nesta empresa.", "error");
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [deepLinkHandled, initialOrderId, loading, notify, orders]);
  const switchView = (mode: "kanban" | "grid") => {
    setViewMode(mode);
    try { window.localStorage.setItem(productionViewStorageKey, mode); } catch { /* ignore */ }
  };
  const load = useCallback(() => api<{ orders: ProductionOrder[]; staff?: ProductionStaff[]; advancedControl?: boolean; pagination?: { hasMore: boolean } }>("/api/gestao/producao?limit=100&offset=0").then((result) => { setOrders(result.orders); setHasMoreOrders(Boolean(result.pagination?.hasMore)); setStaff(result.staff ?? []); setAdvancedControl(result.advancedControl !== false); setSelected((current) => current ? result.orders.find((order) => order.id === current.id) ?? null : null); }).finally(() => setLoading(false)), []);
  const loadMoreOrders = useCallback(async () => {
    if (loadingMoreOrders || !hasMoreOrders) return;
    setLoadingMoreOrders(true);
    try {
      const next = await api<{ orders: ProductionOrder[]; pagination?: { hasMore: boolean } }>(`/api/gestao/producao?limit=100&offset=${orders.length}`);
      setOrders((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...next.orders.filter((item) => !seen.has(item.id))];
      });
      setHasMoreOrders(Boolean(next.pagination?.hasMore));
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setLoadingMoreOrders(false);
    }
  }, [hasMoreOrders, loadingMoreOrders, notify, orders.length]);
  useEffect(() => { load().catch((error: Error) => setMessage(error.message)); }, [load]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const dueSoonDate = new Date(`${today}T12:00:00-03:00`); dueSoonDate.setDate(dueSoonDate.getDate() + 2);
  const dueSoonLimit = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(dueSoonDate);
  const reminders = orders.reduce<ProductionReminder[]>((list, order) => {
    if (["concluido", "cancelado"].includes(order.stage)) return list;
    const due = order.due_at?.slice(0, 10);
    if (due && due < today) list.push({ order, kind: "overdue", title: "Prazo vencido", text: `Venceu em ${showDate(order.due_at)}. Atualize a etapa e reorganize a fila.` });
    else if (due && due <= dueSoonLimit) list.push({ order, kind: "due", title: "Prazo próximo", text: `Entrega prevista para ${showDate(order.due_at)}. Confira materiais e andamento.` });
    else if (order.stage === "briefing") list.push({ order, kind: "pending", title: "Orçamento aceito — programar", text: "Confira entrada, arquivo, materiais e defina quem produzirá." });
    return list;
  }, []).sort((a, b) => ({ overdue: 0, due: 1, pending: 2 }[a.kind] - { overdue: 0, due: 1, pending: 2 }[b.kind]));
  const matchesSearchTerm = (order: ProductionOrder) => `${order.number} ${order.title} ${order.stage} ${order.quotes?.customer_name ?? ""} ${order.quotes?.company ?? ""} ${order.quotes?.service ?? ""}`.toLowerCase().includes(search.toLowerCase());
  const filtered = orders.filter((order) => {
    const matchesSearch = matchesSearchTerm(order);
    const overdue = !["concluido", "cancelado"].includes(order.stage) && Boolean(order.due_at) && order.due_at!.slice(0, 10) < today;
    const matchesStage = stageFilter === "todos" || (stageFilter === "ativos" && !["concluido", "cancelado"].includes(order.stage)) || (stageFilter === "aguardando_programacao" && order.stage === "briefing") || (stageFilter === "em_producao" && ["producao", "acabamento", "expedicao", "instalacao"].includes(order.stage)) || (stageFilter === "atrasados" && overdue) || order.stage === stageFilter;
    return matchesSearch && matchesStage;
  });
  const kanbanOrders = orders.filter((order) => {
    if (order.stage === "cancelado") return false;
    if (!matchesSearchTerm(order)) return false;
    if (stageFilter === "atrasados") return !["concluido", "cancelado"].includes(order.stage) && Boolean(order.due_at) && order.due_at!.slice(0, 10) < today;
    return true;
  });
  const visibleKanbanStages: readonly string[] =
    stageFilter === "aguardando_programacao"
      ? ["briefing", "arte", "aprovacao"]
      : stageFilter === "em_producao"
        ? ["producao", "acabamento", "expedicao", "instalacao", "concluido"]
        : stageFilter === "concluido"
          ? ["expedicao", "instalacao", "concluido"]
          : kanbanStages;
  const staffMap = useMemo(() => new Map(staff.map((person) => [person.id, person.full_name || "Equipe"])), [staff]);
  const summary = { active: orders.filter((order) => !["concluido", "cancelado"].includes(order.stage)).length, awaiting: orders.filter((order) => order.stage === "briefing").length, overdue: orders.filter((order) => !["concluido", "cancelado"].includes(order.stage) && Boolean(order.due_at) && order.due_at!.slice(0, 10) < today).length, inProduction: orders.filter((order) => ["producao", "acabamento", "expedicao", "instalacao"].includes(order.stage)).length, completed: orders.filter((order) => order.stage === "concluido").length };
  async function update(id: string, changes: ProductionChanges, success = "Etapa atualizada."): Promise<ProductionUpdateResult> {
    try {
      const result = await api<{ stockDeducted?: boolean; negativeStockAllowed?: boolean }>("/api/gestao/producao", { method: "PATCH", body: JSON.stringify({ id, ...changes }) });
      await load();
      setMessage(result.negativeStockAllowed ? "OK:Produção concluída. A baixa foi registrada e o saldo negativo ficou sinalizado para acerto." : result.stockDeducted ? "OK:Produção concluída e insumos baixados automaticamente do estoque." : `OK:${success}`);
      return { ok: true, stockDeducted: result.stockDeducted, negativeStockAllowed: result.negativeStockAllowed };
    } catch (error) {
      const errorMessage = (error as Error).message;
      setMessage(errorMessage);
      return { ok: false, error: errorMessage };
    }
  }
  async function moveOrderStage(orderId: string, targetStage: string) {
    const order = orders.find((item) => item.id === orderId);
    setDragOrderId(null);
    setDragOverStage(null);
    if (!order || order.stage === targetStage) return;
    if (targetStage === "concluido") {
      setSelected(order);
      setSelectedAutoFinalize(true);
      notify(`Confirme a conferência de estoque para concluir a OS-${order.number}.`, "info");
      return;
    }
    const previousOrders = orders;
    setMovingOrderId(order.id);
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, stage: targetStage } : item));
    const response = await update(order.id, { stage: targetStage }, `OS-${order.number} movida para ${kanbanShortLabel[targetStage] ?? targetStage}.`);
    setMovingOrderId(null);
    if (response.ok) {
      notify(`OS-${order.number} movida para ${kanbanShortLabel[targetStage] ?? targetStage}.`, "success");
    } else {
      setOrders(previousOrders);
      notify(response.error ?? "Não foi possível mover a ordem de serviço.", "error");
    }
  }
  function contact(order: ProductionOrder) { const destination = whatsappUrl(order.quotes?.phone, `Olá, ${order.quotes?.customer_name ?? "cliente"}! Estamos atualizando a produção do seu pedido #${order.quotes?.number ?? order.number} — ${order.quotes?.service ?? order.title}. A etapa atual é: ${stageLabel[order.stage] ?? order.stage}.`); if (!destination) { setMessage("Cadastre um WhatsApp válido no cliente deste pedido antes de enviar a atualização."); return; } window.open(destination, "_blank", "noopener,noreferrer"); }
  return <><SectionHeading eyebrow="CHÃO DE FÁBRICA · PCP" title="Produção" description="Arraste ordens entre etapas no quadro Kanban, acompanhe prazos na TV da fábrica ou escaneie o QR Code da OS." action={<Button variant="outline" onClick={() => setTvMode(true)}><Tv/>Modo TV (Fábrica)</Button>}/>
    <section className="production-kpis"><button type="button" className={stageFilter === "ativos" ? "active" : ""} onClick={() => setStageFilter("ativos")}><ClipboardCheck/><span><small>ORDENS ATIVAS</small><b>{summary.active}</b></span></button><button type="button" className={stageFilter === "aguardando_programacao" ? "active" : ""} onClick={() => setStageFilter("aguardando_programacao")}><Sparkles/><span><small>A PROGRAMAR</small><b>{summary.awaiting}</b></span></button><button type="button" className={stageFilter === "em_producao" ? "active" : ""} onClick={() => setStageFilter("em_producao")}><Play/><span><small>EM PRODUÇÃO</small><b>{summary.inProduction}</b></span></button><button type="button" className={`${summary.overdue ? "danger" : ""} ${stageFilter === "atrasados" ? "active" : ""}`} onClick={() => setStageFilter("atrasados")}><CalendarClock/><span><small>PRAZO VENCIDO</small><b>{summary.overdue}</b></span></button><button type="button" className={stageFilter === "concluido" ? "active" : ""} onClick={() => setStageFilter("concluido")}><CheckCircle2/><span><small>CONCLUÍDAS</small><b>{summary.completed}</b></span></button></section>
    {reminders.length > 0 && <section className="production-reminders"><header><div><small>LEMBRETES AUTOMÁTICOS</small><h2>O que precisa de atenção agora</h2><p>Os avisos permanecem ativos até a etapa ou o prazo da ordem ser atualizado.</p></div><span>{reminders.length} pendência(s)</span></header><div>{reminders.slice(0, 8).map(({ order, kind, title, text }) => <button type="button" key={`${order.id}-${kind}`} className={kind} onClick={() => { setSelectedAutoFinalize(false); setSelected(order); }}><span>{kind === "overdue" ? <AlertTriangle/> : kind === "due" ? <CalendarClock/> : <Factory/>}</span><div><small>{title}</small><b>OS-{order.number} · {order.quotes?.company || order.quotes?.customer_name || "Cliente"}</b><p>{order.quotes?.service || order.title}</p><em>{text}</em></div><ArrowRight/></button>)}</div></section>}
    <Feedback message={message}/><div className="production-toolbar"><label>Visualizar<select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="ativos">Ordens ativas</option><option value="aguardando_programacao">Aguardando programação</option><option value="em_producao">Em produção e acabamento</option><option value="atrasados">Prazo vencido</option><option value="todos">Todas</option>{stages.map((stage) => <option key={stage} value={stage}>{stageLabel[stage]}</option>)}</select></label><div className="view-mode-toggle" role="group" aria-label="Modo de visualização da produção"><button type="button" className={viewMode === "kanban" ? "active" : ""} onClick={() => switchView("kanban")}><Columns3/>Kanban PCP</button><button type="button" className={viewMode === "grid" ? "active" : ""} onClick={() => switchView("grid")}><LayoutGrid/>Grade</button></div><span>{viewMode === "kanban" ? kanbanOrders.length : filtered.length} ordem(ns)</span><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw/>Atualizar</Button></div>
    {!loading && !(viewMode === "kanban" ? kanbanOrders.length : filtered.length) ? <EmptyState icon={Factory} title="Nenhuma ordem neste filtro" text="Ao fechar um orçamento, a ordem de serviço será criada automaticamente aqui."/> : viewMode === "kanban" ? (
      <div className="pcp-kanban-board" role="region" aria-label="Quadro Kanban de Produção">
        {visibleKanbanStages.map((stageKey) => {
          const columnOrders = kanbanOrders.filter((order) => order.stage === stageKey);
          const displayOrders = stageKey === "concluido" ? columnOrders.slice(0, 15) : columnOrders;
          const columnTotal = columnOrders.reduce((sum, order) => sum + Number(order.quotes?.estimated_value ?? 0), 0);
          const isOver = dragOverStage === stageKey;
          return (
            <section
              key={stageKey}
              className={`pcp-kanban-col stage-${stageKey} ${isOver ? "drag-over" : ""}`}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (dragOverStage !== stageKey) setDragOverStage(stageKey); }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverStage((cur) => cur === stageKey ? null : cur); }}
              onDrop={(event) => { event.preventDefault(); const droppedId = event.dataTransfer.getData("text/plain") || dragOrderId; if (droppedId) void moveOrderStage(droppedId, stageKey); }}
            >
              <header>
                <div>
                  <b>{kanbanShortLabel[stageKey] ?? stageKey}</b>
                  <span>{columnOrders.length}</span>
                </div>
                <small>{columnTotal > 0 ? currency.format(columnTotal) : "Sem valor"}</small>
              </header>
              <div className="pcp-kanban-cards">
                {displayOrders.length === 0 ? (
                  <p className="pcp-kanban-empty">{stageKey === "concluido" ? "Arraste aqui para finalizar OS" : "Arraste uma OS para cá"}</p>
                ) : displayOrders.map((order) => {
                  const due = order.due_at?.slice(0, 10);
                  const isClosed = order.stage === "concluido";
                  const overdue = !isClosed && Boolean(due) && due! < today;
                  const dueSoon = !isClosed && !overdue && Boolean(due) && due! <= dueSoonLimit;
                  const shortage = (order.production_material_reservations ?? []).some((item) => item.status === "insuficiente");
                  const latestArt = order.production_artwork_approvals?.[0];
                  const ownerName = order.responsible_id ? staffMap.get(order.responsible_id) : null;
                  return (
                    <article
                      key={order.id}
                      draggable={!isClosed && movingOrderId !== order.id}
                      onDragStart={(event) => {
                        setDragOrderId(order.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", order.id);
                      }}
                      onDragEnd={() => { setDragOrderId(null); setDragOverStage(null); }}
                      className={`pcp-kanban-card ${overdue ? "overdue" : dueSoon ? "due-soon" : ""} ${dragOrderId === order.id ? "dragging" : ""} ${movingOrderId === order.id ? "moving" : ""}`}
                    >
                      <div className="pcp-card-top">
                        <span className="pcp-card-grip" title="Arraste para mudar de etapa">
                          {!isClosed && <GripVertical />}
                          <b>OS-{order.number}</b>
                        </span>
                        <em className={`priority-${order.priority}`}>{order.priority}</em>
                      </div>
                      <button type="button" className="pcp-card-body" onClick={() => { setSelectedAutoFinalize(false); setSelected(order); }}>
                        <h3>{order.quotes?.service || order.title}</h3>
                        <p>{order.quotes?.company || order.quotes?.customer_name || "Cliente não vinculado"}</p>
                      </button>
                      {(shortage || latestArt || ownerName) && (
                        <div className="pcp-card-tags">
                          {shortage && <span className="pcp-tag danger"><AlertTriangle/>Falta material</span>}
                          {latestArt && <span className={`pcp-tag ${latestArt.status === "aprovada" ? "ok" : latestArt.status === "ajustes" ? "danger" : "neutral"}`}><Palette/>Arte: {latestArt.status}</span>}
                          {ownerName && <span className="pcp-tag neutral">{ownerName.split(" ")[0]}</span>}
                        </div>
                      )}
                      <div className="pcp-card-meta">
                        <span className={`pcp-due-pill ${overdue ? "overdue" : dueSoon ? "due-soon" : ""}`}>
                          <CalendarClock/>
                          {order.due_at ? (overdue ? `Atrasada · ${showDate(order.due_at)}` : showDate(order.due_at)) : "Sem prazo"}
                        </span>
                        <strong>{currency.format(Number(order.quotes?.estimated_value ?? 0))}</strong>
                      </div>
                      <footer>
                        <button type="button" onClick={() => contact(order)} title="Avisar cliente no WhatsApp"><MessageCircle/>WhatsApp</button>
                        <button type="button" className="primary" onClick={() => { setSelectedAutoFinalize(false); setSelected(order); }}><FileText/>Abrir OS</button>
                      </footer>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    ) : <div className="production-order-grid">{filtered.map((order) => { const overdue = !["concluido", "cancelado"].includes(order.stage) && Boolean(order.due_at) && order.due_at!.slice(0, 10) < today; return <article key={order.id} className={overdue ? "overdue" : ""}><header><span>OS-{order.number}</span><em className={`priority-${order.priority}`}>{order.priority}</em></header><h3>{order.quotes?.service || order.title}</h3><p>{order.quotes?.company || order.quotes?.customer_name || "Cliente não vinculado"}</p><div><span><small>Etapa</small><b>{stageLabel[order.stage] ?? order.stage}</b></span><span><small>Prazo</small><b>{showDate(order.due_at)}</b></span><span><small>Valor</small><b>{currency.format(Number(order.quotes?.estimated_value ?? 0))}</b></span></div><footer><Button size="sm" variant="outline" onClick={() => contact(order)}><MessageCircle/>Cliente</Button><Button size="sm" onClick={() => { setSelectedAutoFinalize(false); setSelected(order); }}><FileText/>Abrir OS</Button></footer></article>; })}</div>}
    {hasMoreOrders && <div className="list-load-more"><span>Exibindo {orders.length} ordem(ns) carregada(s). Há ordens mais antigas disponíveis.</span><Button type="button" variant="outline" onClick={() => void loadMoreOrders()} disabled={loadingMoreOrders}>{loadingMoreOrders ? "Carregando..." : "Carregar mais ordens"}</Button></div>}
    {tvMode && <ShopFloorTvBoard orders={orders} staffMap={staffMap} today={today} dueSoonLimit={dueSoonLimit} onRefresh={load} onOpenOrder={(id) => { const found = orders.find((item) => item.id === id); setTvMode(false); if (found) { setSelectedAutoFinalize(false); setSelected(found); } }} onClose={() => setTvMode(false)}/>}
    {selected && <ProductionOrderDialog key={`${selected.id}-${selectedAutoFinalize ? "fin" : "std"}`} order={selected} staff={staff} advancedControl={advancedControl} initialFinalize={selectedAutoFinalize} onClose={() => { setSelected(null); setSelectedAutoFinalize(false); }} onUpdate={update} onRefresh={load} onWhatsApp={() => contact(selected)}/>}</>;
}

function LegacyProductionOrderDialog({ order, staff, advancedControl, onClose, onUpdate, onRefresh, onWhatsApp }: { order: ProductionOrder; staff: ProductionStaff[]; advancedControl: boolean; onClose: () => void; onUpdate: (id: string, changes: ProductionChanges, success?: string) => Promise<ProductionUpdateResult>; onRefresh: () => Promise<void>; onWhatsApp: () => void }) {
  const [stage, setStage] = useState(order.stage); const [priority, setPriority] = useState(order.priority); const [dueAt, setDueAt] = useState(order.due_at?.slice(0, 10) ?? ""); const [scheduledStartAt, setScheduledStartAt] = useState(order.scheduled_start_at?.slice(0, 10) ?? ""); const [responsibleId, setResponsibleId] = useState(order.responsible_id ?? ""); const [description, setDescription] = useState(order.description ?? ""); const [actualMessage, setActualMessage] = useState(""); const items = (order.quotes?.quote_items ?? []).filter((item) => item.selected_by_customer !== false).sort((a, b) => a.sort_order - b.sort_order);
  const reservations = order.production_material_reservations ?? [];
  const actualEntries = order.production_actual_entries ?? [];
  const estimatedCost = items.reduce((sum, item) => { const snapshot = item.pricing_snapshot; return sum + Number(snapshot?.totalCost ?? (Number(snapshot?.unitCost ?? snapshot?.cost ?? 0) * Number(item.quantity || 1))); }, 0);
  const actualCost = actualEntries.reduce((sum, entry) => sum + Number(entry.total_cost ?? Number(entry.quantity) * Number(entry.unit_cost)), 0);
  const saleValue = Number(order.quotes?.estimated_value ?? 0);
  const projectedResult = saleValue - (actualEntries.length ? actualCost : estimatedCost);
  useEffect(() => { const previous = document.body.style.overflow; const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.body.style.overflow = "hidden"; window.addEventListener("keydown", closeOnEscape); return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", closeOnEscape); }; }, [onClose]);
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await onUpdate(order.id, { stage, priority, dueAt: dueAt || null, scheduledStartAt: scheduledStartAt || null, responsibleId: responsibleId || null, description: description || null }, "Ordem de serviço atualizada."); }
  async function addActualEntry(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); try { await api("/api/gestao/producao", { method: "POST", body: JSON.stringify({ orderId: order.id, entryType: form.get("entryType"), description: form.get("description"), quantity: form.get("quantity"), unit: form.get("unit"), unitCost: form.get("unitCost"), notes: form.get("notes") }) }); event.currentTarget.reset(); setActualMessage("OK:Custo realizado registrado."); await onRefresh(); } catch (error) { setActualMessage((error as Error).message); } }
  return <div className="workspace-modal production-order-modal" role="dialog" aria-modal="true" aria-label={`Ordem de serviço ${order.number}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="workspace-dialog production-order-dialog"><div className="production-order-sheet"><header><div><small>NEXOFAB · ORDEM DE SERVIÇO</small><h2>OS-{order.number}</h2><p>Gerada em {showDate(order.created_at)} · Orçamento #{order.quotes?.number ?? "—"}</p></div><Button type="button" size="icon" variant="ghost" onClick={onClose} className="no-print"><X/></Button></header><section className="production-order-identity"><div><small>CLIENTE</small><b>{order.quotes?.company || order.quotes?.customer_name || "—"}</b><span>{order.quotes?.customer_name}{order.quotes?.phone ? ` · ${order.quotes.phone}` : ""}</span></div><div><small>PROJETO</small><b>{order.quotes?.service || order.title}</b><span>{order.quotes?.payment_terms || "Condição de pagamento não informada"}</span></div><div><small>PRAZO</small><b>{showDate(order.due_at)}</b><span>Prioridade {order.priority}</span></div></section><section className="production-order-items"><h3>Itens para produzir</h3>{items.length ? items.map((item, index) => <article key={item.id}><span>{index + 1}</span><div><b>{item.description}</b><small>{[item.material, item.service_type].filter(Boolean).join(" · ") || "Sem material informado"}{item.width_mm && item.height_mm ? ` · ${item.width_mm} × ${item.height_mm}${item.depth_mm ? ` × ${item.depth_mm}` : ""} mm` : ""}</small>{item.production_notes && <p>{item.production_notes}</p>}</div><strong>{Number(item.quantity)} {item.unit}</strong></article>) : <p className="production-order-empty">Este orçamento não possui itens detalhados.</p>}</section>{(order.quotes?.details || order.quotes?.internal_notes) && <section className="production-order-notes"><h3>Orientações</h3>{order.quotes?.details && <p><b>Escopo:</b> {order.quotes.details}</p>}{order.quotes?.internal_notes && <p><b>Observação interna:</b> {order.quotes.internal_notes}</p>}</section>}<form className="production-order-control no-print" onSubmit={save}><h3>Controle da ordem</h3><div><label>Etapa<select value={stage} onChange={(event) => setStage(event.target.value)}>{stages.map((item) => <option key={item} value={item}>{stageLabel[item]}</option>)}</select></label><label>Prioridade<select value={priority} onChange={(event) => setPriority(event.target.value)}>{priorities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Prazo<Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)}/></label></div><label>Instruções da produção<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Acabamento, instalação e observações"/></label><footer><Button type="button" variant="outline" onClick={onWhatsApp}><MessageCircle/>Avisar cliente</Button><Button type="button" variant="outline" onClick={() => window.print()}><Printer/>Imprimir / salvar PDF</Button><Button type="submit"><Check/>Salvar alterações</Button></footer></form><footer className="production-order-signatures"><span>Responsável pela produção</span><span>Conferência / entrega</span></footer></div></div></div>;
}

function ProductionOrderDialog({ order, staff, advancedControl, initialFinalize = false, onClose, onUpdate, onRefresh, onWhatsApp }: { order: ProductionOrder; staff: ProductionStaff[]; advancedControl: boolean; initialFinalize?: boolean; onClose: () => void; onUpdate: (id: string, changes: ProductionChanges, success?: string) => Promise<ProductionUpdateResult>; onRefresh: () => Promise<void>; onWhatsApp: () => void }) {
  const [stage, setStage] = useState(order.stage);
  const [priority, setPriority] = useState(order.priority);
  const [dueAt, setDueAt] = useState(order.due_at?.slice(0, 10) ?? "");
  const [scheduledStartAt, setScheduledStartAt] = useState(order.scheduled_start_at?.slice(0, 10) ?? "");
  const [responsibleId, setResponsibleId] = useState(order.responsible_id ?? "");
  const [description, setDescription] = useState(order.description ?? "");
  const [actualMessage, setActualMessage] = useState("");
  const [artworkUploading, setArtworkUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(Boolean(initialFinalize) && order.stage !== "concluido");
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [operationMessage, setOperationMessage] = useState("");
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [stockOverrideReason, setStockOverrideReason] = useState("");
  const items = (order.quotes?.quote_items ?? []).filter((item) => item.selected_by_customer !== false).sort((a, b) => a.sort_order - b.sort_order);
  const reservations = order.production_material_reservations ?? [];
  const actualEntries = order.production_actual_entries ?? [];
  const estimatedCost = items.reduce((sum, item) => sum + Number(item.pricing_snapshot?.totalCost ?? Number(item.pricing_snapshot?.unitCost ?? item.pricing_snapshot?.cost ?? 0) * Number(item.quantity || 1)), 0);
  const artworks = order.production_artwork_approvals ?? [];
  const actualCost = actualEntries.reduce((sum, entry) => sum + Number(entry.total_cost ?? Number(entry.quantity) * Number(entry.unit_cost)), 0);
  const saleValue = Number(order.quotes?.estimated_value ?? 0);
  const result = saleValue - (actualEntries.length ? actualCost : estimatedCost);

  useEffect(() => {
    const previous = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (finalizeOpen && !finalizing) { setFinalizeOpen(false); return; }
      if (!finalizing && !saving) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", closeOnEscape); };
  }, [finalizeOpen, finalizing, onClose, saving]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setOperationMessage("");
    const response = await onUpdate(order.id, { stage, priority, dueAt: dueAt || null, scheduledStartAt: scheduledStartAt || null, responsibleId: responsibleId || null, description: description || null }, "Ordem de serviço atualizada.");
    setOperationMessage(response.ok ? "OK:Alterações da ordem de serviço salvas." : response.error ?? "Não foi possível salvar a ordem.");
    setSaving(false);
  }

  async function finalizeOrder() {
    if (allowNegativeStock && stockOverrideReason.trim().length < 5) {
      setOperationMessage("Informe por que o saldo ainda não está correto antes de usar a baixa excepcional.");
      return;
    }
    setFinalizing(true);
    setOperationMessage("");
    const response = await onUpdate(order.id, { stage: "concluido", allowNegativeStock, stockOverrideReason: allowNegativeStock ? stockOverrideReason.trim() : null }, "Produção finalizada.");
    if (response.ok) {
      setFinalizeOpen(false);
      setOperationMessage(response.negativeStockAllowed ? "OK:OS finalizada com saldo negativo registrado. Faça o acerto físico do estoque assim que possível." : response.stockDeducted ? "OK:OS finalizada e materiais baixados do estoque." : "OK:OS finalizada. Nenhum consumo adicional precisava ser baixado.");
    } else setOperationMessage(response.error ?? "Não foi possível finalizar a OS.");
    setFinalizing(false);
  }

  async function addActualEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/gestao/producao", { method: "POST", body: JSON.stringify({ orderId: order.id, entryType: form.get("entryType"), description: form.get("description"), quantity: form.get("quantity"), unit: form.get("unit"), unitCost: form.get("unitCost"), notes: form.get("notes") }) });
      event.currentTarget.reset();
      setActualMessage("OK:Custo realizado registrado.");
      await onRefresh();
    } catch (error) { setActualMessage((error as Error).message); }
  }

  async function addArtwork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    form.set("orderId", order.id);
    setArtworkUploading(true);
    setActualMessage("");
    try {
      const response = await fetch("/api/gestao/producao/arte", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível enviar a arte.");
      formElement.reset();
      setActualMessage("OK:Nova versão enviada para aprovação.");
      await onRefresh();
    } catch (error) { setActualMessage((error as Error).message); }
    finally { setArtworkUploading(false); }
  }

  const quickFlowStages = ["briefing", "arte", "aprovacao", "producao", "acabamento", "expedicao", "instalacao"] as const;
  const currentFlowIndex = quickFlowStages.indexOf(order.stage as (typeof quickFlowStages)[number]);
  const nextFlowStage = currentFlowIndex >= 0 && currentFlowIndex < quickFlowStages.length - 1 ? quickFlowStages[currentFlowIndex + 1] : null;

  async function quickAdvanceStage(targetStage: string) {
    if (targetStage === order.stage) return;
    setSaving(true);
    setOperationMessage("");
    const response = await onUpdate(order.id, { stage: targetStage }, `OS-${order.number} avançada para ${kanbanShortLabel[targetStage] ?? targetStage}.`);
    if (response.ok) {
      setStage(targetStage);
      setOperationMessage(`OK:Etapa atualizada para ${kanbanShortLabel[targetStage] ?? targetStage}.`);
    } else {
      setOperationMessage(response.error ?? "Não foi possível atualizar a etapa.");
    }
    setSaving(false);
  }

  return <div className="workspace-modal production-order-modal" role="dialog" aria-modal="true" aria-label={`Ordem de serviço ${order.number}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="workspace-dialog production-order-dialog"><div className="production-order-sheet">
      <header className="production-order-header-qr">
        <div><small>NEXOFAB · ORDEM DE SERVIÇO</small><h2>OS-{order.number}</h2><p>Gerada em {showDate(order.created_at)} · Orçamento #{order.quotes?.number ?? "—"}</p></div>
        <div className="production-order-header-right">
          <OsQrCode orderId={order.id} orderNumber={order.number} />
          <Button type="button" size="icon" variant="ghost" onClick={onClose} className="no-print"><X/></Button>
        </div>
      </header>
      {order.stage !== "concluido" && order.stage !== "cancelado" && (
        <section className="os-quick-stage-bar no-print" aria-label="Avanço rápido de etapa no chão de fábrica">
          <div className="os-quick-stage-head">
            <div>
              <small>ATUALIZAÇÃO RÁPIDA · 1 TOQUE</small>
              <b>Etapa atual: {kanbanShortLabel[order.stage] ?? stageLabel[order.stage] ?? order.stage}</b>
            </div>
            {nextFlowStage ? (
              <Button type="button" size="sm" disabled={saving || finalizing} onClick={() => void quickAdvanceStage(nextFlowStage)}>
                <ArrowRight/>Avançar para {kanbanShortLabel[nextFlowStage]}
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={saving || finalizing} onClick={() => { setOperationMessage(""); setAllowNegativeStock(false); setStockOverrideReason(""); setFinalizeOpen(true); }}>
                <CheckCircle2/>Finalizar OS (Baixar estoque)
              </Button>
            )}
          </div>
          <div className="os-quick-stage-pills">
            {quickFlowStages.map((stepKey) => (
              <button
                key={stepKey}
                type="button"
                disabled={saving || finalizing}
                className={order.stage === stepKey ? "active" : ""}
                onClick={() => void quickAdvanceStage(stepKey)}
              >
                {kanbanShortLabel[stepKey]}
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="production-order-identity"><div><small>CLIENTE</small><b>{order.quotes?.company || order.quotes?.customer_name || "—"}</b><span>{order.quotes?.customer_name}{order.quotes?.phone ? ` · ${order.quotes.phone}` : ""}</span></div><div><small>PROJETO</small><b>{order.quotes?.service || order.title}</b><span>{order.quotes?.payment_terms || "Condição de pagamento não informada"}</span></div><div><small>PRAZO</small><b>{showDate(order.due_at)}</b><span>Prioridade {order.priority}</span></div></section>
      <section className="production-order-items"><h3>Itens para produzir</h3>{items.length ? items.map((item, index) => <article key={item.id}><span>{index + 1}</span><div><b>{item.description}</b><small>{[item.material, item.service_type].filter(Boolean).join(" · ") || "Sem material informado"}{item.width_mm && item.height_mm ? ` · ${item.width_mm} × ${item.height_mm}${item.depth_mm ? ` × ${item.depth_mm}` : ""} mm` : ""}</small>{item.production_notes && <p>{item.production_notes}</p>}</div><strong>{Number(item.quantity)} {item.unit}</strong></article>) : <p className="production-order-empty">Este orçamento não possui itens detalhados.</p>}</section>
      {advancedControl && <section className="production-material-control"><div className="production-control-title"><div><small>MATERIAIS DA ORDEM</small><h3>Reserva automática</h3></div><span className={reservations.some((item) => item.status === "insuficiente") ? "danger" : "ok"}>{reservations.length ? reservations.some((item) => item.status === "insuficiente") ? "Há falta de material" : "Materiais reservados" : "Sem consumo vinculado"}</span></div>{reservations.length ? <div className="production-reservation-list">{reservations.map((reservation) => { const stock = reservation.inventory_items; return <article key={reservation.id} className={reservation.status === "insuficiente" ? "shortage" : ""}><div><b>{stock?.name ?? "Insumo"}</b><small>{reservation.status === "insuficiente" ? "Saldo insuficiente" : reservation.status === "consumido" ? "Consumido" : "Separado para produção"}</small></div><span><small>NECESSÁRIO</small><b>{Number(reservation.planned_quantity).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {reservation.unit}</b></span><span><small>EM ESTOQUE</small><b>{Number(stock?.current_quantity ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {stock?.unit ?? reservation.unit}</b></span></article>; })}</div> : <p className="production-order-empty">Nenhum consumo de estoque foi identificado na memória de cálculo.</p>}</section>}
      {(order.quotes?.details || order.quotes?.internal_notes) && <section className="production-order-notes"><h3>Orientações</h3>{order.quotes?.details && <p><b>Escopo:</b> {order.quotes.details}</p>}{order.quotes?.internal_notes && <p><b>Observação interna:</b> {order.quotes.internal_notes}</p>}</section>}
      {advancedControl && <section className="production-cost-control no-print"><div className="production-control-title"><div><small>FECHAMENTO OPERACIONAL</small><h3>Previsto x realizado</h3></div></div><div className="production-cost-kpis"><span><small>CUSTO PREVISTO</small><b>{currency.format(estimatedCost)}</b></span><span><small>CUSTO REAL LANÇADO</small><b>{currency.format(actualCost)}</b></span><span><small>VENDA</small><b>{currency.format(saleValue)}</b></span><span className={result < 0 ? "danger" : "ok"}><small>RESULTADO ATUAL</small><b>{currency.format(result)}</b></span></div>{actualEntries.length > 0 && <div className="production-actual-list">{actualEntries.map((entry) => <article key={entry.id}><div><b>{entry.description}</b><small>{entry.entry_type.replaceAll("_", " ")} · {Number(entry.quantity)} {entry.unit} × {currency.format(Number(entry.unit_cost))}</small></div><strong>{currency.format(Number(entry.total_cost))}</strong></article>)}</div>}<Feedback message={actualMessage}/><form className="production-actual-form" onSubmit={addActualEntry}><label>Tipo<select name="entryType" defaultValue="material"><option value="material">Material</option><option value="mao_obra">Mão de obra</option><option value="maquina">Máquina</option><option value="perda">Perda</option><option value="retrabalho">Retrabalho</option><option value="terceiro">Terceirização</option><option value="outro">Outro</option></select></label><label>Descrição<Input name="description" required placeholder="Ex.: 30 min extras de router"/></label><label>Quantidade<Input name="quantity" type="number" min="0.001" step="0.001" defaultValue="1" required/></label><label>Unidade<Input name="unit" defaultValue="un" required/></label><label>Custo unitário<Input name="unitCost" type="number" min="0" step="0.01" required/></label><Button type="submit"><Plus/>Lançar custo</Button></form></section>}
      {advancedControl && <section className="production-artwork-control no-print"><div className="production-control-title"><div><small>ARTE DO CLIENTE</small><h3>Aprovação por versão</h3></div><span className={artworks[0]?.status === "ajustes" ? "danger" : "ok"}>{artworks[0] ? `Versão ${artworks[0].version}: ${artworks[0].status}` : "Nenhuma versão enviada"}</span></div>{artworks.length > 0 && <div className="production-artwork-list">{artworks.map((artwork) => { const publicUrl = `${window.location.origin}/arte/${artwork.public_token}`; return <article key={artwork.id}><div><b>V{artwork.version} · {artwork.title}</b><small>{showDate(artwork.created_at)} · {artwork.status}{artwork.customer_notes ? ` · ${artwork.customer_notes}` : ""}</small></div><Button type="button" size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(publicUrl)}>Copiar link</Button><Button type="button" size="sm" variant="outline" onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}>Ver aprovação</Button></article>; })}</div>}<form className="production-artwork-form" onSubmit={addArtwork}><label>Título da versão<Input name="title" required placeholder="Ex.: Fachada — arte final"/></label><label>Print ou PDF da arte<Input name="file" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required/><small>PNG, JPG, WebP ou PDF · até 12 MB.</small></label><Button type="submit" disabled={artworkUploading}><Plus/>{artworkUploading ? "Enviando arte..." : "Enviar para aprovação"}</Button></form></section>}
      <div className="production-operation-feedback no-print"><Feedback message={operationMessage}/></div>
      <form className="production-order-control no-print" onSubmit={save}><h3>Controle da ordem</h3><div><label>Etapa<select value={stage} onChange={(event) => setStage(event.target.value)}>{stages.map((item) => <option key={item} value={item}>{stageLabel[item]}</option>)}</select></label><label>Prioridade<select value={priority} onChange={(event) => setPriority(event.target.value)}>{priorities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Início programado<Input type="date" value={scheduledStartAt} onChange={(event) => setScheduledStartAt(event.target.value)}/></label><label>Prazo<Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)}/></label><label>Responsável<select value={responsibleId} onChange={(event) => setResponsibleId(event.target.value)}><option value="">A definir</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.full_name || "Usuário"}</option>)}</select></label></div><label>Instruções da produção<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Acabamento, conferência, instalação e observações da execução"/></label><footer><Button type="button" variant="outline" onClick={onWhatsApp}><MessageCircle/>Avisar cliente</Button><Button type="button" variant="outline" onClick={() => setLabelsOpen(true)}><Tag/>Etiquetas de volume</Button><Button type="button" variant="outline" onClick={() => window.print()}><Printer/>Imprimir / salvar PDF</Button><Button type="submit" disabled={saving || finalizing}>{saving ? <RefreshCw className="spin"/> : <Check/>}{saving ? "Salvando..." : "Salvar alterações"}</Button>{order.stage !== "concluido" && <Button type="button" disabled={saving || finalizing} onClick={() => { setOperationMessage(""); setAllowNegativeStock(false); setStockOverrideReason(""); setFinalizeOpen(true); }}><CheckCircle2/>Finalizar OS</Button>}</footer></form>
      {labelsOpen && <OsShippingLabelsDialog order={order} onClose={() => setLabelsOpen(false)}/>}
      {finalizeOpen && <div className="production-finalize-backdrop no-print" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !finalizing) setFinalizeOpen(false); }}><section className="production-finalize-card" role="alertdialog" aria-modal="true" aria-labelledby="production-finalize-title"><span className="production-finalize-icon"><CheckCircle2/></span><div><small>CONCLUSÃO DA PRODUÇÃO</small><h2 id="production-finalize-title">Finalizar a OS-{order.number}?</h2><p>A ordem será concluída e o sistema baixará somente o consumo calculado dos materiais selecionados na proposta.</p>{reservations.length > 0 && <div className="production-finalize-summary"><b>{reservations.length} insumo(s) vinculado(s)</b><span>{reservations.some((item) => item.status === "insuficiente") ? "Existe saldo insuficiente. Corrija o estoque ou autorize abaixo uma baixa excepcional, que ficará registrada para conferência." : "Os saldos serão conferidos novamente antes da baixa."}</span></div>}<label className={`production-stock-override ${allowNegativeStock ? "active" : ""}`}><input type="checkbox" checked={allowNegativeStock} disabled={finalizing} onChange={(event) => { setAllowNegativeStock(event.target.checked); setOperationMessage(""); }}/><span><b>Permitir saldo negativo se faltar material</b><small>Use apenas quando o material foi realmente consumido, mas a entrada ou o saldo ainda não foi lançado. A movimentação continuará registrada.</small></span></label>{allowNegativeStock && <label className="production-stock-reason"><span>Motivo da baixa excepcional</span><textarea rows={2} value={stockOverrideReason} disabled={finalizing} onChange={(event) => setStockOverrideReason(event.target.value)} placeholder="Ex.: compra recebida e ainda não lançada no estoque"/></label>}<Feedback message={operationMessage}/></div><footer><Button type="button" variant="outline" disabled={finalizing} onClick={() => setFinalizeOpen(false)}>Continuar na OS</Button><Button type="button" disabled={finalizing} onClick={() => void finalizeOrder()}>{finalizing ? <RefreshCw className="spin"/> : <CheckCircle2/>}{finalizing ? "Conferindo e finalizando..." : "Finalizar e registrar baixa"}</Button></footer></section></div>}
      <footer className="production-order-signatures"><span>Responsável pela produção</span><span>Conferência / entrega</span></footer>
    </div></div>
  </div>;
}

type InventoryItem = { id: string; sku?: string | null; name: string; category?: string | null; unit: string; current_quantity: number; minimum_quantity: number; average_cost: number };

export function InventoryPanel({ search }: { search: string }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => api<{ items: InventoryItem[] }>("/api/gestao/estoque").then((result) => setItems(result.items)).finally(() => setLoading(false)), []);
  useEffect(() => { load().catch((error: Error) => setMessage(error.message)); }, [load]);
  const filtered = items.filter((item) => `${item.sku} ${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase()));
  async function adjust(item: InventoryItem, quantity: string) { try { await api("/api/gestao/estoque", { method: "PATCH", body: JSON.stringify({ id: item.id, quantity }) }); await load(); setMessage("OK:Saldo ajustado."); } catch (error) { setMessage((error as Error).message); } }
  return <><SectionHeading eyebrow="MATERIAIS" title="Estoque" description="Visão operacional dos mesmos insumos cadastrados em Precificação → Insumos e estoque."/><Feedback message={message}/>{!loading && !filtered.length ? <EmptyState icon={Boxes} title="Estoque zerado" text="Cadastre os insumos na central de precificação para formar custo e estoque no mesmo lugar."/> : <div className="module-table"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Categoria</TableHead><TableHead>Saldo</TableHead><TableHead>Mínimo</TableHead><TableHead>Custo médio</TableHead><TableHead>Ajustar saldo</TableHead></TableRow></TableHeader><TableBody>{filtered.map((item) => <InventoryRow key={`${item.id}-${item.current_quantity}`} item={item} onAdjust={adjust}/>)}</TableBody></Table></div>}</>;
}

function InventoryRow({ item, onAdjust }: { item: InventoryItem; onAdjust: (item: InventoryItem, quantity: string) => void }) {
  const [quantity, setQuantity] = useState(String(item.current_quantity));
  const critical = Number(item.minimum_quantity) > 0 && Number(item.current_quantity) <= Number(item.minimum_quantity);
  return <TableRow><TableCell><b>{item.name}</b><small>{item.sku || "Sem SKU"}</small></TableCell><TableCell>{item.category || "—"}</TableCell><TableCell><span className={critical ? "stock-badge critical" : "stock-badge ok"}>{item.current_quantity} {item.unit}</span></TableCell><TableCell>{item.minimum_quantity} {item.unit}</TableCell><TableCell>{currency.format(item.average_cost)}</TableCell><TableCell><div className="inline-edit"><Input type="number" min="0" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)}/><Button size="sm" variant="outline" onClick={() => onAdjust(item, quantity)}>Salvar</Button></div></TableCell></TableRow>;
}

type Customer = { id: string; name: string; company_name?: string | null; phone?: string | null; email?: string | null; created_at: string };

export function CustomersPanel({ search }: { search: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => api<{ customers: Customer[] }>("/api/gestao/clientes").then((result) => setCustomers(result.customers)).finally(() => setLoading(false)), []);
  useEffect(() => { load().catch((error: Error) => setMessage(error.message)); }, [load]);
  const filtered = customers.filter((customer) => `${customer.name} ${customer.company_name} ${customer.phone} ${customer.email}`.toLowerCase().includes(search.toLowerCase()));
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); try { await api("/api/gestao/clientes", { method: "POST", body: JSON.stringify({ name: form.get("name"), companyName: form.get("companyName"), phone: form.get("phone"), email: form.get("email") }) }); setOpen(false); await load(); setMessage("OK:Cliente cadastrado."); } catch (error) { setMessage((error as Error).message); } }
  return <><SectionHeading eyebrow="RELACIONAMENTO" title="Clientes" description="Cadastro central para propostas e ordens de produção." action={<Button onClick={() => setOpen(true)}><Plus/>Novo cliente</Button>}/><Feedback message={message}/>{open && <form className="module-form" onSubmit={create}><div className="form-title"><b>Novo cliente</b><Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)}><X/></Button></div><div className="form-grid"><label>Nome<Input name="name" required/></label><label>Empresa<Input name="companyName"/></label><label>Telefone / WhatsApp<Input name="phone"/></label><label>E-mail<Input name="email" type="email"/></label></div><Button type="submit">Cadastrar cliente</Button></form>}{!loading && !filtered.length ? <EmptyState icon={Users} title="Nenhum cliente cadastrado" text="Cadastre o primeiro cliente para formar a base comercial."/> : <div className="module-table"><Table><TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Empresa</TableHead><TableHead>Telefone</TableHead><TableHead>E-mail</TableHead><TableHead>Cadastro</TableHead></TableRow></TableHeader><TableBody>{filtered.map((customer) => <TableRow key={customer.id}><TableCell><b>{customer.name}</b></TableCell><TableCell>{customer.company_name || "—"}</TableCell><TableCell>{customer.phone || "—"}</TableCell><TableCell>{customer.email || "—"}</TableCell><TableCell>{showDate(customer.created_at)}</TableCell></TableRow>)}</TableBody></Table></div>}</>;
}
