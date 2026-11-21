"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, CalendarClock, Check, ChevronDown, CircleDollarSign, Clock3, Copy, FileCheck2, FileUp, Plus, ReceiptText, RefreshCw, Search, Store, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Supplier = { id: string; legal_name: string; trade_name?: string | null; document?: string | null; default_payment_terms?: string | null; active: boolean };
type Category = { id: string; name: string; classification: string; color?: string | null };
type CostCenter = { id: string; name: string; code?: string | null };
type Payable = { id: string; description: string; document_type: string; document_number?: string | null; purchase_order?: string | null; issue_date: string; competence_date: string; total_amount: number; installment_count: number; recurring: boolean; recurrence_frequency?: string | null; notes?: string | null; status: string; suppliers?: Supplier | null; expense_categories?: Category | null; cost_centers?: CostCenter | null };
type Installment = { id: string; payable_id: string; installment_number: number; due_date: string; amount: number; payment_method: string; digitable_line?: string | null; pix_code?: string | null; document_url?: string | null; status: "pendente" | "agendado" | "pago" | "cancelado"; scheduled_on?: string | null; paid_on?: string | null; paid_amount?: number | null; interest_amount: number; fine_amount: number; discount_amount: number; bank_account?: string | null; receipt_url?: string | null; payment_notes?: string | null; payables: Payable };
type Data = { installments: Installment[]; suppliers: Supplier[]; categories: Category[]; costCenters: CostCenter[] };
type DraftInstallment = { installmentNumber: number; dueDate: string; amount: string; paymentMethod: string; digitableLine: string; pixCode: string; documentUrl: string };
type ExtractedDocument = { documentKind: string; supplierName: string; supplierDocument: string; documentNumber: string; issueDate: string; dueDate: string; totalAmount: number | null; digitableLine: string; installments: Array<{ number: number; dueDate: string; amount: number; digitableLine?: string }>; confidence: number; needsOcr: boolean; warnings: string[] };
type ImportResult = { documentId: string; fileName: string; extracted: ExtractedDocument };

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const brDate = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const paymentLabels: Record<string, string> = { boleto: "Boleto", pix: "PIX", transferencia: "Transferência", cartao: "Cartão", debito_automatico: "Débito automático", dinheiro: "Dinheiro", outro: "Outro" };
const documentLabels: Record<string, string> = { boleto: "Boleto", nota_fiscal: "Nota fiscal", fatura: "Fatura", recibo: "Recibo", contrato: "Contrato", imposto: "Imposto/guia", folha: "Folha/pessoal", outro: "Outro" };

function addFrequency(value: string, index: number, frequency: string) {
  const date = new Date(`${value}T12:00:00`);
  const days: Record<string, number> = { semanal: 7, quinzenal: 15 };
  if (days[frequency]) date.setDate(date.getDate() + days[frequency] * index);
  else date.setMonth(date.getMonth() + ({ mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }[frequency] ?? 1) * index);
  return date.toISOString().slice(0, 10);
}

function buildInstallments(total: number, count: number, firstDue: string, frequency: string, method: string): DraftInstallment[] {
  const totalCents = Math.round(total * 100), base = Math.floor(totalCents / Math.max(count, 1)), remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => ({ installmentNumber: index + 1, dueDate: addFrequency(firstDue, index, frequency), amount: ((base + (index === count - 1 ? remainder : 0)) / 100).toFixed(2), paymentMethod: method, digitableLine: "", pixCode: "", documentUrl: "" }));
}

export function AccountsPayablePanel({ search: globalSearch }: { search: string }) {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<Data>({ installments: [], suppliers: [], categories: [], costCenters: [] });
  const [status, setStatus] = useState("todos");
  const [localSearch, setLocalSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState(false);
  const [message, setMessage] = useState("");
  const [payment, setPayment] = useState<Installment | null>(null);
  const [installments, setInstallments] = useState<DraftInstallment[]>(buildInstallments(0, 1, today(), "mensal", "boleto"));
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importDraft, setImportDraft] = useState<ImportResult | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");

  const closeImporter = useCallback(() => { if (!importing) { setImportOpen(false); setImportResult(null); setSelectedFileName(""); } }, [importing]);
  useEffect(() => {
    if (!importOpen) return;
    const previousOverflow = document.body.style.overflow;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") closeImporter(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", escape); };
  }, [closeImporter, importOpen]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/financeiro/contas-pagar?month=${month}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar as contas.");
      setData(payload);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível carregar as contas."); }
    finally { setLoading(false); }
  }, [month]);
  useEffect(() => {
    let active = true;
    fetch(`/api/financeiro/contas-pagar?month=${month}`, { cache: "no-store" }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar as contas.");
      return payload;
    }).then((payload) => { if (active) setData(payload); }).catch((error: Error) => { if (active) setMessage(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month]);

  const visible = useMemo(() => {
    const query = `${globalSearch} ${localSearch}`.trim().toLocaleLowerCase("pt-BR"), now = today();
    return data.installments.filter((item) => {
      const effective = item.status === "pendente" && item.due_date < now ? "vencido" : item.status;
      const text = `${item.payables.description} ${item.payables.suppliers?.legal_name ?? ""} ${item.payables.suppliers?.trade_name ?? ""} ${item.payables.document_number ?? ""}`.toLocaleLowerCase("pt-BR");
      return (status === "todos" || effective === status) && (!query || text.includes(query));
    });
  }, [data.installments, globalSearch, localSearch, status]);

  const summary = useMemo(() => data.installments.reduce((acc, item) => {
    const amount = item.status === "pago" ? Number(item.paid_amount ?? item.amount) : Number(item.amount);
    if (item.status === "pago") acc.paid += amount;
    else if (item.status !== "cancelado") { acc.open += amount; if (item.due_date < today()) acc.overdue += amount; else if (item.due_date === today()) acc.today += amount; }
    return acc;
  }, { open: 0, paid: 0, overdue: 0, today: 0 }), [data.installments]);

  async function createPayable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const form = new FormData(event.currentTarget), total = Number(form.get("totalAmount")), count = Number(form.get("installmentCount"));
    if (installments.length !== count || Math.abs(installments.reduce((sum, item) => sum + Number(item.amount), 0) - total) > .01) { setMessage("Gere novamente as parcelas após alterar o valor total ou a quantidade."); return; }
    const body = { supplierId: String(form.get("supplierId") ?? ""), expenseCategoryId: String(form.get("expenseCategoryId") ?? ""), costCenterId: String(form.get("costCenterId") ?? ""), description: String(form.get("description") ?? ""), documentType: String(form.get("documentType") ?? "boleto"), documentNumber: String(form.get("documentNumber") ?? ""), purchaseOrder: String(form.get("purchaseOrder") ?? ""), issueDate: String(form.get("issueDate") ?? ""), competenceDate: String(form.get("competenceDate") ?? ""), totalAmount: total, recurring: form.get("recurring") === "on", recurrenceFrequency: String(form.get("frequency") ?? "mensal"), recurrenceEndDate: String(form.get("recurrenceEndDate") ?? ""), notes: String(form.get("notes") ?? ""), installments, financialDocumentId: importDraft?.documentId };
    const response = await fetch("/api/financeiro/contas-pagar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "Não foi possível cadastrar a conta."); return; }
    setComposer(false); setImportDraft(null); await load(); setMessage("Conta a pagar cadastrada com sucesso.");
  }

  async function analyzeDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setImporting(true); setImportResult(null);
    const form = new FormData(event.currentTarget);
    try { const response = await fetch("/api/financeiro/documentos/analisar", { method: "POST", body: form }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setImportResult(payload); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível analisar o documento."); }
    finally { setImporting(false); }
  }

  function useImportedDocument() {
    if (!importResult) return;
    const extracted = importResult.extracted;
    const source = extracted.installments.length ? extracted.installments : extracted.totalAmount && extracted.dueDate ? [{ number: 1, dueDate: extracted.dueDate, amount: extracted.totalAmount, digitableLine: extracted.digitableLine }] : [];
    setInstallments(source.length ? source.map((item, index) => ({ installmentNumber: index + 1, dueDate: item.dueDate || today(), amount: Number(item.amount).toFixed(2), paymentMethod: extracted.documentKind === "boleto" ? "boleto" : "outro", digitableLine: item.digitableLine || (index === 0 ? extracted.digitableLine : ""), pixCode: "", documentUrl: "" })) : buildInstallments(extracted.totalAmount ?? 0, 1, extracted.dueDate || today(), "mensal", extracted.documentKind === "boleto" ? "boleto" : "outro"));
    setImportDraft(importResult); setImportOpen(false); setComposer(true);
  }

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!payment) return;
    const form = new FormData(event.currentTarget);
    const body = { action: "pay", installmentId: payment.id, paidOn: String(form.get("paidOn")), paidAmount: Number(form.get("paidAmount")), interest: Number(form.get("interest")), fine: Number(form.get("fine")), discount: Number(form.get("discount")), bankAccount: String(form.get("bankAccount") ?? ""), receiptUrl: String(form.get("receiptUrl") ?? ""), notes: String(form.get("notes") ?? "") };
    const response = await fetch("/api/financeiro/contas-pagar", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "Não foi possível registrar o pagamento."); return; }
    setPayment(null); await load(); setMessage("Pagamento registrado com sucesso.");
  }

  async function schedule(form: HTMLFormElement) {
    if (!payment) return;
    const values = new FormData(form), scheduledOn = String(values.get("scheduledOn") ?? "");
    if (!scheduledOn) { setMessage("Informe a data programada para o pagamento."); return; }
    const response = await fetch("/api/financeiro/contas-pagar", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "schedule", installmentId: payment.id, scheduledOn }) });
    const payload = await response.json();
    if (!response.ok) { setMessage(payload.error ?? "Não foi possível agendar o pagamento."); return; }
    setPayment(null); await load(); setMessage("Pagamento agendado com sucesso.");
  }

  async function cancel(payableId: string) {
    if (!window.confirm("Cancelar esta conta e todas as parcelas ainda abertas?")) return;
    const response = await fetch("/api/financeiro/contas-pagar", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel", payableId }) });
    const payload = await response.json(); if (response.ok) { await load(); setMessage("Conta cancelada."); } else setMessage(payload.error ?? "Não foi possível cancelar.");
  }

  function regenerate(form: HTMLFormElement) {
    const values = new FormData(form), total = Number(values.get("totalAmount")), count = Math.max(1, Math.min(120, Number(values.get("installmentCount")) || 1));
    setInstallments(buildInstallments(total, count, String(values.get("firstDue") || today()), String(values.get("frequency") || "mensal"), String(values.get("defaultPaymentMethod") || "boleto")));
  }

  return <section className="payables-panel">
    <div className="payables-toolbar"><div><small>CONTAS A PAGAR</small><h2>Compromissos financeiros</h2><p>Boletos, despesas recorrentes, fornecedores, parcelas e pagamentos.</p></div><div className="payables-actions"><label>Competência<Input type="month" value={month} onChange={(event) => { setLoading(true); setMonth(event.target.value); }}/></label><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw/>{loading ? "Atualizando" : "Atualizar"}</Button><Button variant="outline" onClick={() => { setImportResult(null); setSelectedFileName(""); setImportOpen(true); }}><FileUp/>Importar PDF/XML</Button><Button onClick={() => { setImportDraft(null); setInstallments(buildInstallments(0, 1, today(), "mensal", "boleto")); setComposer(true); }}><Plus/>Nova conta</Button></div></div>
    {message && <div className={message.includes("sucesso") ? "finance-message success" : "finance-message"}>{message.includes("sucesso") ? <Check/> : <AlertTriangle/>}{message}</div>}
    <div className="payables-kpis"><article><span><ReceiptText/>Em aberto</span><b>{currency.format(summary.open)}</b><small>{data.installments.filter((item) => !["pago", "cancelado"].includes(item.status)).length} parcela(s)</small></article><article className="danger"><span><AlertTriangle/>Vencido</span><b>{currency.format(summary.overdue)}</b><small>Exige atenção imediata</small></article><article className="warning"><span><Clock3/>Vence hoje</span><b>{currency.format(summary.today)}</b><small>Programar ou pagar</small></article><article className="success"><span><CircleDollarSign/>Pago no mês</span><b>{currency.format(summary.paid)}</b><small>Caixa realizado</small></article></div>
    <div className="payables-filters"><label><Search/><Input placeholder="Buscar fornecedor, conta ou documento" value={localSearch} onChange={(event) => setLocalSearch(event.target.value)}/></label><div>{["todos", "pendente", "agendado", "vencido", "pago", "cancelado"].map((item) => <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item === "todos" ? "Todos" : item}</button>)}</div></div>
    {payment && <form className="payment-register" onSubmit={pay}><header><div><small>BAIXA FINANCEIRA</small><b>{payment.payables.description}</b><span>{payment.payables.suppliers?.trade_name || payment.payables.suppliers?.legal_name || "Sem fornecedor"} · vencimento {brDate(payment.due_date)}</span></div><Button type="button" size="icon" variant="ghost" onClick={() => setPayment(null)}><X/></Button></header><div className="form-grid"><label>Data programada<Input name="scheduledOn" type="date" defaultValue={payment.scheduled_on || payment.due_date}/><small>Use “Somente agendar” para não registrar a baixa.</small></label><label>Data do pagamento<Input name="paidOn" type="date" defaultValue={today()} required/></label><label>Valor principal pago<Input name="paidAmount" type="number" min="0" step="0.01" defaultValue={Number(payment.amount).toFixed(2)} required/></label><label>Juros<Input name="interest" type="number" min="0" step="0.01" defaultValue="0"/></label><label>Multa<Input name="fine" type="number" min="0" step="0.01" defaultValue="0"/></label><label>Desconto<Input name="discount" type="number" min="0" step="0.01" defaultValue="0"/></label><label>Conta bancária / caixa<Input name="bankAccount" placeholder="Ex.: Sicredi, Caixa, dinheiro"/></label><label className="span-2">Link do comprovante<Input name="receiptUrl" type="url" placeholder="https://..."/></label><label className="span-2">Observações<Input name="notes" placeholder="Autenticação, responsável, observações..."/></label></div><div className="payment-register-actions"><Button type="button" variant="outline" onClick={(event) => void schedule(event.currentTarget.form!)}><CalendarClock/>Somente agendar</Button><Button type="submit"><Check/>Confirmar pagamento</Button></div></form>}
    <div className="payables-list">
      {visible.map((item) => { const effective = item.status === "pendente" && item.due_date < today() ? "vencido" : item.status; return <article key={item.id} className={`payable-card ${effective}`}><div className="payable-date"><small>VENCIMENTO</small><b>{brDate(item.due_date)}</b><span>{item.installment_number}/{item.payables.installment_count}</span></div><div className="payable-main"><div><span className={`status-pill ${effective}`}>{effective}</span>{item.payables.recurring && <span className="status-pill neutral">recorrente</span>}</div><h3>{item.payables.description}</h3><p><Store/>{item.payables.suppliers?.trade_name || item.payables.suppliers?.legal_name || "Sem fornecedor"}<span>·</span>{item.payables.expense_categories?.name ?? "Sem categoria"}<span>·</span>{item.payables.cost_centers?.name ?? "Sem centro"}</p><small>{documentLabels[item.payables.document_type] ?? item.payables.document_type}{item.payables.document_number ? ` nº ${item.payables.document_number}` : ""} · {paymentLabels[item.payment_method] ?? item.payment_method}</small>{item.digitable_line && <button className="copy-line" onClick={() => navigator.clipboard.writeText(item.digitable_line ?? "")}><Copy/>Copiar linha digitável</button>}</div><div className="payable-value"><small>VALOR DA PARCELA</small><b>{currency.format(Number(item.status === "pago" ? item.paid_amount ?? item.amount : item.amount))}</b>{item.status === "pago" ? <span>Pago em {brDate(item.paid_on)}</span> : <div><Button size="sm" onClick={() => setPayment(item)}><Banknote/>Registrar pagamento</Button><Button size="sm" variant="ghost" onClick={() => void cancel(item.payables.id)}>Cancelar</Button></div>}</div></article>; })}
      {!loading && !visible.length && <div className="finance-empty"><ReceiptText/><b>Nenhuma conta encontrada</b><span>Cadastre uma conta ou altere os filtros desta competência.</span></div>}
    </div>
    {importOpen && <div className="finance-modal document-import-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeImporter(); }}><form className="document-importer" role="dialog" aria-modal="true" aria-labelledby="document-import-title" onSubmit={analyzeDocument} onMouseDown={(event) => event.stopPropagation()}><header><div><small>ENTRADA INTELIGENTE</small><h2 id="document-import-title">Importar documento financeiro</h2><p>Leia um boleto, nota fiscal ou fatura e revise tudo antes do lançamento.</p></div><button className="document-import-close" type="button" onClick={closeImporter} aria-label="Fechar importação"><X/><span>Fechar</span></button></header>{!importResult ? <div className="document-import-content"><label className="document-drop"><UploadCloud/><b>Selecione o PDF ou XML</b><span>O arquivo ficará privado e não será lançado sem sua confirmação.</span><Input name="file" type="file" accept=".pdf,.xml,application/pdf,application/xml,text/xml" required onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name ?? "")}/><em>{selectedFileName || "Nenhum arquivo selecionado"}</em></label><div className="document-import-help"><span><b>PDF</b>Boletos e faturas com texto selecionável.</span><span><b>XML</b>NF-e e cobranças com maior precisão.</span><span><b>Segurança</b>Limite de 10 MB e bloqueio de duplicidade.</span></div></div> : <div className="extraction-review"><div className="extraction-score"><FileCheck2/><div><b>{importResult.fileName}</b><span>Confiança da leitura: {importResult.extracted.confidence}%</span></div><strong>{importResult.extracted.needsOcr ? "OCR necessário" : "Lido"}</strong></div><div className="extraction-fields"><span><small>Fornecedor</small><b>{importResult.extracted.supplierName || "Não identificado"}</b></span><span><small>CPF/CNPJ</small><b>{importResult.extracted.supplierDocument || "Não identificado"}</b></span><span><small>Documento</small><b>{importResult.extracted.documentNumber || "Não identificado"}</b></span><span><small>Vencimento</small><b>{brDate(importResult.extracted.dueDate)}</b></span><span><small>Valor</small><b>{importResult.extracted.totalAmount ? currency.format(importResult.extracted.totalAmount) : "Não identificado"}</b></span><span><small>Parcelas encontradas</small><b>{importResult.extracted.installments.length || 1}</b></span></div>{importResult.extracted.warnings.length > 0 && <div className="extraction-warnings"><AlertTriangle/>{importResult.extracted.warnings.join(" ")}</div>}</div>}<footer><button className="document-import-cancel" type="button" onClick={closeImporter}>Cancelar</button>{importResult ? <button className="document-import-submit" type="button" onClick={useImportedDocument}><Check/>Revisar e completar cadastro</button> : <button className="document-import-submit" type="submit" disabled={importing || !selectedFileName}><FileUp/>{importing ? "Lendo documento..." : "Analisar arquivo"}</button>}</footer></form></div>}
    {composer && <div className="finance-modal"><form key={importDraft?.documentId ?? "manual"} className="payable-composer" onSubmit={createPayable}><header><div><small>{importDraft ? "REVISÃO DO DOCUMENTO" : "NOVO COMPROMISSO"}</small><h2>Cadastrar conta a pagar</h2><p>{importDraft ? "Confira os dados reconhecidos e complete a classificação antes de salvar." : "Registre a origem, classificação e todos os títulos do pagamento."}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setComposer(false)}><X/></Button></header><div className="form-grid">
      <label className="span-2">Descrição da despesa<Input name="description" defaultValue={importDraft ? `${documentLabels[importDraft.extracted.documentKind] ?? "Documento"} — ${importDraft.extracted.supplierName || "fornecedor a conferir"}` : ""} placeholder="Ex.: Compra de lona 440g — fornecedor X" required/></label>
      <label>Fornecedor<select name="supplierId" defaultValue={importDraft ? data.suppliers.find((item) => (item.document ?? "").replace(/\D/g, "") === importDraft.extracted.supplierDocument)?.id ?? "" : ""}><option value="">Sem fornecedor / não encontrado</option>{data.suppliers.map((item) => <option key={item.id} value={item.id}>{item.trade_name || item.legal_name}</option>)}</select>{importDraft?.extracted.supplierName && <small>Extraído: {importDraft.extracted.supplierName}</small>}</label>
      <label>Categoria<select name="expenseCategoryId" required><option value="">Selecione...</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Centro de custo<select name="costCenterId" required><option value="">Selecione...</option>{data.costCenters.map((item) => <option key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ""}{item.name}</option>)}</select></label>
      <label>Tipo do documento<select name="documentType" defaultValue={importDraft?.extracted.documentKind ?? "boleto"}><option value="boleto">Boleto</option><option value="nota_fiscal">Nota fiscal</option><option value="fatura">Fatura</option><option value="recibo">Recibo</option><option value="contrato">Contrato</option><option value="imposto">Imposto / guia</option><option value="folha">Folha / pessoal</option><option value="outro">Outro</option></select></label>
      <label>Número do documento<Input name="documentNumber" defaultValue={importDraft?.extracted.documentNumber ?? ""} placeholder="NF, fatura ou boleto"/></label><label>Pedido de compra<Input name="purchaseOrder" placeholder="Opcional"/></label>
      <label>Emissão<Input name="issueDate" type="date" defaultValue={importDraft?.extracted.issueDate || today()} required/></label><label>Competência<Input name="competenceDate" type="date" defaultValue={importDraft?.extracted.issueDate || today()} required/></label>
      <label>Valor total<Input name="totalAmount" type="number" min="0.01" step="0.01" defaultValue={importDraft?.extracted.totalAmount ?? ""} required/></label><label>Número de parcelas<Input name="installmentCount" type="number" min="1" max="120" step="1" defaultValue={installments.length || 1} required/></label>
      <label>Primeiro vencimento<Input name="firstDue" type="date" defaultValue={importDraft?.extracted.dueDate || today()} required/></label><label>Intervalo<select name="frequency" defaultValue="mensal"><option value="semanal">Semanal</option><option value="quinzenal">Quinzenal</option><option value="mensal">Mensal</option><option value="bimestral">Bimestral</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option></select></label>
      <label>Forma de pagamento<select name="defaultPaymentMethod" defaultValue={importDraft?.extracted.documentKind === "boleto" ? "boleto" : "outro"}><option value="boleto">Boleto</option><option value="pix">PIX</option><option value="transferencia">Transferência</option><option value="cartao">Cartão</option><option value="debito_automatico">Débito automático</option><option value="dinheiro">Dinheiro</option><option value="outro">Outro</option></select></label>
      <label className="checkbox-label"><input name="recurring" type="checkbox"/>Despesa recorrente</label><label>Fim da recorrência<Input name="recurrenceEndDate" type="date"/></label>
      <label className="span-2">Observações<Input name="notes" placeholder="Contrato, referência interna, regras do fornecedor..."/></label>
    </div><div className="installment-generator"><div><b>Parcelas e boletos</b><small>Gere a grade depois de preencher valor, quantidade, vencimento e intervalo.</small></div><Button type="button" variant="outline" onClick={(event) => regenerate(event.currentTarget.form!)}><CalendarClock/>Gerar parcelas</Button></div><div className="installment-editor">{installments.map((item, index) => <details key={item.installmentNumber} open={installments.length <= 3}><summary><span>Parcela {item.installmentNumber}/{installments.length} · {brDate(item.dueDate)}</span><b>{currency.format(Number(item.amount))}</b><ChevronDown/></summary><div className="form-grid"><label>Vencimento<Input type="date" value={item.dueDate} onChange={(event) => setInstallments((current) => current.map((entry, i) => i === index ? { ...entry, dueDate: event.target.value } : entry))}/></label><label>Valor<Input type="number" min="0.01" step="0.01" value={item.amount} onChange={(event) => setInstallments((current) => current.map((entry, i) => i === index ? { ...entry, amount: event.target.value } : entry))}/></label><label>Pagamento<select value={item.paymentMethod} onChange={(event) => setInstallments((current) => current.map((entry, i) => i === index ? { ...entry, paymentMethod: event.target.value } : entry))}>{Object.entries(paymentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="span-2">Linha digitável<Input value={item.digitableLine} onChange={(event) => setInstallments((current) => current.map((entry, i) => i === index ? { ...entry, digitableLine: event.target.value } : entry))} placeholder="Código do boleto"/></label><label className="span-2">PIX copia e cola<Input value={item.pixCode} onChange={(event) => setInstallments((current) => current.map((entry, i) => i === index ? { ...entry, pixCode: event.target.value } : entry))}/></label><label className="span-2">Link do boleto/documento<Input type="url" value={item.documentUrl} onChange={(event) => setInstallments((current) => current.map((entry, i) => i === index ? { ...entry, documentUrl: event.target.value } : entry))} placeholder="https://..."/></label></div></details>)}</div><footer><Button type="button" variant="outline" onClick={() => setComposer(false)}>Cancelar</Button><Button type="submit"><Check/>Salvar conta e parcelas</Button></footer></form></div>}
  </section>;
}

export function SuppliersPanel() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]), [formOpen, setFormOpen] = useState(false), [message, setMessage] = useState("");
  const load = useCallback(async () => { const response = await fetch("/api/financeiro/fornecedores", { cache: "no-store" }); const payload = await response.json(); if (response.ok) setSuppliers(payload.suppliers); else setMessage(payload.error); }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/financeiro/fornecedores", { cache: "no-store" }).then(async (response) => ({ ok: response.ok, payload: await response.json() })).then(({ ok, payload }) => { if (!active) return; if (ok) setSuppliers(payload.suppliers); else setMessage(payload.error); });
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const body = Object.fromEntries(form.entries()); const response = await fetch("/api/financeiro/fornecedores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, active: true }) }); const payload = await response.json(); if (!response.ok) { setMessage(payload.error); return; } setFormOpen(false); setMessage("Fornecedor cadastrado com sucesso."); await load(); }
  return <section className="suppliers-panel"><div className="payables-toolbar"><div><small>FORNECEDORES</small><h2>Cadastro de fornecedores</h2><p>Dados fiscais, contatos, endereço e condições comerciais.</p></div><Button onClick={() => setFormOpen(true)}><Plus/>Novo fornecedor</Button></div>{message && <div className={message.includes("sucesso") ? "finance-message success" : "finance-message"}>{message}</div>}<div className="supplier-grid">{suppliers.map((item) => <article key={item.id}><div><Store/><span className={item.active ? "active-dot" : "inactive-dot"}/></div><h3>{item.trade_name || item.legal_name}</h3>{item.trade_name && <b>{item.legal_name}</b>}<p>{item.document || "CPF/CNPJ não informado"}</p><small>{item.default_payment_terms || "Condição de pagamento não informada"}</small></article>)}{!suppliers.length && <div className="finance-empty"><Store/><b>Nenhum fornecedor cadastrado</b><span>Cadastre fornecedores para vincular boletos e compras.</span></div>}</div>{formOpen && <div className="finance-modal"><form className="payable-composer supplier-composer" onSubmit={submit}><header><div><small>NOVO CADASTRO</small><h2>Fornecedor</h2><p>Use os dados fiscais e o principal contato comercial.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setFormOpen(false)}><X/></Button></header><div className="form-grid"><label>Tipo<select name="personType" defaultValue="empresa"><option value="empresa">Pessoa jurídica</option><option value="pessoa">Pessoa física</option></select></label><label>Razão social / nome<Input name="legalName" required/></label><label>Nome fantasia<Input name="tradeName"/></label><label>CPF / CNPJ<Input name="document"/></label><label>Inscrição estadual<Input name="stateRegistration"/></label><label>Contato principal<Input name="contactName"/></label><label>Telefone<Input name="phone"/></label><label>WhatsApp<Input name="whatsapp"/></label><label>E-mail<Input name="email" type="email"/></label><label>CEP<Input name="postalCode"/></label><label className="span-2">Endereço<Input name="street"/></label><label>Número<Input name="addressNumber"/></label><label>Complemento<Input name="addressComplement"/></label><label>Bairro<Input name="district"/></label><label>Cidade<Input name="city" defaultValue=""/></label><label>UF<Input name="state" defaultValue="" placeholder="UF" maxLength={2}/></label><label className="span-2">Condição de pagamento padrão<Input name="defaultPaymentTerms" placeholder="Ex.: 28/35/42 dias, boleto"/></label><label className="span-2">Observações<Input name="notes"/></label></div><footer><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button><Button type="submit"><Check/>Salvar fornecedor</Button></footer></form></div>}</section>;
}
