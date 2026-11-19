"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calculator, Check, CircleDollarSign, Save, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

type FinancialMonth = {
  month: string;
  grossRevenue: number;
  receivedRevenue: number;
  otherRevenue: number;
  fixedCosts: number;
  otherFixedCosts: number;
  paidFixedCosts: number;
  nonCashCosts: number;
  variableCosts: number;
  otherVariableCosts: number;
  paidVariableCosts: number;
  paidInvestments: number;
  desiredProfit: number;
  businessDays: number;
  projectedContributionRate: number;
  historicalMonths: number;
  calculationBasis: "realized" | "projected" | "incomplete";
  inheritance: { fixedCosts: boolean; nonCashCosts: boolean; desiredProfit: boolean; source: "current" | "previous" | "pricing" | "empty"; sourceMonth: string | null };
  updatedAt?: string;
  payments: Array<{ id: string; amount: number; payment_type: string; payment_method: string; received_on: string; quotes?: { number?: number; customer_name?: string } | null }>;
  payables: Array<{ id: string; effectiveAmount: number; paid_on: string; payment_method: string; description: string; supplierName: string; categoryName: string; classification: string }>;
};

const emptyMonth = (month: string): FinancialMonth => ({
  month,
  grossRevenue: 0,
  receivedRevenue: 0,
  otherRevenue: 0,
  fixedCosts: 0,
  otherFixedCosts: 0,
  paidFixedCosts: 0,
  nonCashCosts: 0,
  variableCosts: 0,
  otherVariableCosts: 0,
  paidVariableCosts: 0,
  paidInvestments: 0,
  desiredProfit: 0,
  businessDays: 22,
  projectedContributionRate: 0,
  historicalMonths: 0,
  calculationBasis: "incomplete",
  inheritance: { fixedCosts: false, nonCashCosts: false, desiredProfit: false, source: "empty", sourceMonth: null },
  payments: [],
  payables: [],
});

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export function BreakEvenPanel() {
  const currentMonth = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit" }).format(new Date());
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<FinancialMonth>(() => emptyMonth(currentMonth));
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/financeiro/ponto-equilibrio?month=${month}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar os dados.");
        return payload;
      })
      .then((payload) => {
        if (!active) return;
        setExists(Boolean(payload.configured));
        setData(payload.financialMonth ?? emptyMonth(month));
      })
      .catch((error: Error) => active && setMessage(error.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [month]);

  const metrics = useMemo(() => {
    const contribution = data.grossRevenue - data.variableCosts;
    const realizedContributionRate = data.grossRevenue > 0 ? contribution / data.grossRevenue : 0;
    const contributionRate = data.grossRevenue > 0 ? realizedContributionRate : data.projectedContributionRate;
    const accountingBreakEven = contributionRate > 0 ? data.fixedCosts / contributionRate : 0;
    const cashFixedCosts = Math.max(data.fixedCosts - data.nonCashCosts, 0);
    const financialBreakEven = contributionRate > 0 ? cashFixedCosts / contributionRate : 0;
    const economicBreakEven = contributionRate > 0 ? (data.fixedCosts + data.desiredProfit) / contributionRate : 0;
    const progress = accountingBreakEven > 0 ? (data.grossRevenue / accountingBreakEven) * 100 : 0;
    return {
      contribution,
      contributionRate,
      accountingBreakEven,
      financialBreakEven,
      economicBreakEven,
      dailyBreakEven: accountingBreakEven / Math.max(data.businessDays, 1),
      remaining: Math.max(accountingBreakEven - data.grossRevenue, 0),
      progress,
    };
  }, [data]);

  function update(field: keyof FinancialMonth, value: string) {
    const amount = Number(value) || 0;
    setData((current) => {
      if (field === "otherRevenue") return { ...current, otherRevenue: amount, grossRevenue: current.receivedRevenue + amount };
      if (field === "otherFixedCosts") return { ...current, otherFixedCosts: amount, fixedCosts: current.paidFixedCosts + amount };
      if (field === "otherVariableCosts") return { ...current, otherVariableCosts: amount, variableCosts: current.paidVariableCosts + amount };
      return { ...current, [field]: amount };
    });
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/financeiro/ponto-equilibrio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, month }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar.");
      setExists(true);
      setData((current) => ({ ...current, updatedAt: payload.updatedAt }));
      setMessage("Competência salva com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  function changeMonth(value: string) {
    setLoading(true);
    setMessage("");
    setMonth(value);
  }

  const hasRevenue = data.grossRevenue > 0;
  const hasFixedCosts = data.fixedCosts > 0;
  const negativeContribution = hasRevenue && metrics.contributionRate <= 0;
  const ready = hasFixedCosts && metrics.contributionRate > 0;
  const monthLabel = new Date(`${month}-02T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const projected = !hasRevenue && ready && data.calculationBasis === "projected";
  const inheritedSource = data.inheritance.source === "pricing" ? "cadastro de custos fixos da Precificação" : data.inheritance.sourceMonth ? `competência de ${new Date(`${data.inheritance.sourceMonth}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}` : "última competência configurada";

  return <section className="break-even">
    <header className="finance-heading">
      <div><p>SAÚDE FINANCEIRA</p><h1>Ponto de equilíbrio</h1><span>Descubra o faturamento mínimo para cobrir a operação antes de considerar lucro.</span></div>
      <div className="finance-actions"><label>Competência<Input type="month" value={month} onChange={(event) => changeMonth(event.target.value)} /></label><Button onClick={save} disabled={saving || loading}><Save/>{saving ? "Salvando..." : "Salvar mês"}</Button></div>
    </header>

    {!exists && !loading && <div className="finance-notice"><AlertTriangle/><div><b>Nova competência aberta automaticamente</b><span>O sistema carregou os parâmetros recorrentes disponíveis. Revise os valores de {monthLabel} e salve apenas se precisar alterá-los nesta competência.</span></div></div>}
    {data.inheritance.fixedCosts && !loading && <div className="finance-notice projection"><TrendingUp/><div><b>Configuração recorrente carregada automaticamente</b><span>Custos fixos e demais parâmetros disponíveis vieram do {inheritedSource}. Receitas e despesas realizadas continuam exclusivas de {monthLabel}.</span></div></div>}
    {projected && <div className="finance-notice projection"><Target/><div><b>Ponto de equilíbrio projetado</b><span>A margem de contribuição usa a média ponderada de {data.historicalMonths} competência(s) anterior(es). Assim que houver receita em {monthLabel}, o painel passa automaticamente para realizado.</span></div></div>}
    {exists && negativeContribution && <div className="finance-notice danger"><AlertTriangle/><div><b>Margem de contribuição negativa: {currency.format(metrics.contribution)}</b><span>O faturamento de {currency.format(data.grossRevenue)} está abaixo dos custos variáveis de {currency.format(data.variableCosts)}. Com margem de {percent.format(metrics.contributionRate)}, cada real vendido ainda não contribui para pagar os custos fixos. Revise a classificação das despesas ou a formação de preço.</span></div></div>}
    {message && <div className={message.includes("sucesso") ? "finance-message success" : "finance-message"}>{message.includes("sucesso") && <Check/>}{message}</div>}

    <div className="break-even-overview">
      <article className="equilibrium-card">
        <div className={`equilibrium-ring ${negativeContribution ? "negative" : ""}`} style={{ "--progress": `${ready ? Math.min(metrics.progress, 100) : 0}%` } as React.CSSProperties}><div><b>{ready ? `${Math.round(metrics.progress)}%` : negativeContribution ? percent.format(metrics.contributionRate) : "—"}</b><span>{negativeContribution ? "margem" : "atingido"}</span></div></div>
        <div><small>PONTO DE EQUILÍBRIO CONTÁBIL · {projected ? "PROJETADO" : ready ? "REALIZADO" : "AGUARDANDO BASE"}</small><strong>{ready ? currency.format(metrics.accountingBreakEven) : negativeContribution ? "Não calculável" : exists ? "Complete a competência" : "Informe os valores"}</strong><p>{projected ? `Margem histórica de ${percent.format(metrics.contributionRate)} · ${currency.format(metrics.accountingBreakEven)} de meta para ${monthLabel}` : ready ? `${currency.format(data.grossRevenue)} faturados · ${currency.format(metrics.remaining)} restantes` : negativeContribution ? `${currency.format(data.grossRevenue)} de receita − ${currency.format(data.variableCosts)} de custos variáveis = ${currency.format(metrics.contribution)} de contribuição.` : "Custos fixos e uma margem de contribuição histórica ou realizada são necessários."}</p><Progress value={ready ? Math.min(metrics.progress, 100) : 0} /></div>
      </article>
      <div className="finance-metric-grid">
        <Metric icon={TrendingUp} tone={negativeContribution ? "danger" : "default"} label="Margem de contribuição" value={hasRevenue ? percent.format(metrics.contributionRate) : projected ? `${percent.format(metrics.contributionRate)} projetada` : "Aguardando histórico"} detail={hasRevenue ? `${currency.format(metrics.contribution)} após ${currency.format(data.variableCosts)} variáveis` : projected ? `Média ponderada de ${data.historicalMonths} competência(s)` : "Receita menos custos variáveis"}/>
        <Metric icon={CircleDollarSign} label="Equilíbrio financeiro" value={ready ? currency.format(metrics.financialBreakEven) : negativeContribution ? "Não calculável" : "Aguardando dados"} detail="Desconsidera depreciação e provisões"/>
        <Metric icon={Target} label="Meta econômica" value={ready ? currency.format(metrics.economicBreakEven) : negativeContribution ? "Não calculável" : "Aguardando dados"} detail="Equilíbrio mais o lucro desejado"/>
        <Metric icon={Calculator} label="Meta por dia útil" value={ready ? currency.format(metrics.dailyBreakEven) : negativeContribution ? "Não calculável" : "Aguardando dados"} detail={`${data.businessDays} dias úteis na competência`}/>
      </div>
    </div>

    <div className="finance-entry">
      <div className="finance-entry-title"><div><small>DADOS DA COMPETÊNCIA</small><h2>Base do cálculo</h2></div><p>Use valores realizados ou uma projeção identificada internamente. Custos variáveis incluem materiais, terceirização, impostos e comissões proporcionais às vendas.</p></div>
      <div className="finance-fields">
        <label className="finance-field automatic-revenue"><span>Recebimentos de orçamentos</span><div><i>R$</i><Input value={data.receivedRevenue.toFixed(2)} readOnly /></div><small>Atualizado automaticamente pelas entradas e pagamentos</small></label>
        <MoneyField label="Outras receitas" hint="Receitas sem orçamento cadastrado" value={data.otherRevenue} onChange={(value) => update("otherRevenue", value)}/>
        <label className="finance-field automatic-revenue"><span>Contas pagas — custos fixos</span><div><i>R$</i><Input value={data.paidFixedCosts.toFixed(2)} readOnly /></div><small>Aluguel, estrutura e demais categorias fixas</small></label>
        <MoneyField label="Outros custos fixos" hint="Valores não cadastrados nas contas a pagar" value={data.otherFixedCosts} onChange={(value) => update("otherFixedCosts", value)}/>
        <label className="finance-field automatic-revenue"><span>Contas pagas — custos variáveis</span><div><i>R$</i><Input value={data.paidVariableCosts.toFixed(2)} readOnly /></div><small>Insumos, terceiros, impostos e despesas financeiras</small></label>
        <MoneyField label="Outros custos variáveis" hint="Valores não cadastrados nas contas a pagar" value={data.otherVariableCosts} onChange={(value) => update("otherVariableCosts", value)}/>
        <MoneyField label="Custos sem saída de caixa" hint="Depreciação e provisões" value={data.nonCashCosts} onChange={(value) => update("nonCashCosts", value)}/>
        <MoneyField label="Lucro mínimo desejado" hint="Meta econômica do mês" value={data.desiredProfit} onChange={(value) => update("desiredProfit", value)}/>
        <label className="finance-field"><span>Dias úteis</span><Input type="number" min="1" max="31" value={data.businessDays} onChange={(event) => update("businessDays", event.target.value)} /><small>Usado na meta diária</small></label>
      </div>
    </div>
    {data.paidInvestments > 0 && <div className="finance-notice"><AlertTriangle/><div><b>Investimentos separados do ponto de equilíbrio</b><span>{currency.format(data.paidInvestments)} em máquinas ou equipamentos foi considerado no caixa, mas não como custo operacional desta fórmula.</span></div></div>}
    <div className="finance-entry payment-history">
      <div className="finance-entry-title"><div><small>RECEITA AUTOMÁTICA</small><h2>Recebimentos considerados</h2></div><p>Cada entrada registrada no fechamento de um orçamento aparece aqui e compõe o faturamento do mês.</p></div>
      {data.payments.length ? <div className="payment-list">{data.payments.map((payment) => <article key={payment.id}><div><b>#{payment.quotes?.number ?? "—"} · {payment.quotes?.customer_name ?? "Cliente"}</b><small>{new Date(`${payment.received_on}T12:00:00`).toLocaleDateString("pt-BR")} · {payment.payment_method}</small></div><strong>{currency.format(Number(payment.amount))}</strong></article>)}</div> : <div className="finance-empty">Nenhuma entrada ou pagamento recebido nesta competência.</div>}
    </div>
    <div className="finance-entry payment-history payable-history">
      <div className="finance-entry-title"><div><small>DESPESA AUTOMÁTICA</small><h2>Contas pagas consideradas</h2></div><p>Custos fixos e variáveis entram automaticamente conforme a categoria da conta. Investimentos permanecem separados.</p></div>
      {data.payables.length ? <div className="payment-list">{data.payables.map((payable) => <article key={payable.id}><div><b>{payable.description}</b><small>{payable.supplierName} · {payable.categoryName} · {new Date(`${payable.paid_on}T12:00:00`).toLocaleDateString("pt-BR")}</small></div><strong>- {currency.format(Number(payable.effectiveAmount))}</strong></article>)}</div> : <div className="finance-empty">Nenhuma conta paga nesta competência.</div>}
    </div>
  </section>;
}

function Metric({ icon: Icon, label, value, detail, tone = "default" }: { icon: typeof TrendingUp; label: string; value: string; detail: string; tone?: "default" | "danger" }) {
  return <article className={tone === "danger" ? "danger" : ""}><Icon/><span>{label}</span><b>{value}</b><small>{detail}</small></article>;
}

function MoneyField({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (value: string) => void }) {
  return <label className="finance-field"><span>{label}</span><div><i>R$</i><Input type="number" min="0" step="0.01" value={value || ""} placeholder="0,00" onChange={(event) => onChange(event.target.value)} /></div><small>{hint}</small></label>;
}
