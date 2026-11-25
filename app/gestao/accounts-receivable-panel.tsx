"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, CalendarClock, Check, CircleDollarSign, Clock3, Download, FileText, MessageCircle, RefreshCw, Search, Send, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv } from "@/lib/csv-export";
import { whatsappUrl } from "@/lib/whatsapp";
import { useToast } from "./toast-context";

type CustomerAccount = { id: string; name: string; company_name?: string | null; billing_cycle: "imediato" | "semanal" | "mensal"; billing_weekday?: number | null; billing_day?: number | null; credit_limit?: number | null };
type Quote = { id: string; number: number; customer_id?: string | null; customer_name: string; company?: string | null; phone?: string | null; email?: string | null; service: string; estimated_value?: number | null; customers?: CustomerAccount | CustomerAccount[] | null };
type Receivable = { id: string; installment_number: number; due_date: string; amount: number; payment_method: string; status: "pendente" | "agendado" | "recebido" | "cancelado"; scheduled_on?: string | null; received_on?: string | null; received_amount?: number | null; interest_amount: number; fine_amount: number; discount_amount: number; bank_account?: string | null; notes?: string | null; quote_payment_id?: string | null; quotes: Quote };
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const brDate = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const paymentLabels: Record<string, string> = { boleto: "Boleto", pix: "PIX", transferencia: "Transferência", cartao: "Cartão", dinheiro: "Dinheiro", outro: "Outro" };
const weekdayLabels: Record<number, string> = { 1: "segunda", 2: "terça", 3: "quarta", 4: "quinta", 5: "sexta", 6: "sábado" };
const customerAccount = (quote: Quote) => Array.isArray(quote.customers) ? quote.customers[0] : quote.customers;

export function AccountsReceivablePanel({ search: globalSearch }: { search: string }) {
  const { notify } = useToast();
  const [periodMode, setPeriodMode] = useState<"all" | "open" | "month">("all");
  const [month, setMonth] = useState(currentMonth());
  const [items, setItems] = useState<Receivable[]>([]);
  const [status, setStatus] = useState("todos");
  const [localSearch, setLocalSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [receiving, setReceiving] = useState<Receivable | null>(null);
  const queryUrl = periodMode === "month"
    ? `/api/financeiro/contas-receber?month=${month}`
    : `/api/financeiro/contas-receber?scope=${periodMode}`;
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await fetch(queryUrl, { cache: "no-store" }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setItems(payload.installments); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível carregar os recebimentos."); }
    finally { setLoading(false); }
  }, [queryUrl]);
  useEffect(() => {
    let active = true;
    fetch(queryUrl, { cache: "no-store" }).then(async (response) => {
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error); return payload;
    }).then((payload) => { if (active) setItems(payload.installments); }).catch((error: Error) => { if (active) setMessage(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [queryUrl]);
  const visible = useMemo(() => {
    const query = `${globalSearch} ${localSearch}`.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) => { const effective = item.status === "pendente" && item.due_date < today() ? "vencido" : item.status; const text = `${item.quotes.customer_name} ${item.quotes.company ?? ""} ${item.quotes.service} ${item.quotes.number}`.toLocaleLowerCase("pt-BR"); return (status === "todos" || status === effective) && (!query || text.includes(query)); });
  }, [globalSearch, items, localSearch, status]);
  const summary = useMemo(() => items.reduce((acc, item) => { if (item.status === "recebido") acc.received += Number(item.received_amount ?? item.amount); else if (item.status !== "cancelado") { acc.open += Number(item.amount); if (item.due_date < today()) acc.overdue += Number(item.amount); else if (item.due_date === today()) acc.today += Number(item.amount); } return acc; }, { open: 0, overdue: 0, today: 0, received: 0 }), [items]);
  const customerStatements = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; cycle: "semanal" | "mensal"; closeLabel: string; total: number; count: number; overdue: number; nextDue: string; creditLimit: number }>();
    for (const item of items) {
      if (item.status === "recebido" || item.status === "cancelado") continue;
      const account = customerAccount(item.quotes);
      if (!account || account.billing_cycle === "imediato") continue;
      const current = groups.get(account.id) ?? {
        id: account.id,
        name: account.company_name || account.name,
        cycle: account.billing_cycle,
        closeLabel: account.billing_cycle === "mensal" ? `fechamento no dia ${account.billing_day ?? 28}` : `fechamento na ${weekdayLabels[account.billing_weekday ?? 5] ?? "sexta"}`,
        total: 0,
        count: 0,
        overdue: 0,
        nextDue: item.due_date,
        creditLimit: Number(account.credit_limit ?? 0),
      };
      current.total += Number(item.amount);
      current.count += 1;
      if (item.due_date < today()) current.overdue += Number(item.amount);
      if (item.due_date < current.nextDue) current.nextDue = item.due_date;
      groups.set(account.id, current);
    }
    return [...groups.values()].sort((a, b) => b.total - a.total);
  }, [items]);

  async function patch(body: object, success: string) { const response = await fetch("/api/financeiro/contas-receber", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json(); if (!response.ok) { const err = payload.error ?? "Não foi possível concluir."; setMessage(err); notify(err, "error"); return false; } await load(); setMessage(success); notify(success); return true; }
  function exportReceivablesCsv() {
    if (!visible.length) {
      notify("Nenhum recebimento filtrado para exportar.", "info");
      return;
    }
    downloadCsv(
      `contas-a-receber-${month}`,
      ["Vencimento", "Parcela", "Status", "Orçamento", "Cliente", "Serviço", "Forma", "Valor", "Recebido em"],
      visible.map((item) => [
        brDate(item.due_date),
        item.installment_number === 0 ? "Entrada" : `Parcela ${item.installment_number}`,
        item.status === "pendente" && item.due_date < today() ? "vencido" : item.status,
        `#${item.quotes.number}`,
        item.quotes.company || item.quotes.customer_name,
        item.quotes.service,
        paymentLabels[item.payment_method] ?? item.payment_method,
        Number(item.status === "recebido" ? item.received_amount ?? item.amount : item.amount),
        item.received_on ? brDate(item.received_on) : "",
      ]),
    );
    notify(`Exportados ${visible.length} recebimento(s) em CSV.`);
  }
  async function receive(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!receiving) return; const form = new FormData(event.currentTarget); const ok = await patch({ action: "receive", installmentId: receiving.id, receivedOn: form.get("receivedOn"), receivedAmount: Number(form.get("receivedAmount")), interest: Number(form.get("interest")), fine: Number(form.get("fine")), discount: Number(form.get("discount")), bankAccount: form.get("bankAccount"), paymentMethod: form.get("paymentMethod"), notes: form.get("notes") }, "Recebimento registrado e enviado ao caixa realizado."); if (ok) setReceiving(null); }
  function whatsapp(item: Receivable) { const destination = whatsappUrl(item.quotes.phone, `Olá, ${item.quotes.customer_name}! Lembramos que a parcela ${item.installment_number || "entrada"} do orçamento #${item.quotes.number}, no valor de ${currency.format(Number(item.amount))}, vence em ${brDate(item.due_date)}.`); if (!destination) { setMessage("Cadastre um WhatsApp válido no cliente antes de enviar a cobrança."); return; } window.open(destination, "_blank", "noopener,noreferrer"); }
  async function receipt(item: Receivable, send: boolean) {
    if (!item.quote_payment_id) { setMessage("Este recebimento antigo não possui um pagamento vinculado para emitir recibo."); return; }
    setMessage("");
    try {
      const response = await fetch("/api/financeiro/recibos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: item.quote_payment_id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      const receiptUrl = `${window.location.origin}${payload.path}`;
      if (send) {
        const destination = whatsappUrl(item.quotes.phone, `Olá, ${item.quotes.customer_name}! Segue o recibo de ${currency.format(Number(item.received_amount ?? item.amount))} referente ao orçamento #${item.quotes.number}: ${receiptUrl}`);
        if (!destination) { setMessage("Cadastre um WhatsApp válido no cliente antes de enviar o recibo."); return; }
        window.open(destination, "_blank", "noopener,noreferrer");
      } else window.open(receiptUrl, "_blank", "noopener,noreferrer");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível emitir o recibo."); }
  }

  return <section className="payables-panel">
    <div className="payables-toolbar">
      <div>
        <small>CONTAS A RECEBER & RECIBOS</small>
        <h2>Recebimentos de clientes</h2>
        <p>Clique em <b>Receber</b> para dar baixa no pagamento e em <b>Recibo</b> para imprimir ou enviar pelo WhatsApp.</p>
      </div>
      <div className="payables-actions">
        <div className="receivables-scope-toggle" role="group" aria-label="Período de visualização">
          <button type="button" className={periodMode === "all" ? "active" : ""} onClick={() => setPeriodMode("all")}>Todos os meses</button>
          <button type="button" className={periodMode === "open" ? "active" : ""} onClick={() => setPeriodMode("open")}>Só em aberto</button>
          <button type="button" className={periodMode === "month" ? "active" : ""} onClick={() => setPeriodMode("month")}>Por mês</button>
        </div>
        {periodMode === "month" && <label>Competência<Input type="month" value={month} onChange={(event) => setMonth(event.target.value)}/></label>}
        <Button variant="outline" onClick={exportReceivablesCsv} disabled={!visible.length}><Download/>CSV</Button>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw/>{loading ? "Atualizando" : "Atualizar"}</Button>
      </div>
    </div>
    {message && <div className={message.includes("registrado") ? "finance-message success" : "finance-message"}>{message.includes("registrado") ? <Check/> : <AlertTriangle/>}{message}</div>}
    <div className="payables-kpis"><article><span><CircleDollarSign/>A receber</span><b>{currency.format(summary.open)}</b><small>{periodMode === "month" ? "Saldo previsto nesta competência" : "Saldo total em aberto"}</small></article><article className="danger"><span><AlertTriangle/>Em atraso</span><b>{currency.format(summary.overdue)}</b><small>Prioridade de cobrança</small></article><article className="warning"><span><Clock3/>Vence hoje</span><b>{currency.format(summary.today)}</b><small>Confirmar pagamento</small></article><article className="success"><span><Banknote/>Recebido</span><b>{currency.format(summary.received)}</b><small>Integrado ao caixa e com recibo</small></article></div>
    {customerStatements.length > 0 && <section className="customer-statements"><header><div><small>CONTAS DE PERÍODO</small><h3>Clientes com fechamento semanal ou mensal</h3></div><span>{customerStatements.length} conta(s) ativa(s)</span></header><div>{customerStatements.map((statement) => <button key={statement.id} type="button" onClick={() => setLocalSearch(statement.name)}><span className={`statement-cycle ${statement.cycle}`}>{statement.cycle}</span><div><b>{statement.name}</b><small>{statement.closeLabel} · {statement.count} lançamento(s) · próximo vencimento {brDate(statement.nextDue)}</small></div><strong>{currency.format(statement.total)}{statement.overdue > 0 && <small>{currency.format(statement.overdue)} vencido</small>}{statement.creditLimit > 0 && <em>{Math.min(statement.total / statement.creditLimit * 100, 999).toFixed(0)}% do limite</em>}</strong></button>)}</div></section>}
    <div className="payables-filters"><label><Search/><Input placeholder="Buscar cliente, serviço ou orçamento" value={localSearch} onChange={(event) => setLocalSearch(event.target.value)}/></label><div>{["todos", "pendente", "agendado", "vencido", "recebido", "cancelado"].map((item) => <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item}</button>)}</div></div>
    {receiving && <form className="payment-register" onSubmit={receive}><header><div><small>BAIXA DE RECEBIMENTO</small><b>Orçamento #{receiving.quotes.number} · {receiving.quotes.customer_name}</b><span>Parcela {receiving.installment_number} · vencimento {brDate(receiving.due_date)}</span></div><Button type="button" size="icon" variant="ghost" onClick={() => setReceiving(null)}><X/></Button></header><div className="form-grid"><label>Data recebida<Input name="receivedOn" type="date" defaultValue={today()} required/></label><label>Valor recebido<Input name="receivedAmount" type="number" min="0.01" step="0.01" defaultValue={Number(receiving.amount).toFixed(2)} required/></label><label>Forma<select name="paymentMethod" defaultValue={receiving.payment_method}>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Conta / caixa<Input name="bankAccount" placeholder="Ex.: Sicredi, dinheiro"/></label><label>Juros<Input name="interest" type="number" min="0" step="0.01" defaultValue="0"/></label><label>Multa<Input name="fine" type="number" min="0" step="0.01" defaultValue="0"/></label><label>Desconto<Input name="discount" type="number" min="0" step="0.01" defaultValue="0"/></label><label className="span-2">Observações<Input name="notes" placeholder="Comprovante, negociação, referência..."/></label></div><div className="payment-register-actions"><Button type="submit"><Check/>Confirmar recebimento</Button></div></form>}
    <div className="payables-list">{visible.map((item) => { const effective = item.status === "pendente" && item.due_date < today() ? "vencido" : item.status; return <article className={`payable-card ${effective}`} key={item.id}><div className="payable-date"><small>VENCIMENTO</small><b>{brDate(item.due_date)}</b><span>{item.installment_number === 0 ? "Entrada" : `Parcela ${item.installment_number}`}</span></div><div className="payable-main"><div><span className={`status-pill ${effective}`}>{effective}</span></div><h3>{item.quotes.company || item.quotes.customer_name}</h3><p><UserRound/>Orçamento #{item.quotes.number}<span>·</span>{item.quotes.service}</p><small>{paymentLabels[item.payment_method] ?? item.payment_method}{item.scheduled_on ? ` · cobrança agendada para ${brDate(item.scheduled_on)}` : ""}</small></div><div className="payable-value"><small>VALOR</small><b>{currency.format(Number(item.status === "recebido" ? item.received_amount ?? item.amount : item.amount))}</b>{item.status === "recebido" ? <><span>Recebido em {brDate(item.received_on)}</span><div className="receipt-buttons"><Button size="sm" variant="outline" onClick={() => void receipt(item, false)}><FileText/>Recibo</Button><Button size="sm" onClick={() => void receipt(item, true)}><Send/>Enviar</Button></div></> : <div><Button size="sm" onClick={() => setReceiving(item)}><Banknote/>Receber</Button><Button size="sm" variant="outline" onClick={() => whatsapp(item)}><MessageCircle/>Cobrar</Button></div>}</div></article>; })}{!loading && !visible.length && <div className="finance-empty"><CalendarClock/><b>Nenhum recebimento encontrado</b><span>Feche um orçamento com saldo parcelado ou altere a competência.</span></div>}</div>
  </section>;
}
