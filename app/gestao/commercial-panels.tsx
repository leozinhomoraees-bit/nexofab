"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, Calculator, CalendarClock, Check, ChevronDown, CircleDollarSign, ClipboardList, Clock3, Copy, ExternalLink, Eye, FileText, MapPin, MessageCircle, Pencil, Plus, Save, Search, Share2, ShoppingCart, Sparkles, Trash2, UserRound, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PricingCatalog } from "./pricing-panel";
import type { TenderItem } from "./tender-items-panel";
import { SpecialProjectConfigurator } from "./special-project-configurator";
import { FlexibleCompositionConfigurator, type FlexibleCalculation } from "./flexible-composition-configurator";
import type { SpecialProjectInput, SpecialProjectKind } from "@/lib/special-project-engine";
import { estimateLabor, type LaborEstimate } from "@/lib/labor-estimator";
import { compactQuoteSummary } from "@/lib/quote-summary";
import { whatsappUrl } from "@/lib/whatsapp";
import { materialDisplayName } from "@/lib/material-label";
import type { CutPlanQuotePrefill } from "@/lib/cut-plan-quote";
import { Customer360Dialog } from "./customer-360-dialog";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const showApprovalDate = (value?: string | null) => value
  ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  : "—";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Não foi possível concluir a operação.");
  return payload;
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <header className="module-heading"><div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>{action}</header>;
}

function Feedback({ message }: { message: string }) {
  if (!message) return null;
  const success = message.startsWith("OK:");
  return <div className={`module-feedback ${success ? "success" : ""}`}>{success ? <Check/> : <X/>}{message.replace(/^OK:/, "")}</div>;
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Users; title: string; text: string }) {
  return <div className="empty-state"><Icon/><b>{title}</b><p>{text}</p></div>;
}

type Address = { zip?: string; street?: string; number?: string; complement?: string; neighborhood?: string; city?: string; state?: string };
export type Customer = {
  id: string;
  person_type: "pessoa" | "empresa";
  name: string;
  company_name?: string | null;
  document?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: Address | null;
  notes?: string | null;
  billing_cycle: "imediato" | "semanal" | "mensal";
  billing_weekday?: number | null;
  billing_day?: number | null;
  credit_limit?: number | null;
  billing_notes?: string | null;
  quote_count: number;
  created_at: string;
};

function CustomerForm({ customer, onClose, onSaved }: { customer?: Customer; onClose: () => void; onSaved: () => void }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const address = customer?.address ?? {};
  const [billingCycle, setBillingCycle] = useState(customer?.billing_cycle ?? "imediato");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      ...(customer ? { id: customer.id } : {}),
      personType: form.get("personType"),
      name: form.get("name"),
      companyName: form.get("companyName"),
      document: form.get("document"),
      phone: form.get("phone"),
      whatsapp: form.get("whatsapp"),
      email: form.get("email"),
      address: { zip: form.get("zip"), street: form.get("street"), number: form.get("number"), complement: form.get("complement"), neighborhood: form.get("neighborhood"), city: form.get("city"), state: form.get("state") },
      notes: form.get("notes"),
      billingCycle: form.get("billingCycle"),
      billingWeekday: form.get("billingWeekday"),
      billingDay: form.get("billingDay"),
      creditLimit: form.get("creditLimit"),
      billingNotes: form.get("billingNotes"),
    };
    try {
      await api("/api/gestao/clientes", { method: customer ? "PATCH" : "POST", body: JSON.stringify(payload) });
      onSaved();
    } catch (error) {
      setMessage((error as Error).message);
      setSaving(false);
    }
  }

  return <form className="module-form commercial-form" onSubmit={submit}>
    <div className="form-title"><div><b>{customer ? "Editar cliente" : "Novo cliente"}</b><small>Informações comerciais, fiscais e de entrega em um único cadastro.</small></div><Button type="button" variant="ghost" size="icon" onClick={onClose}><X/></Button></div>
    <div className="form-section-title"><UserRound/><div><b>Identificação</b><small>Dados usados em propostas e ordens de serviço.</small></div></div>
    <div className="form-grid">
      <label>Tipo de cliente<select name="personType" defaultValue={customer?.person_type ?? "empresa"}><option value="empresa">Pessoa jurídica</option><option value="pessoa">Pessoa física</option></select></label>
      <label>Nome do contato<Input name="name" defaultValue={customer?.name ?? ""} required/></label>
      <label>Empresa / nome fantasia<Input name="companyName" defaultValue={customer?.company_name ?? ""}/></label>
      <label>CPF / CNPJ<Input name="document" defaultValue={customer?.document ?? ""} placeholder="Somente para identificação"/></label>
      <label>Telefone<Input name="phone" defaultValue={customer?.phone ?? ""} inputMode="tel"/></label>
      <label>WhatsApp<Input name="whatsapp" defaultValue={customer?.whatsapp ?? customer?.phone ?? ""} inputMode="tel"/></label>
      <label className="span-2">E-mail<Input name="email" type="email" defaultValue={customer?.email ?? ""}/></label>
    </div>
    <div className="form-section-title"><CircleDollarSign/><div><b>Condição de faturamento</b><small>Defina se o cliente paga por serviço ou fecha uma conta semanal ou mensal.</small></div></div>
    <div className="form-grid">
      <label>Tipo de conta<select name="billingCycle" value={billingCycle} onChange={(event) => setBillingCycle(event.target.value as Customer["billing_cycle"])}><option value="imediato">Pagamento por serviço</option><option value="semanal">Conta com fechamento semanal</option><option value="mensal">Conta com fechamento mensal</option></select></label>
      {billingCycle === "semanal" && <label>Dia de vencimento<select name="billingWeekday" defaultValue={customer?.billing_weekday ?? 5}><option value="1">Segunda-feira</option><option value="2">Terça-feira</option><option value="3">Quarta-feira</option><option value="4">Quinta-feira</option><option value="5">Sexta-feira</option><option value="6">Sábado</option></select></label>}
      {billingCycle === "mensal" && <label>Dia do mês<Input name="billingDay" type="number" min="1" max="28" defaultValue={customer?.billing_day ?? 28}/></label>}
      <label>Limite de crédito<Input name="creditLimit" type="number" min="0" step="0.01" defaultValue={customer?.credit_limit ?? 0}/></label>
      <label className="span-2">Observações de cobrança<Input name="billingNotes" defaultValue={customer?.billing_notes ?? ""} placeholder="Ex.: enviar relatório e boleto para o financeiro"/></label>
    </div>
    <div className="form-section-title"><MapPin/><div><b>Endereço</b><small>Referência para entrega, instalação e deslocamento.</small></div></div>
    <div className="form-grid address-grid">
      <label>CEP<Input name="zip" defaultValue={address.zip ?? ""} inputMode="numeric"/></label>
      <label className="span-2">Logradouro<Input name="street" defaultValue={address.street ?? ""}/></label>
      <label>Número<Input name="number" defaultValue={address.number ?? ""}/></label>
      <label>Complemento<Input name="complement" defaultValue={address.complement ?? ""}/></label>
      <label>Bairro<Input name="neighborhood" defaultValue={address.neighborhood ?? ""}/></label>
      <label>Cidade<Input name="city" defaultValue={address.city ?? ""}/></label>
      <label>UF<Input name="state" defaultValue={address.state ?? "PR"} maxLength={2}/></label>
    </div>
    <label className="textarea-label">Observações comerciais<textarea name="notes" defaultValue={customer?.notes ?? ""} rows={3} placeholder="Preferências, contatos adicionais, horários de entrega, histórico relevante..."/></label>
    <Feedback message={message}/>
    <div className="form-actions"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}><Save/>{saving ? "Salvando..." : customer ? "Salvar alterações" : "Cadastrar cliente"}</Button></div>
  </form>;
}

export function CustomersPanel({ search }: { search: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => api<{ customers: Customer[] }>("/api/gestao/clientes").then((result) => setCustomers(result.customers)).finally(() => setLoading(false)), []);
  useEffect(() => { load().catch((error: Error) => setMessage(error.message)); }, [load]);
  const filtered = useMemo(() => customers.filter((customer) => `${customer.name} ${customer.company_name} ${customer.document} ${customer.phone} ${customer.whatsapp} ${customer.email} ${customer.address?.city}`.toLowerCase().includes(search.toLowerCase())), [customers, search]);

  async function saved() {
    setEditing(null);
    await load();
    setMessage("OK:Cadastro do cliente salvo.");
  }

  return <>
    <SectionHeading eyebrow="CRM COMERCIAL" title="Clientes" description="Base central de contatos, documentos, endereços e histórico de propostas." action={<Button onClick={() => setEditing("new")}><Plus/>Novo cliente</Button>}/>
    <Feedback message={message}/>
    {editing && <CustomerForm customer={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} onSaved={saved}/>}
    {viewingId && <Customer360Dialog customerId={viewingId} onClose={() => setViewingId(null)} onEdit={() => { const found = customers.find((item) => item.id === viewingId); setViewingId(null); if (found) setEditing(found); }}/>}
    {!loading && !filtered.length ? <EmptyState icon={Users} title="Nenhum cliente cadastrado" text="Cadastre empresas e pessoas para reutilizar dados em novos orçamentos e acompanhar o relacionamento."/> : <div className="module-table customer-table"><Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Contato</TableHead><TableHead>Documento</TableHead><TableHead>Localização</TableHead><TableHead>Faturamento</TableHead><TableHead>Orçamentos</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{filtered.map((customer) => <TableRow key={customer.id}><TableCell><button type="button" className="customer-identity customer-identity-btn" onClick={() => setViewingId(customer.id)}><span>{customer.person_type === "empresa" ? <Building2/> : <UserRound/>}</span><div><b>{customer.company_name || customer.name}</b><small>{customer.company_name ? customer.name : customer.person_type === "empresa" ? "Empresa" : "Pessoa física"}</small></div></button></TableCell><TableCell><b>{customer.whatsapp || customer.phone || "—"}</b><small>{customer.email || "Sem e-mail"}</small></TableCell><TableCell>{customer.document || "—"}</TableCell><TableCell>{customer.address?.city ? `${customer.address.city}${customer.address.state ? `/${customer.address.state}` : ""}` : "—"}</TableCell><TableCell><span className={`billing-badge ${customer.billing_cycle}`}>{customer.billing_cycle === "mensal" ? `Mensal · dia ${customer.billing_day ?? 28}` : customer.billing_cycle === "semanal" ? "Semanal" : "Por serviço"}</span></TableCell><TableCell><span className="count-badge">{customer.quote_count}</span></TableCell><TableCell className="text-right"><div className="row-actions"><Button size="sm" variant="outline" onClick={() => setViewingId(customer.id)}><Eye/>Ficha 360º</Button><Button size="sm" variant="outline" onClick={() => setEditing(customer)}><Pencil/>Editar</Button></div></TableCell></TableRow>)}</TableBody></Table></div>}
  </>;
}

type QuoteItem = { id?: string; description: string; service_type?: string | null; material?: string | null; width_mm?: number | null; height_mm?: number | null; depth_mm?: number | null; quantity: number; unit: string; unit_cost: number; unit_price: number; total?: number; production_notes?: string | null; pricing_source?: string; pricing_product_id?: string | null; suggested_unit_price?: number | null; waste_percent?: number | null; pricing_snapshot?: Record<string, unknown> | null; option_group?: string | null; selected_by_customer?: boolean | null };
type Quote = { id: string; number: number; customerId?: string | null; customerName: string; company?: string | null; phone: string; email?: string | null; service: string; dimensions?: string | null; material: string; details?: string | null; quantity: number; status: string; source: string; createdAt: string; updatedAt: string; estimatedValue: number | null; subtotal: number; discount: number; validUntil?: string | null; paymentTerms?: string | null; deliveryDays?: number | null; installationIncluded: boolean; freight: number; internalNotes?: string | null; openBalance: number; overdueBalance: number; nextPaymentDue?: string | null; viewCount?: number; firstViewedAt?: string | null; lastViewedAt?: string | null; approvalVersions: Array<{ id: string; version: number; approval_source: string; approved_at: string }>; items: QuoteItem[] };
type SmartCalculation = { netAreaM2: number; productionAreaM2: number; finishingAreaM2: number; purchasedAreaM2: number; wasteAreaM2: number; wastePercent: number; wasteCost: number; finishingCost: number; materialCostPerLinearMeter: number; materialCostPerM2: number; productionWidthMm: number; productionHeightMm: number; rotated: boolean; materialUsage: string; totalCost: number; unitCost: number; costBasedPrice: number; tablePrice: number | null; priceReason: string; suggestedPrice: number; suggestedUnitPrice: number; minimumSuggestedPrice: number; averageSuggestedPrice: number; maximumSuggestedPrice: number; desiredMarginPercent: number; taxPercent: number; commissionPercent: number; materialSuppliedByCustomer?: boolean; serviceOnlyMachine?: boolean; machineId?: string; machineName?: string; machineMinutes?: number; machineMinutesEntered?: number; machineTimeUnit?: "min" | "h"; machineTimeMode?: "per_unit" | "total_job"; flexibleComposition?: boolean; specialProjectKind?: SpecialProjectKind; projectInput?: Partial<SpecialProjectInput>; projectMetrics?: Record<string, string | number | boolean>; compositionComponents?: FlexibleCalculation["compositionComponents"]; compositionMachineId?: string; compositionMachineMinutes?: number; compositionMachineTimeMode?: "per_unit" | "total_job"; missingComponents: string[]; expectedGrossProfit: number; effectiveMarginPercent: number; costLines: Array<{ key: string; label: string; detail: string; amount: number }>; stockUsages: Array<{ materialId: string; materialName: string; quantity: number; unit: string; source: string }> };
type ItemDraft = { description: string; serviceType: string; material: string; widthMm: string; heightMm: string; depthMm: string; quantity: string; unit: string; unitCost: string; unitPrice: string; productionNotes: string; pricingSource: "manual" | "calculado"; configurator: "produto" | "maquina_servico" | "composicao_livre" | SpecialProjectKind; productId: string; productSearch: string; materialId: string; machineId: string; machineMinutes: string; machineTimeUnit: "min" | "h"; machineTimeMode: "per_unit" | "total_job"; materialConsumption: string; laborMinutes: string; orientation: "auto" | "normal" | "rotated"; finishingMode: "none" | "banner" | "faixa"; finishingAllowanceMm: string; varnishIncluded: boolean; customerSuppliesMaterial: boolean; installationIncluded: boolean; installationCost: string; invoiceIncluded: boolean; invoicePercent: string; commissionIncluded: boolean; commissionPercent: string; desiredMarginPercent: string; suggestedUnitPrice: number | null; wastePercent: number | null; pricingSnapshot: SmartCalculation | null; configurationSnapshot: SmartCalculation | null; optionGroup: string };
type CompositionTemplate = { id: string; name: string; description?: string | null; category: string; item_payload: Partial<ItemDraft>; updated_at: string };
type ItemAudit = { score: number; level: "ok" | "warning" | "danger"; messages: Array<{ level: "info" | "warning" | "danger"; text: string }>; historicalMedian: number | null; historicalDifference: number | null };

const emptyItem = (): ItemDraft => ({ description: "", serviceType: "impressao", material: "", widthMm: "", heightMm: "", depthMm: "", quantity: "1", unit: "un", unitCost: "0", unitPrice: "0", productionNotes: "", pricingSource: "calculado", configurator: "produto", productId: "", productSearch: "", materialId: "", machineId: "", machineMinutes: "", machineTimeUnit: "min", machineTimeMode: "per_unit", materialConsumption: "", laborMinutes: "0", orientation: "auto", finishingMode: "none", finishingAllowanceMm: "50", varnishIncluded: false, customerSuppliesMaterial: false, installationIncluded: false, installationCost: "0", invoiceIncluded: false, invoicePercent: "0", commissionIncluded: false, commissionPercent: "0", desiredMarginPercent: "30", suggestedUnitPrice: null, wastePercent: null, pricingSnapshot: null, configurationSnapshot: null, optionGroup: "" });

function historicalUnitPrices(item: ItemDraft, quotes: Quote[], currentQuoteId?: string) {
  const words = normalizeSearch(`${item.description} ${item.material}`).split(" ").filter((word) => word.length >= 4);
  return quotes.filter((quote) => quote.id !== currentQuoteId).flatMap((quote) => quote.items).filter((candidate) => {
    if (Number(candidate.unit_price) <= 0) return false;
    const candidateText = normalizeSearch(`${candidate.description} ${candidate.material ?? ""}`);
    const sameProcess = !candidate.service_type || candidate.service_type === item.serviceType;
    const similarText = words.length > 0 && words.filter((word) => candidateText.includes(word)).length >= Math.min(2, words.length);
    const currentArea = Number(item.widthMm) * Number(item.heightMm);
    const candidateArea = Number(candidate.width_mm) * Number(candidate.height_mm);
    const comparableSize = !currentArea || !candidateArea || candidateArea / currentArea >= .5 && candidateArea / currentArea <= 2;
    return sameProcess && similarText && comparableSize;
  }).map((candidate) => Number(candidate.unit_price)).sort((a, b) => a - b).slice(-20);
}

function auditQuoteItem(item: ItemDraft, quotes: Quote[], targetMargin: number, currentQuoteId?: string): ItemAudit {
  const messages: ItemAudit["messages"] = [];
  const quantity = Number(item.quantity || 0), unitCost = Number(item.unitCost || 0), unitPrice = Number(item.unitPrice || 0);
  const sale = quantity * unitPrice;
  const snapshot = item.pricingSnapshot;
  if (quantity <= 0) messages.push({ level: "danger", text: "Quantidade inválida ou zerada." });
  if (unitCost <= 0) messages.push({ level: "danger", text: "Custo zerado: informe o custo ou conclua o cálculo técnico." });
  if (unitPrice < unitCost) messages.push({ level: "danger", text: `Preço unitário abaixo do custo em ${currency.format(unitCost - unitPrice)}.` });
  if (item.pricingSource === "calculado" && !snapshot) messages.push({ level: "danger", text: "Cálculo desatualizado ou ainda não executado." });
  if (snapshot) {
    for (const missing of snapshot.missingComponents ?? []) messages.push({ level: "danger", text: `Ficha incompleta: ${missing}.` });
    if (Number(snapshot.wastePercent) > 60) messages.push({ level: "warning", text: `Perda técnica elevada: ${Number(snapshot.wastePercent).toFixed(1)}%. Confira encaixe, orientação e material.` });
    const sheets = Number(snapshot.projectMetrics?.sheetsToPrepare ?? 0);
    const totalPieces = Number(snapshot.projectMetrics?.totalLetters ?? quantity);
    if (sheets > Math.max(10, totalPieces * 2)) messages.push({ level: "danger", text: `${sheets} chapas para ${totalPieces || quantity} peça(s) parece incoerente. Revise as medidas individuais.` });
    if (sale + .01 < Number(snapshot.minimumSuggestedPrice ?? 0)) messages.push({ level: "danger", text: `Venda ${currency.format(Number(snapshot.minimumSuggestedPrice) - sale)} abaixo do mínimo calculado.` });
    else if (sale + .01 < Number(snapshot.averageSuggestedPrice ?? 0)) messages.push({ level: "warning", text: `Venda abaixo do valor médio sugerido em ${currency.format(Number(snapshot.averageSuggestedPrice) - sale)}.` });
    const result = sale - quantity * unitCost - sale * (Number(snapshot.taxPercent) + Number(snapshot.commissionPercent)) / 100;
    const effective = sale > 0 ? result / sale * 100 : 0;
    const effectiveMarkup = quantity * unitCost > 0 ? result / (quantity * unitCost) * 100 : 0;
    if (effective < 0) messages.push({ level: "danger", text: `Margem líquida negativa de ${effective.toFixed(1)}%.` });
    else if ((snapshot as SmartCalculation & { profitCalculationMode?: "margin" | "markup" }).profitCalculationMode === "markup" && effectiveMarkup + .01 < Number(snapshot.desiredMarginPercent ?? 0)) messages.push({ level: "warning", text: `Resultado de ${effectiveMarkup.toFixed(1)}% sobre o custo, abaixo do acréscimo configurado de ${Number(snapshot.desiredMarginPercent).toFixed(1)}%.` });
    else if ((snapshot as SmartCalculation & { profitCalculationMode?: "margin" | "markup" }).profitCalculationMode !== "markup" && effective + .01 < targetMargin) messages.push({ level: "warning", text: `Margem líquida de ${effective.toFixed(1)}%, abaixo da meta de ${targetMargin.toFixed(1)}%.` });
  }
  const historical = historicalUnitPrices(item, quotes, currentQuoteId);
  const historicalMedian = historical.length ? historical[Math.floor(historical.length / 2)] : null;
  const historicalDifference = historicalMedian && unitPrice ? (unitPrice - historicalMedian) / historicalMedian * 100 : null;
  if (historical.length >= 2 && historicalDifference !== null && Math.abs(historicalDifference) >= 40) messages.push({ level: "warning", text: `Preço ${Math.abs(historicalDifference).toFixed(0)}% ${historicalDifference > 0 ? "acima" : "abaixo"} da mediana de ${historical.length} trabalho(s) semelhante(s).` });
  if (!messages.length) messages.push({ level: "info", text: "Custos, preço, margem e consumo estão coerentes." });
  const score = Math.max(0, 100 - messages.filter((message) => message.level === "danger").length * 30 - messages.filter((message) => message.level === "warning").length * 12);
  return { score, level: messages.some((message) => message.level === "danger") ? "danger" : messages.some((message) => message.level === "warning") ? "warning" : "ok", messages, historicalMedian, historicalDifference };
}
const manualItem = (catalog: PricingCatalog): ItemDraft => ({
  ...emptyItem(),
  pricingSource: "manual",
  serviceType: "terceirizado",
  invoicePercent: String(catalog.settings?.tax_percent ?? 0),
  commissionPercent: String(catalog.settings?.commission_percent ?? 0),
  desiredMarginPercent: String(catalog.settings?.target_margin_percent ?? 30),
});
function quoteBaseItems(items: ItemDraft[]) {
  const fixed = items.filter((item) => !item.optionGroup.trim());
  const groups = new Map<string, ItemDraft[]>();
  for (const item of items.filter((entry) => entry.optionGroup.trim())) {
    const key = item.optionGroup.trim().toLocaleLowerCase("pt-BR");
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...fixed, ...[...groups.values()].map((entries) => [...entries].sort((a, b) => Number(a.quantity) * Number(a.unitPrice) - Number(b.quantity) * Number(b.unitPrice))[0])];
}
const statusLabel: Record<string, string> = { novo: "Novo", em_analise: "Em análise", aguardando_cliente: "Aguardando cliente", aprovado: "Aprovado", recusado: "Recusado", expirado: "Expirado", convertido: "Fechado" };
const sourceLabel: Record<string, string> = { site: "Site", whatsapp: "WhatsApp", telefone: "Telefone", presencial: "Presencial", interno: "Interno", outro: "Outro" };
function quoteCostItems(items: QuoteItem[]) {
  if (items.some((item) => item.selected_by_customer === true)) return items.filter((item) => item.selected_by_customer !== false);
  const fixed = items.filter((item) => !item.option_group);
  const groups = new Map<string, QuoteItem[]>();
  for (const item of items.filter((entry) => entry.option_group)) {
    const key = item.option_group!.trim().toLocaleLowerCase("pt-BR");
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...fixed, ...[...groups.values()].map((entries) => [...entries].sort((a, b) => Number(a.total ?? a.quantity * a.unit_price) - Number(b.total ?? b.quantity * b.unit_price))[0])];
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function CustomerAutocomplete({ customers, value, selectedId, onChange, onSelect }: {
  customers: Customer[];
  value: string;
  selectedId: string;
  onChange: (value: string) => void;
  onSelect: (customer: Customer | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const term = normalizeSearch(value);
  const matches = customers.filter((customer) => !term || normalizeSearch(`${customer.name} ${customer.company_name ?? ""} ${customer.document ?? ""} ${customer.phone ?? ""} ${customer.whatsapp ?? ""}`).includes(term)).slice(0, 10);
  const looseContactIndex = matches.length;

  function selectOption(index: number) {
    if (index < matches.length) onSelect(matches[index]);
    else onSelect(null);
    setOpen(false);
  }

  return <div className="product-autocomplete customer-autocomplete">
    <Input role="combobox" aria-expanded={open} aria-controls="customer-suggestions" aria-activedescendant={open ? (activeIndex < matches.length ? `customer-option-${matches[activeIndex].id}` : "customer-option-loose") : undefined} autoComplete="off" value={value}
      onFocus={() => { setOpen(true); setActiveIndex(Math.max(0, matches.findIndex((customer) => customer.id === selectedId))); }} onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((current) => Math.min(current + (open ? 1 : 0), looseContactIndex)); }
        else if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActiveIndex((current) => Math.max(0, current - 1)); }
        else if (event.key === "Enter" && open) { event.preventDefault(); selectOption(activeIndex); }
        else if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      }}
      onChange={(event) => { if (selectedId) onSelect(null); onChange(event.target.value); setActiveIndex(0); setOpen(true); }} placeholder="Comece a digitar o nome, empresa, documento ou telefone"/>
    {open && <div className="product-suggestions" id="customer-suggestions" role="listbox">
      {matches.map((customer, index) => <button type="button" role="option" id={`customer-option-${customer.id}`} aria-selected={activeIndex === index} key={customer.id}
        onMouseEnter={() => setActiveIndex(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => selectOption(index)}>
        <span><b>{customer.company_name || customer.name}</b><small>{customer.company_name ? customer.name : customer.document || customer.phone || "Cliente cadastrado"}</small></span>
        <small>{customer.billing_cycle === "mensal" ? "Conta mensal" : customer.billing_cycle === "semanal" ? "Conta semanal" : "Por serviço"}</small>
      </button>)}
      {!matches.length && <p>Nenhum cliente contém “{value}”.</p>}
      <button type="button" className="loose-contact-option" role="option" id="customer-option-loose" aria-selected={activeIndex === looseContactIndex}
        onMouseEnter={() => setActiveIndex(looseContactIndex)} onMouseDown={(event) => event.preventDefault()} onClick={() => selectOption(looseContactIndex)}><span><b>Usar contato avulso</b><small>Continuar sem vincular um cliente cadastrado</small></span></button>
    </div>}
  </div>;
}

function ProductAutocomplete({ products, value, selectedId, onChange, onSelect }: {
  products: PricingCatalog["products"];
  value: string;
  selectedId: string;
  onChange: (value: string) => void;
  onSelect: (product: PricingCatalog["products"][number]) => void;
}) {
  const [open, setOpen] = useState(false);
  const term = normalizeSearch(value);
  const matches = products.filter((product) => !term || normalizeSearch(`${product.name} ${product.code} ${product.category}`).includes(term)).slice(0, 10);
  return <div className="product-autocomplete">
    <Input role="combobox" aria-expanded={open} aria-controls="product-suggestions" autoComplete="off" value={value}
      onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      onChange={(event) => { onChange(event.target.value); setOpen(true); }} placeholder="Digite, por exemplo: banner"/>
    {open && <div className="product-suggestions" id="product-suggestions" role="listbox">
      {matches.length ? matches.map((product) => <button type="button" role="option" aria-selected={selectedId === product.id} key={product.id}
        onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(product); setOpen(false); }}>
        <span><b>{product.name}</b><small>{product.category || "Produto"}</small></span>
        <small>{product.default_material_id ? "Ficha vinculada" : "Configuração pendente"}</small>
      </button>) : <p>Nenhum produto contém “{value}”.</p>}
    </div>}
  </div>;
}

type QuickSaleItemDraft = { description: string; quantity: string; unit: string; unitCost: string; unitPrice: string; inventoryItemId: string; materialName: string; stockQuantity: string; notes: string };
const emptyQuickSaleItem = (): QuickSaleItemDraft => ({ description: "", quantity: "1", unit: "un", unitCost: "0", unitPrice: "", inventoryItemId: "", materialName: "", stockQuantity: "0", notes: "" });

function QuickSaleForm({ customers, catalog, onClose, onSaved }: { customers: Customer[]; catalog: PricingCatalog; onClose: () => void; onSaved: (number?: number) => void }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [items, setItems] = useState<QuickSaleItemDraft[]>([emptyQuickSaleItem()]);
  const [paymentStatus, setPaymentStatus] = useState<"recebido" | "pendente">("recebido");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [saleDate, setSaleDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const totals = items.reduce((result, item) => ({ sale: result.sale + Number(item.quantity || 0) * Number(item.unitPrice || 0), cost: result.cost + Number(item.quantity || 0) * Number(item.unitCost || 0) }), { sale: 0, cost: 0 });

  function updateItem(index: number, field: keyof QuickSaleItemDraft, value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  function selectMaterial(index: number, materialId: string) {
    const material = catalog.materials.find((entry) => entry.id === materialId);
    if (!material) {
      setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, inventoryItemId: "", materialName: "", stockQuantity: "0" } : item));
      return;
    }
    const divisor = material.format === "rolo" ? Number(material.length_m || 1) : Number(material.purchase_quantity || 1);
    const averageCost = Number(material.package_cost || 0) / Math.max(divisor, 0.000001);
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      inventoryItemId: material.id,
      materialName: material.name,
      description: item.description || material.name,
      unit: item.unit === "un" ? (material.inventory?.unit || "un") : item.unit,
      unitCost: item.unitCost === "0" ? averageCost.toFixed(4) : item.unitCost,
    } : item));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      const result = await api<{ sale: { quoteNumber?: number } }>("/api/gestao/vendas-rapidas", {
        method: "POST",
        body: JSON.stringify({
          customerId: selectedCustomer?.id ?? "",
          customerName: selectedCustomer ? (selectedCustomer.company_name || selectedCustomer.name) : "Consumidor final",
          phone: selectedCustomer?.whatsapp || selectedCustomer?.phone || "",
          paymentStatus, paymentMethod, saleDate, dueDate: paymentStatus === "pendente" ? dueDate : "", notes,
          items: items.map((item) => ({ ...item, quantity: Number(item.quantity), unitCost: Number(item.unitCost), unitPrice: Number(item.unitPrice), stockQuantity: Number(item.stockQuantity) })),
        }),
      });
      onSaved(result.sale?.quoteNumber);
    } catch (error) { setMessage((error as Error).message); }
    finally { setSaving(false); }
  }

  return <form className="module-form quick-sale-form" onSubmit={submit}>
    <div className="form-title"><div><b>Venda rápida</b><small>Registre uma venda de balcão sem criar e enviar uma proposta.</small></div><Button type="button" variant="ghost" size="icon" onClick={onClose}><X/></Button></div>
    <div className="quick-sale-guide"><ShoppingCart/><div><b>Use para trabalhos simples, já definidos e normalmente entregues.</b><p>A venda entra no faturamento, caixa ou contas a receber, histórico e relatórios. Se informar o consumo, o estoque também será baixado.</p></div></div>
    <section className="quick-sale-section"><div className="form-section-title"><UserRound/><div><b>Cliente</b><small>Opcional. Sem cadastro, a venda será registrada como Consumidor final.</small></div></div><label>Cliente cadastrado<CustomerAutocomplete customers={customers} value={customerSearch} selectedId={selectedCustomer?.id ?? ""} onChange={setCustomerSearch} onSelect={(customer) => { setSelectedCustomer(customer); setCustomerSearch(customer ? (customer.company_name ? `${customer.company_name} — ${customer.name}` : customer.name) : ""); }}/></label></section>
    <section className="quick-sale-section"><div className="form-section-title"><ClipboardList/><div><b>Itens vendidos</b><small>Informe o preço praticado. O custo é usado para medir o resultado da venda.</small></div></div><div className="quick-sale-items">{items.map((item, index) => <article key={index}><header><b>Item {index + 1}</b>{items.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Remover item ${index + 1}`} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2/></Button>}</header><div className="quick-sale-item-grid"><label className="wide">Descrição<Input value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} placeholder="Ex.: Placa de PVC 20 × 30 cm" required/></label><label>Quantidade<Input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} required/></label><label>Unidade<select value={item.unit} onChange={(event) => updateItem(index, "unit", event.target.value)}><option value="un">un</option><option value="m²">m²</option><option value="m">m</option><option value="serviço">serviço</option></select></label><label>Custo unitário<Input type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => updateItem(index, "unitCost", event.target.value)}/></label><label>Preço unitário<Input type="number" min="0.01" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} required/></label><label className="wide">Baixar insumo do estoque (opcional)<select value={item.inventoryItemId} onChange={(event) => selectMaterial(index, event.target.value)}><option value="">Não baixar estoque</option>{catalog.materials.filter((material) => material.inventory).map((material) => <option value={material.id} key={material.id}>{material.name} · saldo {Number(material.inventory?.current_quantity ?? 0).toLocaleString("pt-BR")} {material.inventory?.unit}</option>)}</select></label>{item.inventoryItemId && <label>Consumo total no estoque<Input type="number" min="0.001" step="0.001" value={item.stockQuantity} onChange={(event) => updateItem(index, "stockQuantity", event.target.value)} required/><small>Informe o que foi realmente consumido nesta venda.</small></label>}<label className={item.inventoryItemId ? "" : "wide"}>Observação<Input value={item.notes} onChange={(event) => updateItem(index, "notes", event.target.value)} placeholder="Medida, acabamento ou detalhe interno"/></label></div></article>)}</div><Button type="button" variant="outline" onClick={() => setItems((current) => [...current, emptyQuickSaleItem()])}><Plus/>Adicionar outro item</Button></section>
    <section className="quick-sale-section"><div className="form-section-title"><CircleDollarSign/><div><b>Pagamento</b><small>Recebido alimenta o caixa; pendente cria automaticamente uma conta a receber.</small></div></div><div className="form-grid"><label>Situação<select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as "recebido" | "pendente")}><option value="recebido">Recebido agora</option><option value="pendente">Receber depois</option></select></label><label>Forma<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option><option value="transferencia">Transferência</option><option value="outro">Outro</option></select></label><label>Data da venda<Input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} required/></label>{paymentStatus === "pendente" && <label>Vencimento<Input type="date" min={saleDate} value={dueDate} onChange={(event) => setDueDate(event.target.value)} required/></label>}<label className="span-2">Observações<Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: retirada no balcão, pagamento no fim da semana..."/></label></div></section>
    <aside className="quick-sale-summary"><span><small>Venda</small><b>{currency.format(totals.sale)}</b></span><span><small>Custo informado</small><b>{currency.format(totals.cost)}</b></span><span><small>Resultado estimado</small><b>{currency.format(totals.sale - totals.cost)}</b></span><span><small>Margem</small><b>{totals.sale ? `${(((totals.sale - totals.cost) / totals.sale) * 100).toFixed(1)}%` : "—"}</b></span></aside>
    <Feedback message={message}/><div className="form-actions"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving || totals.sale <= 0}><ShoppingCart/>{saving ? "Registrando..." : "Registrar venda"}</Button></div>
  </form>;
}

function CommercialCostReport({ item }: { item: ItemDraft }) {
  if (!item.pricingSnapshot) return null;
  const sale = Number(item.quantity || 0) * Number(item.unitPrice || 0);
  const production = Number(item.quantity || 0) * Number(item.unitCost || 0);
  const taxPercent = Number(item.pricingSnapshot.taxPercent ?? 0);
  const commissionPercent = Number(item.pricingSnapshot.commissionPercent ?? 0);
  const tax = sale * taxPercent / 100;
  const commission = sale * commissionPercent / 100;
  const profit = sale - production - tax - commission;
  return <section className="commercial-cost-report">{item.pricingSnapshot.materialSuppliedByCustomer && <div className="customer-material-result"><Check/><span><b>Somente serviço / máquina</b><small>O material principal é do cliente: custo e baixa de estoque zerados. Máquina, consumíveis, mão de obra, rateios e margem continuam calculados.</small></span></div>}<header><div><small>LEITURA FINANCEIRA</small><b>Para onde vai o valor deste item</b></div><span>Base: {currency.format(sale)}</span></header><div><span><small>Produção e operação</small><b>{currency.format(production)}</b><em>Materiais, máquina, mão de obra e rateios</em></span>{taxPercent > 0 && <span className="tax"><small>Nota fiscal · {taxPercent}%</small><b>{currency.format(tax)}</b><em>Reserva estimada para impostos</em></span>}{commissionPercent > 0 && <span className="commission"><small>Comissão · {commissionPercent}%</small><b>{currency.format(commission)}</b><em>Comissão comercial prevista</em></span>}<span className="profit"><small>Resultado estimado</small><b>{currency.format(profit)}</b><em>Antes de descontos gerais e frete</em></span></div></section>;
}

function ManualCostReport({ item }: { item: ItemDraft }) {
  if (item.pricingSource !== "manual") return null;
  const sale = Number(item.quantity || 0) * Number(item.unitPrice || 0);
  const production = Number(item.quantity || 0) * Number(item.unitCost || 0);
  const tax = item.invoiceIncluded ? sale * Number(item.invoicePercent || 0) / 100 : 0;
  const commission = item.commissionIncluded ? sale * Number(item.commissionPercent || 0) / 100 : 0;
  const result = sale - production - tax - commission;
  const margin = sale > 0 ? result / sale * 100 : 0;
  return <section className="manual-cost-report"><span><small>Venda informada</small><b>{currency.format(sale)}</b></span><span><small>Custo informado</small><b>{currency.format(production)}</b></span><span><small>Nota + comissão</small><b>{currency.format(tax + commission)}</b></span><span className={result < 0 ? "negative" : "positive"}><small>Resultado previsto</small><b>{currency.format(result)}</b></span><span className={margin < 0 ? "negative" : "positive"}><small>Lucro sobre a venda</small><b>{margin.toFixed(1)}%</b></span></section>;
}

function LaborSuggestion({ estimate, current, onApply }: { estimate: LaborEstimate; current: string; onApply: () => void }) {
  const applied = Math.abs(Number(current || 0) - estimate.minutes) < .01;
  return <span className="inline-labor-suggestion"><Sparkles/><span><b>Sugestão: {estimate.minutes} min</b><small>{estimate.factors.join(" · ")}</small></span><button type="button" disabled={applied} onClick={onApply}>{applied ? "Aplicado" : "Usar"}</button></span>;
}

function ItemAuditPanel({ audit }: { audit: ItemAudit }) {
  return <section className={`item-audit-panel ${audit.level}`}>
    <header><span><Sparkles/></span><div><small>AUDITORIA DO ITEM</small><b>{audit.level === "danger" ? "Correção necessária" : audit.level === "warning" ? "Revise antes de enviar" : "Composição coerente"}</b></div><strong>{audit.score}<small>/100</small></strong></header>
    <div>{audit.messages.map((entry, index) => <p className={entry.level} key={`${entry.level}-${index}`}>{entry.level === "info" ? <Check/> : <AlertTriangle/>}<span>{entry.text}</span></p>)}</div>
    {audit.historicalMedian !== null && <footer><span>Mediana de trabalhos semelhantes</span><b>{currency.format(audit.historicalMedian)} por unidade</b></footer>}
  </section>;
}

function NewQuoteForm({ quote, duplicate, prefill, customers, catalog, tenderItems, referenceQuotes, onClose, onSaved, onDirtyChange, onManageCalculationTypes }: { quote?: Quote; duplicate?: Quote; prefill?: CutPlanQuotePrefill; customers: Customer[]; catalog: PricingCatalog; tenderItems: TenderItem[]; referenceQuotes: Quote[]; onClose: () => void; onSaved: () => void; onDirtyChange: (dirty: boolean) => void; onManageCalculationTypes: () => void }) {
  const draft = quote ?? duplicate;
  const selectedCustomer = customers.find((customer) => customer.id === draft?.customerId);
  const [contact, setContact] = useState({ customerId: draft?.customerId ?? "", customerName: draft?.customerName ?? "", company: draft?.company ?? "", phone: draft?.phone ?? "", email: draft?.email ?? "" });
  const [customerSearch, setCustomerSearch] = useState(selectedCustomer ? (selectedCustomer.company_name ? `${selectedCustomer.company_name} — ${selectedCustomer.name}` : selectedCustomer.name) : "");
  const [items, setItems] = useState<ItemDraft[]>(draft?.items.length ? draft.items.map((item) => {
    const product = catalog.products.find((entry) => entry.id === item.pricing_product_id);
    const snapshot = item.pricing_snapshot as SmartCalculation | null;
    const serviceOnlyMachine = Boolean(snapshot?.serviceOnlyMachine);
    const flexibleComposition = Boolean(snapshot?.flexibleComposition);
    return {
      ...emptyItem(),
      description: item.description,
      serviceType: item.service_type ?? "outro",
      material: item.material ?? "",
      widthMm: String(item.width_mm ?? ""), heightMm: String(item.height_mm ?? ""), depthMm: String(item.depth_mm ?? ""),
      quantity: String(item.quantity), unit: item.unit, unitCost: String(item.unit_cost), unitPrice: String(item.unit_price),
      productionNotes: item.production_notes ?? "",
      pricingSource: item.pricing_source === "calculado" && item.pricing_snapshot ? "calculado" : "manual",
      configurator: serviceOnlyMachine ? "maquina_servico" : flexibleComposition ? "composicao_livre" : snapshot?.specialProjectKind ?? "produto",
      productId: serviceOnlyMachine || flexibleComposition ? "" : item.pricing_product_id ?? "",
      productSearch: serviceOnlyMachine || flexibleComposition ? "" : product?.name ?? item.description,
      materialId: serviceOnlyMachine || flexibleComposition ? "" : product?.default_material_id ?? "",
      machineId: serviceOnlyMachine ? snapshot?.machineId ?? "" : flexibleComposition ? snapshot?.compositionMachineId ?? "" : product?.default_machine_id ?? "",
      machineMinutes: serviceOnlyMachine ? String(snapshot?.machineMinutesEntered ?? snapshot?.machineMinutes ?? "") : String(snapshot?.projectInput?.machineMinutes ?? ""),
      laborMinutes: String(snapshot?.projectInput?.laborMinutes ?? 0),
      machineTimeUnit: snapshot?.machineTimeUnit ?? "min",
      machineTimeMode: snapshot?.machineTimeMode ?? "per_unit",
      suggestedUnitPrice: item.suggested_unit_price ?? null, wastePercent: item.waste_percent ?? null,
      pricingSnapshot: item.pricing_source === "calculado" ? snapshot : null,
      customerSuppliesMaterial: Boolean(snapshot?.materialSuppliedByCustomer),
      installationIncluded: Number(snapshot?.projectInput?.installationCost ?? 0) > 0,
      installationCost: String(snapshot?.projectInput?.installationCost ?? 0),
      desiredMarginPercent: String(snapshot?.desiredMarginPercent ?? catalog.settings?.target_margin_percent ?? 30),
      invoiceIncluded: Number(snapshot?.taxPercent ?? 0) > 0,
      invoicePercent: String(snapshot?.taxPercent ?? catalog.settings?.tax_percent ?? 0),
      commissionIncluded: Number(snapshot?.commissionPercent ?? 0) > 0,
      commissionPercent: String(snapshot?.commissionPercent ?? catalog.settings?.commission_percent ?? 0),
      optionGroup: item.option_group ?? "",
    };
  }) : prefill ? [{ ...emptyItem(), ...prefill.item, pricingSource: "manual", configurator: "produto", desiredMarginPercent: prefill.item.desiredMarginPercent, invoicePercent: String(catalog.settings?.tax_percent ?? 0), commissionPercent: String(catalog.settings?.commission_percent ?? 0) }] : [{ ...emptyItem(), desiredMarginPercent: String(catalog.settings?.target_margin_percent ?? 30), invoicePercent: String(catalog.settings?.tax_percent ?? 0), commissionPercent: String(catalog.settings?.commission_percent ?? 0) }]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [discount, setDiscount] = useState(String(draft?.discount ?? 0));
  const [freight, setFreight] = useState(String(draft?.freight ?? 0));
  const [calculating, setCalculating] = useState<number | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [templates, setTemplates] = useState<CompositionTemplate[]>([]);
  const [templateMessage, setTemplateMessage] = useState("");
  const [templateDraft, setTemplateDraft] = useState<{ index: number; name: string } | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const loadTemplates = useCallback(() => api<{ templates: CompositionTemplate[] }>("/api/gestao/modelos-orcamento").then((result) => { setTemplates(result.templates); setTemplateMessage(""); }).catch((error: Error) => setTemplateMessage(error.message)), []);
  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  const totals = useMemo(() => {
    const pricedItems = quoteBaseItems(items);
    const subtotal = pricedItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
    const cost = pricedItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0);
    const total = Math.max(0, subtotal + Number(freight || 0) - Number(discount || 0));
    const discountFactor = subtotal > 0 ? Math.max(subtotal - Number(discount || 0), 0) / subtotal : 1;
    const tax = pricedItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0) * discountFactor * Number(item.pricingSource === "manual" ? (item.invoiceIncluded ? item.invoicePercent : 0) : item.pricingSnapshot?.taxPercent ?? 0) / 100, 0);
    const commission = pricedItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0) * discountFactor * Number(item.pricingSource === "manual" ? (item.commissionIncluded ? item.commissionPercent : 0) : item.pricingSnapshot?.commissionPercent ?? 0) / 100, 0);
    const profit = total - cost - tax - commission;
    return { subtotal, cost, total, tax, commission, profit, margin: total ? profit / total * 100 : 0, markup: cost ? profit / cost * 100 : 0 };
  }, [items, discount, freight]);
  const itemAudits = useMemo(() => items.map((item) => auditQuoteItem(item, referenceQuotes, Number(catalog.settings?.target_margin_percent ?? 30), quote?.id)), [catalog.settings?.target_margin_percent, items, quote?.id, referenceQuotes]);

  const intelligenceAlerts = useMemo(() => {
    const alerts: Array<{ level: "danger" | "warning" | "info"; text: string }> = [];
    const pending = items.filter((item) => item.pricingSource === "calculado" && !item.pricingSnapshot).length;
    const belowCost = items.filter((item) => Number(item.unitPrice || 0) < Number(item.unitCost || 0)).length;
    const zeroCost = items.filter((item) => item.pricingSource === "manual" && Number(item.unitCost || 0) <= 0).length;
    if (!contact.customerName || !contact.phone) alerts.push({ level: "warning", text: "Complete o contato e o WhatsApp do cliente." });
    if (pending) alerts.push({ level: "danger", text: `${pending} item(ns) precisam ser calculados novamente.` });
    if (belowCost) alerts.push({ level: "danger", text: `${belowCost} item(ns) estão com preço abaixo do custo.` });
    if (zeroCost) alerts.push({ level: "warning", text: `${zeroCost} item(ns) manuais estão sem custo informado.` });
    if (totals.total > 0 && totals.margin < 0) alerts.push({ level: "danger", text: `A proposta gera prejuízo estimado de ${currency.format(Math.abs(totals.profit))}.` });
    if (Number(discount || 0) > 0) alerts.push({ level: Number(discount) >= Math.max(totals.profit + Number(discount), 0) ? "danger" : "info", text: `O desconto reduz o resultado em ${currency.format(Number(discount))}.` });
    if (!alerts.length && totals.total > 0) alerts.push({ level: "info", text: "Composição saudável: custos, margem e condições estão coerentes." });
    return alerts;
  }, [contact.customerName, contact.phone, discount, items, totals.margin, totals.profit, totals.total]);

  function goToStep(step: number, id: string) {
    setActiveStep(step);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function chooseCustomer(customer: Customer | null) {
    setCustomerSearch(customer ? (customer.company_name ? `${customer.company_name} — ${customer.name}` : customer.name) : "");
    setContact(customer ? { customerId: customer.id, customerName: customer.name, company: customer.company_name ?? "", phone: customer.whatsapp || customer.phone || "", email: customer.email ?? "" } : { customerId: "", customerName: "", company: "", phone: "", email: "" });
  }

  function updateItem(index: number, key: keyof ItemDraft, value: string) {
    const presentationOnly = key === "description" || key === "unitPrice" || key === "productionNotes";
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value, pricingSnapshot: presentationOnly ? item.pricingSnapshot : null } : item));
  }

  function itemLaborEstimate(item: ItemDraft) {
    return estimateLabor({
      kind: item.configurator === "produto" ? item.serviceType : item.configurator,
      widthMm: Number(item.widthMm), heightMm: Number(item.heightMm), depthMm: Number(item.depthMm), quantity: Number(item.quantity),
      description: item.description, material: item.material, installationIncluded: item.installationIncluded,
    });
  }

  function selectCatalogProduct(index: number, product: PricingCatalog["products"][number]) {
    const material = catalog.materials.find((entry) => entry.id === product.default_material_id);
    const machine = catalog.machines.find((entry) => entry.id === product.default_machine_id);
    const serviceType = machine?.machine_type === "grandes_formatos" ? "impressao" : machine?.machine_type ?? "outro";
    const productName = normalizeSearch(product.name);
    const finishingMode = productName.includes("banner") ? "banner" : productName.includes("faixa") ? "faixa" : "none";
    setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? {
      ...entry,
      configurator: "produto",
      productId: product.id,
      productSearch: product.name,
      description: product.name,
      serviceType,
      materialId: product.default_material_id ?? "",
      machineId: product.default_machine_id ?? "",
      machineMinutes: "",
      materialConsumption: "",
      material: materialDisplayName(material),
      laborMinutes: String(product.default_labor_minutes),
      orientation: "auto",
      finishingMode,
      finishingAllowanceMm: "50",
      customerSuppliesMaterial: false,
      desiredMarginPercent: String(catalog.settings?.target_margin_percent ?? 30),
      invoicePercent: String(catalog.settings?.tax_percent ?? 0),
      commissionPercent: String(catalog.settings?.commission_percent ?? 0),
      unitCost: "0",
      unitPrice: "0",
      suggestedUnitPrice: null,
      wastePercent: null,
      pricingSnapshot: null,
    } : entry));
  }

  function selectCalculationType(index: number, value: string) {
    if (value.startsWith("product:")) {
      const product = catalog.products.find((entry) => entry.id === value.slice("product:".length));
      if (product) selectCatalogProduct(index, product);
      return;
    }
    const machineService = value === "maquina_servico";
    const flexibleComposition = value === "composicao_livre";
    setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? {
      ...entry,
      configurator: value as ItemDraft["configurator"],
      description: machineService ? "Serviço de máquina com material do cliente" : flexibleComposition ? "Projeto personalizado por composição" : entry.description,
      serviceType: machineService || flexibleComposition ? "outro" : entry.serviceType,
      material: machineService ? "Material fornecido pelo cliente" : flexibleComposition ? "Composição personalizada" : entry.material,
      unit: machineService ? "serviço" : flexibleComposition ? "un" : entry.unit,
      productId: "",
      productSearch: "",
      materialId: "",
      machineId: "",
      machineMinutes: "",
      machineTimeUnit: "min",
      unitCost: "0",
      unitPrice: "0",
      suggestedUnitPrice: null,
      wastePercent: null,
      productionNotes: "",
      customerSuppliesMaterial: machineService,
      pricingSnapshot: null,
    } : entry));
  }

  function selectServiceMachine(index: number, machineId: string) {
    const machine = catalog.machines.find((entry) => entry.id === machineId);
    const serviceType = machine?.machine_type === "grandes_formatos" ? "impressao" : machine?.machine_type ?? "outro";
    setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? {
      ...entry,
      machineId,
      serviceType,
      description: machine ? `Serviço de ${machine.name} — material do cliente` : "Serviço de máquina com material do cliente",
      material: "Material fornecido pelo cliente",
      customerSuppliesMaterial: true,
      unitCost: "0",
      unitPrice: "0",
      suggestedUnitPrice: null,
      pricingSnapshot: null,
    } : entry));
  }

  function addManualItem() {
    setItems((current) => [...current, manualItem(catalog)]);
  }

  function addTenderItem(id: string) {
    const tender = tenderItems.find((entry) => entry.id === id);
    if (!tender) return;
    const notes = [tender.specification, tender.source_note].filter(Boolean).join("\n");
    setItems((current) => [...current, {
      ...manualItem(catalog),
      description: tender.description,
      material: tender.category || "Item de licitação",
      unit: tender.unit,
      unitCost: String(tender.reference_cost),
      unitPrice: String(tender.reference_price),
      productionNotes: notes,
      invoiceIncluded: Number(tender.tax_percent) > 0,
      invoicePercent: String(tender.tax_percent),
      desiredMarginPercent: String(tender.margin_percent),
    }]);
  }

  function applyTemplate(id: string) {
    const template = templates.find((entry) => entry.id === id);
    if (!template) return;
    const payload = template.item_payload ?? {};
    const calculated = payload.pricingSource !== "manual";
    const savedSnapshot = (payload.pricingSnapshot ?? payload.configurationSnapshot ?? null) as SmartCalculation | null;
    setItems((current) => [...current, {
      ...emptyItem(),
      ...payload,
      description: String(payload.description ?? template.name),
      quantity: String(payload.quantity ?? 1),
      unitCost: calculated ? "0" : String(payload.unitCost ?? 0),
      unitPrice: calculated ? "0" : String(payload.unitPrice ?? 0),
      suggestedUnitPrice: null,
      wastePercent: null,
      pricingSnapshot: null,
      configurationSnapshot: calculated ? savedSnapshot : null,
    }]);
    setTemplateMessage(`OK:Modelo “${template.name}” adicionado. Confira medidas e recalcule para usar os custos atuais.`);
    onDirtyChange(true);
  }

  async function saveTemplate() {
    if (!templateDraft) return;
    const item = items[templateDraft.index];
    const name = templateDraft.name.trim();
    if (!item || name.length < 3) { setTemplateMessage("Informe um nome com pelo menos 3 caracteres para o modelo."); return; }
    const snapshot = item.pricingSnapshot ?? item.configurationSnapshot;
    if (item.pricingSource === "calculado" && !snapshot) { setTemplateMessage("Calcule o item antes de salvá-lo como modelo."); return; }
    setTemplateSaving(true); setTemplateMessage("");
    try {
      await api("/api/gestao/modelos-orcamento", { method: "POST", body: JSON.stringify({
        name,
        category: item.configurator,
        description: item.description,
        itemPayload: { ...item, pricingSnapshot: snapshot, configurationSnapshot: null },
      }) });
      setTemplateDraft(null);
      await loadTemplates();
      setTemplateMessage(`OK:Modelo “${name}” salvo. Ele já pode ser reutilizado em outros orçamentos.`);
    } catch (error) { setTemplateMessage((error as Error).message); } finally { setTemplateSaving(false); }
  }

  async function calculateItem(index: number) {
    const item = items[index];
    if (item.configurator === "maquina_servico") {
      const machine = catalog.machines.find((entry) => entry.id === item.machineId);
      if (!machine) { setMessage("Selecione a máquina usada no serviço."); return; }
      if (!Number(item.machineMinutes)) { setMessage("Informe o tempo de uso da máquina."); return; }
      if (!Number(item.quantity)) { setMessage("Informe a quantidade de peças ou serviços."); return; }
      const enteredMinutes = item.machineTimeUnit === "h" ? Number(item.machineMinutes) * 60 : Number(item.machineMinutes);
      const machineMinutes = item.machineTimeMode === "per_unit" ? enteredMinutes * Number(item.quantity) : enteredMinutes;
      const appliedLaborMinutes = Number(item.laborMinutes) > 0 ? Number(item.laborMinutes) : itemLaborEstimate(item).minutes;
      setCalculating(index); setMessage("");
      try {
        const result = await api<{ calculation: SmartCalculation }>("/api/gestao/precificacao/calcular", { method: "POST", body: JSON.stringify({
          model: "consumo", productId: "", materialId: "", machineId: item.machineId,
          widthMm: item.widthMm || 0, heightMm: item.heightMm || 0, quantity: item.quantity,
          consumptionQuantity: 0, machineMinutes, laborMinutes: appliedLaborMinutes,
          extraCost: item.installationIncluded ? item.installationCost : 0,
          invoiceIncluded: item.invoiceIncluded, invoicePercent: item.invoicePercent,
          commissionIncluded: item.commissionIncluded, commissionPercent: item.commissionPercent,
          desiredMarginPercent: item.desiredMarginPercent, includeMaterialCost: false,
        }) });
        const calculation: SmartCalculation = {
          ...result.calculation,
          materialUsage: "Material fornecido pelo cliente · sem custo e sem baixa de estoque",
          serviceOnlyMachine: true,
          machineId: machine.id,
          machineName: machine.name,
          machineMinutes,
          machineMinutesEntered: Number(item.machineMinutes),
          machineTimeUnit: item.machineTimeUnit,
          machineTimeMode: item.machineTimeMode,
        };
        setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? {
          ...entry,
          material: "Material fornecido pelo cliente",
          unitCost: String(calculation.unitCost),
          unitPrice: String(calculation.suggestedUnitPrice),
          suggestedUnitPrice: calculation.suggestedUnitPrice,
          wastePercent: 0,
          pricingSource: "calculado",
          laborMinutes: String(appliedLaborMinutes),
          pricingSnapshot: calculation,
          configurationSnapshot: null,
        } : entry));
        onDirtyChange(true);
      } catch (error) { setMessage((error as Error).message); } finally { setCalculating(null); }
      return;
    }
    const product = catalog.products.find((entry) => entry.id === item.productId);
    if (!product) { setMessage("Pesquise e selecione um produto cadastrado."); return; }
    const material = catalog.materials.find((entry) => entry.id === item.materialId);
    if (!material) { setMessage(`O produto “${product.name}” ainda não possui insumo principal. Complete sua ficha técnica.`); return; }
    const machine = catalog.machines.find((entry) => entry.id === item.machineId);
    const process = machine?.machine_type ?? "outro";
    const needsDimensions = material.format === "rolo" || material.format === "chapa";
    if (!Number(item.quantity) || (needsDimensions && (!Number(item.widthMm) || !Number(item.heightMm)))) { setMessage("Informe dimensões e quantidade antes de calcular."); return; }
    if (["router_cnc", "laser", "impressora_3d"].includes(process) && !Number(item.machineMinutes)) { setMessage("Informe o tempo estimado de máquina para este processo."); return; }
    if (process === "impressora_3d" && !Number(item.materialConsumption)) { setMessage("Informe o peso de filamento estimado pelo fatiador."); return; }
    setCalculating(index); setMessage("");
    const appliedLaborMinutes = Number(item.laborMinutes) > 0 ? Number(item.laborMinutes) : itemLaborEstimate(item).minutes;
    try {
      const result = await api<{ calculation: SmartCalculation }>("/api/gestao/precificacao/calcular", { method: "POST", body: JSON.stringify({
        model: material.format === "rolo" ? "rolo" : material.format === "chapa" ? "chapa" : "consumo",
        productId: item.productId, materialId: item.materialId, machineId: item.machineId, widthMm: item.widthMm || 0, heightMm: item.heightMm || 0,
        quantity: item.quantity,
        consumptionQuantity: process === "impressora_3d" ? Number(item.materialConsumption) / 1000 : item.quantity,
        machineMinutes: item.machineMinutes, laborMinutes: appliedLaborMinutes,
        orientation: item.orientation, finishingMode: item.finishingMode, finishingAllowanceMm: item.finishingMode === "none" ? 0 : item.finishingAllowanceMm,
        extraCost: item.installationIncluded ? item.installationCost : 0, invoiceIncluded: item.invoiceIncluded,
        invoicePercent: item.invoicePercent, commissionIncluded: item.commissionIncluded,
        commissionPercent: item.commissionPercent, desiredMarginPercent: item.desiredMarginPercent, allowRotation: true,
        varnishIncluded: item.varnishIncluded, varnishRateM2: 10,
        includeMaterialCost: !item.customerSuppliesMaterial,
      }) });
      setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? {
        ...entry, material: materialDisplayName(material), unitCost: String(result.calculation.unitCost), unitPrice: String(result.calculation.suggestedUnitPrice),
        suggestedUnitPrice: result.calculation.suggestedUnitPrice, wastePercent: result.calculation.wastePercent,
        pricingSource: "calculado", laborMinutes: String(appliedLaborMinutes), pricingSnapshot: result.calculation, configurationSnapshot: null,
      } : entry));
      onDirtyChange(true);
    } catch (error) { setMessage((error as Error).message); } finally { setCalculating(null); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (contact.customerName.trim().length < 2) { setMessage("Informe o nome do cliente com pelo menos 2 caracteres."); return; }
    if (contact.phone.replace(/\D/g, "").length < 8) { setMessage("Informe um telefone ou WhatsApp válido para o cliente."); return; }
    const invalidItem = items.findIndex((item) => item.description.trim().length < 2 || Number(item.quantity) <= 0 || Number(item.unitPrice) < 0);
    if (invalidItem >= 0) { setMessage(`Revise o item ${invalidItem + 1}: descrição, quantidade e preço precisam estar preenchidos corretamente.`); return; }
    const pendingItem = items.findIndex((item) => item.pricingSource === "calculado" && !item.pricingSnapshot);
    if (pendingItem >= 0) {
      setMessage(`Calcule novamente o item ${pendingItem + 1} antes de salvar. Assim o custo, a perda e o consumo de estoque não ficam desatualizados.`);
      return;
    }
    const criticalItem = itemAudits.findIndex((audit) => audit.level === "danger");
    if (criticalItem >= 0) {
      const reason = itemAudits[criticalItem].messages.find((entry) => entry.level === "danger")?.text ?? "Há uma inconsistência crítica.";
      setMessage(`Auditoria bloqueou o item ${criticalItem + 1}: ${reason}`);
      goToStep(2, "quote-step-items");
      return;
    }
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/orcamentos", { method: quote ? "PUT" : "POST", body: JSON.stringify({
        ...(quote ? { id: quote.id } : {}),
        ...contact,
        service: form.get("service"),
        source: form.get("source"),
        validUntil: form.get("validUntil"),
        paymentTerms: form.get("paymentTerms"),
        deliveryDays: form.get("deliveryDays"),
        installationIncluded: form.get("installationIncluded") === "on",
        freight,
        discount,
        details: form.get("details"),
        internalNotes: form.get("internalNotes"),
        material: compactQuoteSummary(items.map((item) => item.material), 160, "A definir"),
        dimensions: compactQuoteSummary(items.map((item) => item.widthMm && item.heightMm ? `${item.widthMm} × ${item.heightMm} mm` : ""), 120, ""),
        quantity: Math.max(1, Math.round(items.reduce((sum, item) => sum + Number(item.quantity || 0), 0))),
        items: items.map((item) => ({
          ...item,
          pricingSnapshot: item.pricingSource === "manual" ? {
            pricingMode: "manual",
            source: item.serviceType === "terceirizado" ? "manual_or_tender" : "manual",
            taxPercent: item.invoiceIncluded ? Number(item.invoicePercent || 0) : 0,
            commissionPercent: item.commissionIncluded ? Number(item.commissionPercent || 0) : 0,
            desiredMarginPercent: Number(item.desiredMarginPercent || 0),
            totalCost: Number(item.quantity || 0) * Number(item.unitCost || 0),
          } : item.pricingSnapshot,
        })),
      }) });
      onSaved();
    } catch (error) {
      setMessage((error as Error).message);
      setSaving(false);
    }
  }

  const validDate = new Date(); validDate.setDate(validDate.getDate() + 7);
  return <form id="quote-editor" className={`module-form quote-builder ${quote ? "quote-builder-editing" : "quote-builder-creating"}`} onSubmit={submit} onChangeCapture={() => onDirtyChange(true)}>
    {quote && <div className="quote-edit-mode-banner"><span><Pencil/></span><div><small>MODO DE EDIÇÃO</small><b>Você está alterando o orçamento #{quote.number}</b><p>{quote.company || quote.customerName} · {quote.service} · status atual: {statusLabel[quote.status] ?? quote.status}</p></div><em>Os campos abaixo foram carregados com os dados atuais.</em></div>}
    {duplicate && <div className="quote-duplicate-mode-banner"><span><Copy/></span><div><small>NOVA CÓPIA</small><b>Duplicando o orçamento #{duplicate.number}</b><p>Cliente, itens, custos e condições foram copiados. Ao salvar, será criado um novo número.</p></div><em>O orçamento original não será alterado.</em></div>}
    <div className="form-title"><div><b>{quote ? `Revisar orçamento #${quote.number}` : duplicate ? `Nova proposta baseada no orçamento #${duplicate.number}` : "Orçamento inteligente"}</b><small>{quote?.status === "aprovado" ? "A versão já aprovada continuará arquivada; ao salvar, este orçamento voltará para Em análise." : quote ? "Confira os dados pré-carregados, faça somente as alterações necessárias e salve a revisão." : duplicate ? "Revise medidas, valores, validade e condições antes de salvar a nova proposta." : "Monte a proposta com cálculo técnico, leitura financeira e alertas automáticos."}</small></div><Button type="button" variant="ghost" size="icon" aria-label={quote ? "Sair do modo de edição" : "Fechar novo orçamento"} onClick={onClose}><X/></Button></div>
    <nav className="quote-wizard-nav" aria-label="Etapas do orçamento inteligente">
      <button type="button" className={activeStep === 1 ? "active" : contact.customerName && contact.phone ? "complete" : ""} onClick={() => goToStep(1, "quote-step-client")}><span>1</span><b>Cliente</b><small>Oportunidade e contato</small></button>
      <button type="button" className={activeStep === 2 ? "active" : items.every((item) => item.pricingSource === "manual" || item.pricingSnapshot) ? "complete" : ""} onClick={() => goToStep(2, "quote-step-items")}><span>2</span><b>Composição</b><small>Materiais e processos</small></button>
      <button type="button" className={activeStep === 3 ? "active" : ""} onClick={() => goToStep(3, "quote-step-conditions")}><span>3</span><b>Condições</b><small>Prazo e pagamento</small></button>
      <button type="button" className={activeStep === 4 ? "active" : totals.total > 0 && totals.profit >= 0 ? "complete" : ""} onClick={() => goToStep(4, "quote-step-finance")}><span>4</span><b>Validação</b><small>Preço, lucro e riscos</small></button>
    </nav>
    <div className="quote-builder-layout"><div className="quote-builder-main">
      <section className="form-block quote-wizard-step" id="quote-step-client"><div className="form-section-title"><UserRound/><div><b>1. Cliente e oportunidade</b><small>Selecione um cadastro ou informe um contato avulso.</small></div></div><div className="form-grid">
        <label className="span-2">Cliente cadastrado<CustomerAutocomplete customers={customers} value={customerSearch} selectedId={contact.customerId} onChange={setCustomerSearch} onSelect={chooseCustomer}/></label>
        <label>Contato<Input value={contact.customerName} onChange={(event) => setContact({ ...contact, customerName: event.target.value })} required/></label>
        <label>Empresa<Input value={contact.company} onChange={(event) => setContact({ ...contact, company: event.target.value })}/></label>
        <label>WhatsApp<Input value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} required/></label>
        <label>E-mail<Input type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })}/></label>
        <label className="span-2">Projeto / serviço<Input name="service" defaultValue={draft?.service ?? prefill?.service ?? ""} placeholder="Ex.: Fachada ACM com letras caixa iluminadas" required/></label>
        <label>Origem<select name="source" defaultValue={draft?.source ?? "whatsapp"}><option value="whatsapp">WhatsApp</option><option value="site">Site</option><option value="telefone">Telefone</option><option value="presencial">Presencial</option><option value="interno">Interno</option><option value="outro">Outro</option></select></label>
        <label>Validade<Input name="validUntil" type="date" defaultValue={duplicate ? validDate.toISOString().slice(0, 10) : draft?.validUntil ?? validDate.toISOString().slice(0, 10)}/></label>
      </div></section>
      <div className="quote-add-actions"><div><b>Como deseja adicionar o próximo item?</b><small>Use o cálculo inteligente, um preço manual, licitação ou uma composição que você já salvou.</small></div><Button type="button" variant="outline" onClick={addManualItem}><Plus/>Item avulso / preço manual</Button><select aria-label="Adicionar item de licitação" defaultValue="" onChange={(event) => { if (event.target.value) addTenderItem(event.target.value); event.target.value = ""; }}><option value="">Adicionar da licitação...</option>{tenderItems.map((entry) => <option key={entry.id} value={entry.id}>{entry.code ? `${entry.code} · ` : ""}{entry.description}</option>)}</select><select className="quote-template-select" aria-label="Adicionar modelo salvo" defaultValue="" onChange={(event) => { if (event.target.value) applyTemplate(event.target.value); event.target.value = ""; }}><option value="">Usar modelo salvo...</option>{templates.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>{templateMessage && <Feedback message={templateMessage}/>}</div>
      <section className="form-block quote-wizard-step" id="quote-step-items"><div className="form-section-title"><ClipboardList/><div><b>2. Composição técnica e comercial</b><small>Separe impressão, estrutura, acabamento, instalação e terceirização.</small></div></div><div className="quote-items">{items.map((item, index) => <article key={index} className="quote-item-card"><header><b>Item {index + 1}</b><div className="quote-item-header-actions"><Button type="button" variant="ghost" size="sm" onClick={() => setTemplateDraft({ index, name: item.description || `Modelo do item ${index + 1}` })}><Save/>Salvar como modelo</Button>{items.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Remover item ${index + 1}`} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2/></Button>}</div></header>{templateDraft?.index === index && <div className="template-save-panel"><label>Nome do modelo<Input autoFocus value={templateDraft.name} onChange={(event) => setTemplateDraft({ ...templateDraft, name: event.target.value })} placeholder="Ex.: Placa PVC com aplique espelhado"/></label><Button type="button" variant="outline" onClick={() => setTemplateDraft(null)}>Cancelar</Button><Button type="button" onClick={saveTemplate} disabled={templateSaving}><Save/>{templateSaving ? "Salvando..." : "Salvar modelo"}</Button></div>}<div className="form-grid">
        <label className="span-2">Descrição comercial<Input value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} placeholder="Descrição clara do que será produzido" required/><small>Você pode simplificar este texto para o cliente. Alterar somente a descrição não muda nem invalida o cálculo técnico.</small></label>
        <label>Processo<select value={item.serviceType} onChange={(event) => updateItem(index, "serviceType", event.target.value)}><option value="impressao">Impressão digital</option><option value="router_cnc">Router CNC</option><option value="laser">Corte / gravação laser</option><option value="impressao_3d">Impressão 3D</option><option value="acabamento">Acabamento</option><option value="instalacao">Instalação</option><option value="terceirizado">Terceirizado</option><option value="outro">Outro</option></select></label>
        <label>Forma de preço<select value={item.pricingSource} onChange={(event) => updateItem(index, "pricingSource", event.target.value)}><option value="calculado">Cálculo inteligente</option><option value="manual">Preço manual</option></select></label>
        <label className="span-2 checkbox-label quote-option-toggle"><input type="checkbox" checked={Boolean(item.optionGroup)} onChange={(event) => updateItem(index, "optionGroup", event.target.checked ? "Escolha de material" : "")}/> Este item é uma alternativa para o cliente escolher</label>
        {item.optionGroup && <label className="span-2">Nome do grupo de escolha<Input list={`option-groups-${index}`} value={item.optionGroup} onChange={(event) => updateItem(index, "optionGroup", event.target.value)} placeholder="Ex.: Espessura da placa" required/><datalist id={`option-groups-${index}`}>{[...new Set(items.map((entry) => entry.optionGroup).filter(Boolean))].map((group) => <option key={group} value={group}/>)}</datalist><small>Use exatamente o mesmo nome nos itens que se substituem. O cliente escolherá somente um deles.</small></label>}
        {item.pricingSource === "calculado" && <div className="span-2 calculation-type-field"><label>Tipo de cálculo<select value={item.configurator === "produto" && item.productId ? `product:${item.productId}` : item.configurator} onChange={(event) => selectCalculationType(index, event.target.value)}><optgroup label="Formas rápidas"><option value="composicao_livre">Composição rápida — combine materiais e processos</option><option value="maquina_servico">Somente serviço de máquina — material do cliente</option><option value="produto">Pesquisar uma ficha técnica pronta...</option></optgroup><optgroup label="Projetos guiados"><option value="banner">Banner — lona + acabamento completo</option><option value="faixa">Faixa — lona + acabamento completo</option><option value="lona_backdrop">Lona backdrop — ilhós ou outro acabamento</option><option value="adesivo_impresso">Adesivo impresso</option><option value="adesivo_impresso_recorte">Adesivo impresso com recorte</option><option value="adesivo_cor">Adesivo na cor — liso ou com recorte</option><option value="gravacao_laser">Gravação a laser — copos e objetos</option><option value="placa_adesivada">Placa adesivada — chapa + adesivo</option><option value="placa_aplique">Placa com aplique — base + uma ou mais camadas</option><option value="placa_acm_letra_caixa">Placa de ACM com letras em PVC ou 3D</option><option value="caixa_expositor">Caixas e expositores — MDF, acrílico ou PVC</option><option value="estrutura_lona">Estrutura revestida — lona, ACM ou galvanizado</option><option value="totem">Totem — estrutura, faces, base e elétrica</option><option value="neon_led">Neon LED 2ª geração — base, mangueira e fonte</option><option value="impressao_3d">Impressão 3D — peso, filamento e tempo</option><option value="envelopamento">Plotagem / envelopamento de veículo</option><option value="impressao_rapida">Impressão rápida em papel</option><option value="letra_caixa">Letra-caixa (maciça, com retorno ou LED)</option><option value="medalha">Medalhas personalizadas</option></optgroup>{catalog.products.length > 0 && <optgroup label="Tipos cadastrados por você">{catalog.products.map((product) => <option key={product.id} value={`product:${product.id}`}>{product.name}</option>)}</optgroup>}</select><small>Use a composição rápida para trabalhos únicos: escolha as chapas e outros insumos diretamente aqui, sem criar um produto antes.</small></label><Button type="button" variant="outline" onClick={onManageCalculationTypes}><Plus/>Cadastrar novo tipo</Button></div>}
        {item.pricingSource === "calculado" && item.configurator === "produto" ? <label className="span-2">Buscar produto<ProductAutocomplete products={catalog.products} value={item.productSearch} selectedId={item.productId}
          onChange={(value) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, productSearch: value, productId: "", materialId: "", machineId: "", pricingSnapshot: null } : entry))}
          onSelect={(product) => selectCatalogProduct(index, product)}/>
          {item.productId && <small className="selected-product-meta">{item.material || "Insumo principal pendente"}{item.machineId ? ` · ${catalog.machines.find((machine) => machine.id === item.machineId)?.name ?? "Máquina vinculada"}` : ""}</small>}
        </label> : item.pricingSource === "manual" ? <label className="span-2">Material<Input value={item.material} onChange={(event) => updateItem(index, "material", event.target.value)} placeholder="ACM, MDF, acrílico, lona..."/></label> : null}
        {item.pricingSource === "calculado" && item.configurator === "maquina_servico" && <div className="span-2 machine-service-config">
          <div><Calculator/><span><b>Somente máquina / corte terceirizado</b><small>O material é do cliente. O sistema cobra tempo, preparação, energia, desgaste, consumíveis, mão de obra, custos fixos e margem.</small></span></div>
          <label>Máquina<select value={item.machineId} onChange={(event) => selectServiceMachine(index, event.target.value)} required><option value="">Selecione a máquina</option>{catalog.machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name}</option>)}</select></label>
          <label>Tempo efetivo<Input type="number" min="0.01" step="0.01" value={item.machineMinutes} onChange={(event) => updateItem(index, "machineMinutes", event.target.value)} placeholder="Ex.: 45"/></label>
          <label>Unidade do tempo<select value={item.machineTimeUnit} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, machineTimeUnit: event.target.value as "min" | "h", pricingSnapshot: null } : entry))}><option value="min">Minutos</option><option value="h">Horas</option></select></label>
          <label>O tempo informado é<select value={item.machineTimeMode} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, machineTimeMode: event.target.value as "per_unit" | "total_job", pricingSnapshot: null } : entry))}><option value="per_unit">Por unidade / chapa</option><option value="total_job">Total do lote inteiro</option></select></label>
          <small className="span-2 machine-time-preview">Tempo cobrado: <b>{item.machineTimeMode === "per_unit" ? Number(item.machineMinutes || 0) * Number(item.quantity || 0) : Number(item.machineMinutes || 0)} {item.machineTimeUnit === "h" ? "hora(s)" : "minuto(s)"}</b>{item.machineTimeMode === "per_unit" && Number(item.quantity) > 1 ? ` (${item.machineMinutes || 0} × ${item.quantity} unidades)` : ""}.</small>
          {item.machineId && <small className="span-2">A configuração da máquina acrescenta automaticamente {catalog.machines.find((machine) => machine.id === item.machineId)?.setup_minutes ?? 0} min de preparação e respeita o mínimo de {catalog.machines.find((machine) => machine.id === item.machineId)?.minimum_minutes ?? 0} min.</small>}
        </div>}
        {item.pricingSource === "calculado" && item.configurator === "produto" && item.productId && <label className="span-2">Material e largura usados neste orçamento<select value={item.materialId} onChange={(event) => { const selected = catalog.materials.find((material) => material.id === event.target.value); setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, materialId: event.target.value, material: materialDisplayName(selected), pricingSnapshot: null } : entry)); }} required><option value="">Selecione o rolo, chapa ou insumo</option>{catalog.materials.filter((candidate) => { const current = catalog.materials.find((material) => material.id === item.materialId); return !current || candidate.format === current.format || candidate.category === current.category; }).map((candidate) => <option value={candidate.id} key={candidate.id}>{materialDisplayName(candidate)}{candidate.format === "rolo" && candidate.usable_width_mm ? ` · largura útil ${Number(candidate.usable_width_mm) / 1000} m` : ""}</option>)}</select><small>O custo e a perda são recalculados conforme o rolo ou a chapa escolhidos.</small></label>}
        {item.pricingSource === "calculado" && item.configurator === "produto" && item.productId && item.machineId && <label className="span-2 checkbox-label customer-material-toggle"><input type="checkbox" checked={item.customerSuppliesMaterial} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, customerSuppliesMaterial: event.target.checked, pricingSnapshot: null } : entry))}/><span><b>Material principal fornecido pelo cliente — calcular somente o serviço</b><small>Use para corte na router, laser, plotter ou outro equipamento quando o terceiro trouxer a chapa/peça. O insumo serve como referência técnica, mas não entra no custo nem no estoque.</small></span></label>}
        {item.pricingSource === "calculado" && item.configurator === "produto" && catalog.materials.find((material) => material.id === item.materialId)?.format === "rolo" && <><label>Orientação na bobina<select value={item.orientation} onChange={(event) => updateItem(index, "orientation", event.target.value)}><option value="auto">Automática — menor custo</option><option value="normal">Normal</option><option value="rotated">Girar 90°</option></select></label><label>Acabamento<select value={item.finishingMode} onChange={(event) => updateItem(index, "finishingMode", event.target.value)}><option value="none">Sem sobra</option><option value="banner">Banner — em cima e embaixo</option><option value="faixa">Faixa — nas laterais</option></select></label>{item.finishingMode !== "none" && <label>Sobra em cada lado (mm)<Input type="number" min="0" max="500" step="1" value={item.finishingAllowanceMm} onChange={(event) => updateItem(index, "finishingAllowanceMm", event.target.value)}/><small>Total acrescentado: {Number(item.finishingAllowanceMm || 0) * 2} mm.</small></label>}{["lona", "vinil"].includes(catalog.materials.find((material) => material.id === item.materialId)?.category ?? "") && <label className="checkbox-label"><input type="checkbox" checked={item.varnishIncluded} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, varnishIncluded: event.target.checked, pricingSnapshot: null } : entry))}/> Verniz protetor (+ R$ 10,00/m²)</label>}</>}
        {(item.pricingSource === "manual" || item.configurator === "produto" || item.configurator === "maquina_servico") && <><label>Largura (mm){item.configurator === "maquina_servico" && <small>Opcional — use quando houver consumo por m²</small>}<Input type="number" min="0" step="0.1" value={item.widthMm} onChange={(event) => updateItem(index, "widthMm", event.target.value)}/></label><label>Altura (mm){item.configurator === "maquina_servico" && <small>Opcional</small>}<Input type="number" min="0" step="0.1" value={item.heightMm} onChange={(event) => updateItem(index, "heightMm", event.target.value)}/></label><label>Profundidade (mm)<Input type="number" min="0" step="0.1" value={item.depthMm} onChange={(event) => updateItem(index, "depthMm", event.target.value)}/></label></>}
        <label>Quantidade<Input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} required/></label>
        <label>Unidade<select value={item.unit} onChange={(event) => updateItem(index, "unit", event.target.value)}><option value="un">un</option><option value="m²">m²</option><option value="m">m</option><option value="kit">kit</option><option value="h">hora</option><option value="serviço">serviço</option></select></label>
        {item.pricingSource === "calculado" && item.configurator === "produto" && ["router_cnc", "laser", "impressora_3d"].includes(catalog.machines.find((machine) => machine.id === item.machineId)?.machine_type ?? "") && <label>Tempo de produção (min)<Input type="number" min="0.1" step="0.1" value={item.machineMinutes} onChange={(event) => updateItem(index, "machineMinutes", event.target.value)} placeholder="Sem incluir a preparação"/></label>}
        {item.pricingSource === "calculado" && item.configurator === "produto" && catalog.machines.find((machine) => machine.id === item.machineId)?.machine_type === "impressora_3d" && <label>Filamento total estimado (g)<Input type="number" min="0.1" step="0.1" value={item.materialConsumption} onChange={(event) => updateItem(index, "materialConsumption", event.target.value)} placeholder="Peso total informado pelo fatiador"/></label>}
        {item.pricingSource === "calculado" && <><label className="labor-field">Mão de obra (min)<Input type="number" min="0" step="0.1" value={item.laborMinutes} onChange={(event) => updateItem(index, "laborMinutes", event.target.value)}/>{["produto", "maquina_servico", "composicao_livre"].includes(item.configurator) && <LaborSuggestion estimate={itemLaborEstimate(item)} current={item.laborMinutes} onApply={() => updateItem(index, "laborMinutes", String(itemLaborEstimate(item).minutes))}/>}</label><label>Percentual de lucro desejado (%)<Input type="number" min="0" max="90" step="0.1" value={item.desiredMarginPercent} onChange={(event) => updateItem(index, "desiredMarginPercent", event.target.value)}/><small>{catalog.products.find((product) => product.id === item.productId)?.profit_calculation_mode === "markup" ? "Aplicado como acréscimo sobre o custo deste produto." : "Aplicado como margem real sobre a venda."}</small></label></>}
        <label className="checkbox-label"><input type="checkbox" checked={item.invoiceIncluded} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, invoiceIncluded: event.target.checked, pricingSnapshot: entry.pricingSource === "calculado" ? null : entry.pricingSnapshot } : entry))}/> Emitir nota fiscal</label>
        {item.invoiceIncluded && <label>Nota fiscal (%)<Input type="number" min="0" max="90" step="0.01" value={item.invoicePercent} onChange={(event) => updateItem(index, "invoicePercent", event.target.value)}/></label>}
        <label className="checkbox-label"><input type="checkbox" checked={item.commissionIncluded} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, commissionIncluded: event.target.checked, pricingSnapshot: entry.pricingSource === "calculado" ? null : entry.pricingSnapshot } : entry))}/> Incluir comissão</label>
        {item.commissionIncluded && <label>Comissão (%)<Input type="number" min="0" max="90" step="0.01" value={item.commissionPercent} onChange={(event) => updateItem(index, "commissionPercent", event.target.value)}/></label>}
        {item.pricingSource === "calculado" && <><label className="checkbox-label"><input type="checkbox" checked={item.installationIncluded} onChange={(event) => setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, installationIncluded: event.target.checked, pricingSnapshot: null } : entry))}/> Instalação terceirizada</label>{item.installationIncluded && <label>Custo da instalação<Input type="number" min="0" step="0.01" value={item.installationCost} onChange={(event) => updateItem(index, "installationCost", event.target.value)}/></label>}</>}
        <label>Custo unitário<Input type="number" min="0" step="0.0001" value={item.unitCost} readOnly={item.pricingSource === "calculado"} onChange={(event) => updateItem(index, "unitCost", event.target.value)} required/></label>
        <label>Preço unitário<Input type="number" min="0" step="0.0001" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} required/></label>
        <label className="span-2">Instrução para produção<Input value={item.productionNotes} onChange={(event) => updateItem(index, "productionNotes", event.target.value)} placeholder="Acabamento, cor, arquivo, montagem..."/></label>
        <div className="span-2"><ManualCostReport item={item}/></div>
      </div>
      {item.pricingSource === "calculado" && item.configurator === "composicao_livre" && <FlexibleCompositionConfigurator
        key={`${index}-flexible-composition`}
        catalog={catalog}
        quantity={item.quantity}
        laborMinutes={item.laborMinutes}
        installationCost={item.installationIncluded ? item.installationCost : "0"}
        desiredMarginPercent={item.desiredMarginPercent}
        invoiceIncluded={item.invoiceIncluded}
        invoicePercent={item.invoicePercent}
        commissionIncluded={item.commissionIncluded}
        commissionPercent={item.commissionPercent}
        initial={(item.pricingSnapshot ?? item.configurationSnapshot)?.flexibleComposition ? (item.pricingSnapshot ?? item.configurationSnapshot) as FlexibleCalculation : null}
        showInitialResult={Boolean(item.pricingSnapshot)}
        onCalculated={(calculation, summary) => {
          setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, ...summary, unitCost: String(calculation.unitCost), unitPrice: String(calculation.suggestedUnitPrice), suggestedUnitPrice: calculation.suggestedUnitPrice, wastePercent: calculation.wastePercent, pricingSnapshot: calculation, configurationSnapshot: null } : entry));
          onDirtyChange(true);
        }}
      />}
      {item.pricingSource === "calculado" && item.configurator !== "produto" && item.configurator !== "maquina_servico" && item.configurator !== "composicao_livre" && <SpecialProjectConfigurator
        key={`${index}-${item.configurator}`}
        kind={item.configurator}
        catalog={catalog}
        initial={item.pricingSnapshot ?? item.configurationSnapshot}
        showInitialResult={Boolean(item.pricingSnapshot)}
        initialDimensions={{ widthMm: item.widthMm, heightMm: item.heightMm, depthMm: item.depthMm }}
        onChanged={() => { setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, configurationSnapshot: entry.pricingSnapshot ?? entry.configurationSnapshot, pricingSnapshot: null } : entry)); onDirtyChange(true); }}
        common={{ quantity: item.quantity, laborMinutes: item.laborMinutes, machineMinutes: item.machineMinutes, installationCost: item.installationIncluded ? item.installationCost : "0", desiredMarginPercent: item.desiredMarginPercent, invoiceIncluded: item.invoiceIncluded, invoicePercent: item.invoicePercent, commissionIncluded: item.commissionIncluded, commissionPercent: item.commissionPercent }}
        onLaborSuggested={(minutes) => updateItem(index, "laborMinutes", String(minutes))}
        onCalculated={(calculation, summary) => {
          setItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, ...summary, unitCost: String(calculation.unitCost), unitPrice: String(calculation.suggestedUnitPrice), suggestedUnitPrice: calculation.suggestedUnitPrice, wastePercent: calculation.wastePercent, pricingSnapshot: { ...calculation, specialProjectKind: item.configurator as SpecialProjectKind }, configurationSnapshot: null } : entry));
          onDirtyChange(true);
        }}
      />}
      {item.pricingSource === "calculado" && (item.configurator === "produto" || item.configurator === "maquina_servico") && <div className="smart-pricing-action">
        <Button type="button" variant="outline" onClick={() => calculateItem(index)} disabled={calculating === index || (item.configurator === "produto" ? !item.productId : !item.machineId)}><Sparkles/>{calculating === index ? "Calculando..." : item.pricingSnapshot ? "Recalcular custo" : item.configurator === "maquina_servico" ? "Calcular somente a máquina" : "Calcular automaticamente"}</Button>
        {item.configurator === "produto" && !item.productId && <small>Pesquise e selecione um produto para liberar o cálculo.</small>}
        {item.configurator === "maquina_servico" && !item.machineId && <small>Selecione a máquina e informe o tempo para liberar o cálculo.</small>}
        {((item.configurator === "produto" && item.productId) || (item.configurator === "maquina_servico" && item.machineId)) && !item.pricingSnapshot && <small>Há alterações pendentes. Calcule novamente antes de salvar.</small>}
      </div>}
      {item.pricingSnapshot && <div className="smart-pricing-action"><div className="smart-result"><span><b>{item.pricingSnapshot.materialUsage}</b><small>{item.pricingSnapshot.serviceOnlyMachine ? `${item.pricingSnapshot.machineName} · ${item.pricingSnapshot.machineMinutesEntered ?? item.pricingSnapshot.machineMinutes} ${item.pricingSnapshot.machineTimeUnit === "h" ? "hora(s)" : "minuto(s)"} ${item.pricingSnapshot.machineTimeMode === "per_unit" ? "por unidade" : "no lote"} · total calculado ${item.pricingSnapshot.machineMinutes} min` : <>Produção: {item.pricingSnapshot.productionWidthMm} × {item.pricingSnapshot.productionHeightMm} mm · {item.pricingSnapshot.rotated ? "girada 90°" : "normal"}<br/>Área final {item.pricingSnapshot.netAreaM2} m² · perda {item.pricingSnapshot.wasteAreaM2} m² ({item.pricingSnapshot.wastePercent}%)</>}</small></span><span><small>Custo completo</small><b>{currency.format(item.pricingSnapshot.totalCost)}</b><small>{item.pricingSnapshot.desiredMarginPercent}% {(item.pricingSnapshot as SmartCalculation & { profitCalculationMode?: "margin" | "markup" }).profitCalculationMode === "markup" ? "sobre o custo" : "de margem"}</small></span><span><small>Mínimo · Médio · Máximo</small><b>{currency.format(item.pricingSnapshot.minimumSuggestedPrice)} · {currency.format(item.pricingSnapshot.averageSuggestedPrice)} · {currency.format(item.pricingSnapshot.maximumSuggestedPrice)}</b></span></div><CommercialCostReport item={item}/>{!item.pricingSnapshot.serviceOnlyMachine && <div className="material-cost-metrics"><span><small>Custo principal / metro</small><b>{currency.format(item.pricingSnapshot.materialCostPerLinearMeter)}/m</b></span><span><small>Custo por área</small><b>{currency.format(item.pricingSnapshot.materialCostPerM2)}/m²</b></span><span><small>Acabamento</small><b>{currency.format(item.pricingSnapshot.finishingCost)}</b></span><span><small>Perda calculada</small><b>{currency.format(item.pricingSnapshot.wasteCost)}</b></span></div>}<details className="pricing-audit"><summary>Ver memória de cálculo completa</summary>{item.pricingSnapshot.costLines.map((line) => <div key={line.key}><span><b>{line.label}</b><small>{line.detail}</small></span><strong>{currency.format(line.amount)}</strong></div>)}</details></div>}
      <ItemAuditPanel audit={itemAudits[index]}/><footer><span>Total do item</span><b>{currency.format(Number(item.quantity || 0) * Number(item.unitPrice || 0))}</b></footer></article>)}</div><Button type="button" variant="outline" onClick={() => setItems((current) => [...current, { ...emptyItem(), desiredMarginPercent: String(catalog.settings?.target_margin_percent ?? 30), invoicePercent: String(catalog.settings?.tax_percent ?? 0), commissionPercent: String(catalog.settings?.commission_percent ?? 0) }])}><Plus/>Adicionar item</Button></section>
      <section className="form-block quote-wizard-step" id="quote-step-conditions"><div className="form-section-title"><FileText/><div><b>3. Condições, prazo e briefing</b><small>O que o cliente verá e o que a equipe precisa saber.</small></div></div><div className="form-grid">
        <label>Prazo de produção (dias)<Input name="deliveryDays" type="number" min="0" defaultValue={draft?.deliveryDays ?? 7}/></label>
        <label>Frete / deslocamento<Input type="number" min="0" step="0.01" value={freight} onChange={(event) => setFreight(event.target.value)}/></label>
        <label>Desconto<Input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)}/></label>
        <label className="checkbox-label"><input name="installationIncluded" type="checkbox" defaultChecked={draft?.installationIncluded}/> Instalação inclusa</label>
        <label className="span-2">Condições de pagamento<Input name="paymentTerms" defaultValue={draft?.paymentTerms ?? ""} placeholder="Ex.: 50% de entrada e saldo na entrega"/></label>
        <label className="span-2 textarea-label">Escopo e observações da proposta<textarea name="details" rows={3} defaultValue={draft?.details ?? prefill?.details ?? ""} placeholder="Inclui, não inclui, requisitos do cliente, condições de aprovação..."/></label>
        <label className="span-2 textarea-label">Observações internas<textarea name="internalNotes" rows={3} defaultValue={draft?.internalNotes ?? prefill?.internalNotes ?? ""} placeholder="Custos especiais, fornecedor, negociação e informações que não vão para o cliente..."/></label>
      </div></section>
    </div><aside className="quote-summary" id="quote-step-finance"><p>4. VALIDAÇÃO FINANCEIRA</p><div><span>Subtotal dos itens</span><b>{currency.format(totals.subtotal)}</b></div><div><span>Frete / deslocamento</span><b>{currency.format(Number(freight || 0))}</b></div><div><span>Desconto</span><b>- {currency.format(Number(discount || 0))}</b></div><div className="summary-total"><span>Total da proposta</span><strong>{currency.format(totals.total)}</strong></div><div><span>Produção e operação</span><b>{currency.format(totals.cost)}</b></div>{totals.tax > 0 && <div className="summary-deduction"><span>Reserva para nota fiscal</span><b>{currency.format(totals.tax)}</b></div>}{totals.commission > 0 && <div className="summary-deduction commission"><span>Comissão prevista</span><b>{currency.format(totals.commission)}</b></div>}<div><span>Resultado estimado</span><b>{currency.format(totals.profit)}</b></div><div className={totals.profit < 0 ? "margin-warning" : "margin-ok"}><span>Resultado sobre o custo</span><b>{totals.markup.toFixed(1)}%</b></div><div><span>Margem líquida sobre a venda</span><b>{totals.margin.toFixed(1)}%</b></div><section className="quote-intelligence-alerts"><header><Sparkles/><span><b>Diagnóstico inteligente</b><small>{intelligenceAlerts.filter((alert) => alert.level !== "info").length ? "Revise os pontos antes de salvar" : "Pronto para negociação"}</small></span></header>{intelligenceAlerts.map((alert, index) => <div className={alert.level} key={`${alert.level}-${index}`}>{alert.level === "danger" || alert.level === "warning" ? <AlertTriangle/> : <Check/>}<span>{alert.text}</span></div>)}</section><small>Cada produto respeita seu modo de lucro: margem real ou acréscimo sobre o custo. Nota e comissão são calculadas sobre a venda após o desconto proporcional.</small><Feedback message={message}/><Button type="submit" disabled={saving}><Save/>{saving ? "Salvando..." : quote ? "Salvar nova revisão" : duplicate ? "Criar orçamento duplicado" : "Salvar orçamento"}</Button><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button></aside></div>
  </form>;
}

function suggestedBillingDate(customer?: Customer) {
  const result = new Date(); result.setHours(12, 0, 0, 0);
  if (customer?.billing_cycle === "semanal") {
    const weekday = Number(customer.billing_weekday ?? 5);
    const delta = (weekday - result.getDay() + 7) % 7 || 7;
    result.setDate(result.getDate() + delta);
  } else if (customer?.billing_cycle === "mensal") {
    const day = Number(customer.billing_day ?? 28);
    if (result.getDate() >= day) result.setMonth(result.getMonth() + 1);
    result.setDate(day);
  }
  return new Intl.DateTimeFormat("en-CA").format(result);
}

function CloseQuoteForm({ quote, customer, onClose, onSaved }: { quote: Quote; customer?: Customer; onClose: () => void; onSaved: () => void }) {
  const [message, setMessage] = useState("");
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  const [total, setTotal] = useState(Number(quote.estimatedValue ?? 0));
  const [deposit, setDeposit] = useState(0);
  const [count, setCount] = useState(1);
  const [firstDue, setFirstDue] = useState(suggestedBillingDate(customer));
  const [frequency, setFrequency] = useState(customer?.billing_cycle === "semanal" ? "semanal" : "mensal");
  const [balanceMethod, setBalanceMethod] = useState("pix");
  const balance = Math.max(0, total - deposit);
  const installments = useMemo(() => {
    if (!balance) return [];
    const totalCents = Math.round(balance * 100), base = Math.floor(totalCents / Math.max(1, count)), remainder = totalCents - base * count;
    return Array.from({ length: Math.max(1, count) }, (_, index) => { const due = new Date(`${firstDue}T12:00:00`); if (frequency === "semanal") due.setDate(due.getDate() + index * 7); else if (frequency === "quinzenal") due.setDate(due.getDate() + index * 15); else due.setMonth(due.getMonth() + index); return { installmentNumber: index + 1, dueDate: due.toISOString().slice(0, 10), amount: (base + (index === count - 1 ? remainder : 0)) / 100, paymentMethod: balanceMethod }; });
  }, [balance, balanceMethod, count, firstDue, frequency]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await api("/api/gestao/orcamentos/fechar", { method: "POST", body: JSON.stringify({ quoteId: quote.id, totalValue: total, deposit, paymentMethod: form.get("paymentMethod"), receivedOn: form.get("receivedOn"), installments }) }); onSaved(); } catch (error) { setMessage((error as Error).message); }
  }
  return <form className="module-form accent close-quote" onSubmit={submit}><div className="form-title"><div><b>Fechar orçamento #{quote.number}</b><small>{quote.customerName} · {quote.service}</small></div><Button type="button" variant="ghost" size="icon" onClick={onClose}><X/></Button></div>{customer && customer.billing_cycle !== "imediato" && <div className="billing-profile-banner"><CircleDollarSign/><div><b>Conta {customer.billing_cycle === "semanal" ? "semanal" : "mensal"} ativa</b><small>O vencimento foi sugerido conforme o cadastro deste cliente{customer.credit_limit ? ` · limite ${currency.format(Number(customer.credit_limit))}` : ""}.</small></div></div>}<div className="form-grid"><label>Valor total<Input name="totalValue" type="number" min="0.01" step="0.01" value={total || ""} onChange={(event) => setTotal(Number(event.target.value))} required/></label><label>Entrada já recebida<Input name="deposit" type="number" min="0" max={total} step="0.01" value={deposit} onChange={(event) => setDeposit(Number(event.target.value))} required/></label><label>Forma da entrada<select name="paymentMethod" defaultValue="pix"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="boleto">Boleto</option><option value="transferencia">Transferência</option><option value="outro">Outro</option></select></label><label>Data do recebimento<Input name="receivedOn" type="date" defaultValue={today} required/></label></div>{balance > 0 && <><div className="form-grid receivable-schedule-fields"><label>Parcelas do saldo<Input type="number" min="1" max="120" value={count} onChange={(event) => setCount(Math.max(1, Number(event.target.value) || 1))}/></label><label>Primeiro vencimento<Input type="date" value={firstDue} onChange={(event) => setFirstDue(event.target.value)}/></label><label>Intervalo<select value={frequency} onChange={(event) => setFrequency(event.target.value)}><option value="semanal">Semanal</option><option value="quinzenal">Quinzenal</option><option value="mensal">Mensal</option></select></label><label>Forma do saldo<select value={balanceMethod} onChange={(event) => setBalanceMethod(event.target.value)}><option value="pix">PIX</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option><option value="dinheiro">Dinheiro</option><option value="outro">Outro</option></select></label></div><div className="receivable-schedule-preview"><div><span>Saldo a receber</span><b>{currency.format(balance)}</b></div>{installments.map((item) => <span key={item.installmentNumber}><b>{item.installmentNumber}ª</b> {date(item.dueDate)} · {currency.format(item.amount)}</span>)}</div></>}<p className="form-hint">A entrada vai para o caixa realizado; o saldo cria contas a receber e uma ordem de serviço automaticamente.</p><Feedback message={message}/><Button type="submit">Confirmar fechamento, financeiro e OS</Button></form>;
}

function RevalidateQuoteForm({ quote, onClose, onSaved }: { quote: Quote; onClose: () => void; onSaved: () => void }) {
  const defaultDate = new Date(); defaultDate.setDate(defaultDate.getDate() + 7);
  const [validUntil, setValidUntil] = useState(defaultDate.toISOString().slice(0, 10));
  const [reviewed, setReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewed) { setMessage("Confirme a revisão dos custos e preços antes de revalidar."); return; }
    setSaving(true); setMessage("");
    try {
      await api("/api/orcamentos", { method: "PATCH", body: JSON.stringify({ action: "revalidate", id: quote.id, validUntil }) });
      onSaved();
    } catch (error) { setMessage((error as Error).message); setSaving(false); }
  }
  return <form className="module-form revalidate-quote" onSubmit={submit}><div className="form-title"><div><b>Revalidar orçamento #{quote.number}</b><small>{quote.company || quote.customerName} · mantenha o mesmo número e o mesmo link público.</small></div><Button type="button" variant="ghost" size="icon" onClick={onClose}><X/></Button></div><div className="revalidate-guide"><CalendarClock/><div><b>Quando usar a revalidação?</b><p>Use quando o escopo continua igual e somente a validade precisa ser renovada. Se houver mudança relevante de produto, quantidade ou preço, duplique o orçamento.</p></div></div><div className="form-grid"><label>Validade anterior<Input value={date(quote.validUntil)} readOnly/></label><label>Nova validade<Input type="date" min={new Date().toISOString().slice(0, 10)} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} required/></label><label className="span-2 checkbox-label revalidate-confirm"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)}/><span><b>Revisei os custos, preços, quantidades e condições</b><small>O orçamento voltará para “Em análise” e o link já enviado ao cliente ficará válido novamente.</small></span></label></div><Feedback message={message}/><footer><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving || !reviewed}><CalendarClock/>{saving ? "Revalidando..." : "Revalidar proposta"}</Button></footer></form>;
}

function QuoteShareActions({ quote }: { quote: Quote }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  async function markAsSent() {
    if (!["novo", "em_analise"].includes(quote.status)) return true;
    try {
      await api("/api/orcamentos", { method: "PATCH", body: JSON.stringify({ id: quote.id, status: "aguardando_cliente" }) });
      return true;
    } catch {
      return false;
    }
  }
  async function getLink() {
    try {
      const result = await api<{ url: string }>(`/api/gestao/orcamentos/${quote.id}/link`, { method: "POST" });
      setUrl(result.url); setMessage("OK:Link público criado.");
      return result.url;
    } catch (error) { setMessage((error as Error).message); return ""; }
  }
  async function copy() { const link = url || await getLink(); if (!link) return; await navigator.clipboard.writeText(link); const tracked = await markAsSent(); setMessage(tracked ? "OK:Link copiado. Proposta marcada como enviada e retorno agendado." : "Link copiado, mas não foi possível ativar o lembrete automático."); }
  async function open() { const link = url || await getLink(); if (link) window.open(link, "_blank", "noopener,noreferrer"); }
  async function whatsapp() {
    const link = url || await getLink(); if (!link) return;
    const tracked = await markAsSent();
    const destination = whatsappUrl(quote.phone, `Olá, ${quote.customerName}! Segue a proposta #${quote.number}: ${link}`);
    if (!destination) { setMessage("Cadastre um WhatsApp válido no cliente deste orçamento antes de enviar."); return; }
    window.open(destination, "_blank", "noopener,noreferrer");
    setMessage(tracked ? "OK:Proposta marcada como enviada. O retorno será lembrado automaticamente em 2 dias." : "WhatsApp aberto, mas não foi possível ativar o lembrete automático.");
  }
  return <div className="quote-share"><div><b>Proposta pública</b><small>O cliente verá apenas informações comerciais e poderá aprovar ou recusar. Copiar o link ou abrir pelo WhatsApp marca a proposta como enviada e ativa o acompanhamento.</small></div>{url && <Input value={url} readOnly aria-label="Link público da proposta"/>}<div className="row-actions"><Button size="sm" onClick={getLink}><Share2/>{url ? "Atualizar link" : "Criar link"}</Button><Button size="sm" variant="outline" onClick={copy}><Copy/>Copiar e acompanhar</Button><Button size="sm" variant="outline" onClick={open}><ExternalLink/>Abrir</Button><Button size="sm" variant="outline" onClick={whatsapp}><MessageCircle/>WhatsApp e acompanhar</Button></div><Feedback message={message}/></div>;
}

function QuoteDetails({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const cost = quoteCostItems(quote.items).reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_cost), 0);
  const total = Number(quote.estimatedValue ?? 0);
  const margin = total ? ((total - cost) / total) * 100 : 0;
  return <section className="quote-detail"><header><div><span className={`status-pill status-${quote.status}`}>{statusLabel[quote.status] ?? quote.status}</span><h2>Orçamento #{quote.number}</h2><p>{quote.company || quote.customerName} · {quote.service}</p></div><Button variant="ghost" size="icon" onClick={onClose}><X/></Button></header>{Boolean(quote.viewCount) && <div className="quote-view-banner"><Eye/><div><b>Proposta visualizada {quote.viewCount} {quote.viewCount === 1 ? "vez" : "vezes"} pelo cliente</b><small>Última abertura em {showApprovalDate(quote.lastViewedAt)}{quote.firstViewedAt && quote.firstViewedAt !== quote.lastViewedAt ? ` · primeira em ${showApprovalDate(quote.firstViewedAt)}` : ""}</small></div></div>}{quote.approvalVersions.length > 0 && <div className="approval-history"><Check/><div><b>{quote.approvalVersions.length} versão(ões) aprovada(s) preservada(s)</b><small>Cada aprovação permanece imutável, mesmo depois de uma nova revisão.</small><span>{quote.approvalVersions.map((version) => <Button key={version.id} size="sm" variant="outline" onClick={() => window.open(`/api/gestao/orcamentos/versao/${version.id}`, "_blank", "noopener,noreferrer")}><FileText/>Versão {version.version} · {showApprovalDate(version.approved_at)}</Button>)}</span></div></div>}<div className="quote-detail-metrics"><article><span>Total</span><b>{currency.format(total)}</b></article><article><span>Custo previsto</span><b>{currency.format(cost)}</b></article><article><span>Margem bruta</span><b>{margin.toFixed(1)}%</b></article><article><span>Validade</span><b>{date(quote.validUntil)}</b></article></div><QuoteShareActions quote={quote}/><div className="quote-detail-grid"><div><h3>Itens</h3>{quote.items.length ? <div className="detail-items">{quote.items.map((item, index) => <article key={item.id ?? index}><div><b>{item.description}</b><small>{item.material || item.service_type || "Sem material definido"}{item.width_mm && item.height_mm ? ` · ${item.width_mm} × ${item.height_mm} mm` : ""}</small></div><span>{item.quantity} {item.unit}</span><strong>{currency.format(Number(item.total ?? item.quantity * item.unit_price))}</strong></article>)}</div> : <p className="detail-empty">Solicitação recebida sem composição de itens.</p>}</div><aside><h3>Condições</h3><dl><div><dt>Origem</dt><dd>{sourceLabel[quote.source] ?? quote.source}</dd></div><div><dt>Prazo</dt><dd>{quote.deliveryDays ? `${quote.deliveryDays} dias` : "A definir"}</dd></div><div><dt>Instalação</dt><dd>{quote.installationIncluded ? "Inclusa" : "Não inclusa"}</dd></div><div><dt>Pagamento</dt><dd>{quote.paymentTerms || "A definir"}</dd></div><div><dt>Contato</dt><dd>{quote.phone}</dd></div></dl></aside></div>{quote.details && <div className="quote-notes"><b>Escopo / observações</b><p>{quote.details}</p></div>}</section>;
}

export function QuotesPanel({ search, composerRequest = 0, requestedQuoteId, quoteOpenRequest = 0, prefill, onManageCalculationTypes }: { search: string; composerRequest?: number; requestedQuoteId?: string; quoteOpenRequest?: number; prefill?: CutPlanQuotePrefill; onManageCalculationTypes: () => void }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tenderItems, setTenderItems] = useState<TenderItem[]>([]);
  const [catalog, setCatalog] = useState<PricingCatalog>({ products: [], materials: [], machines: [], fixedCosts: [], fixedCostsMonthly: 0, costCenters: [], suppliers: [], settings: null, configured: false });
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(composerRequest > 0);
  const [quickSaleOpen, setQuickSaleOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [duplicating, setDuplicating] = useState<Quote | null>(null);
  const [revalidating, setRevalidating] = useState<Quote | null>(null);
  const [closing, setClosing] = useState<Quote | null>(null);
  const [details, setDetails] = useState<Quote | null>(null);
  const [filter, setFilter] = useState("abertos");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [quoteDirty, setQuoteDirty] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [reminderView, setReminderView] = useState<"followUps" | "expiring" | "approved" | "overduePayments">("followUps");
  const [hasMoreQuotes, setHasMoreQuotes] = useState(false);
  const [loadingMoreQuotes, setLoadingMoreQuotes] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const [quoteResult, customerResult, pricingResult, tenderResult] = await Promise.all([api<{ quotes: Quote[]; pagination?: { hasMore: boolean } }>("/api/orcamentos?limit=100&offset=0"), api<{ customers: Customer[] }>("/api/gestao/clientes"), api<PricingCatalog>("/api/gestao/precificacao"), api<{ items: TenderItem[] }>("/api/gestao/licitacoes").catch(() => ({ items: [] }))]);
    setQuotes(quoteResult.quotes); setHasMoreQuotes(Boolean(quoteResult.pagination?.hasMore)); setCustomers(customerResult.customers); setCatalog(pricingResult); setTenderItems(tenderResult.items); setLoading(false);
  }, []);
  const loadMoreQuotes = useCallback(async () => {
    if (loadingMoreQuotes || !hasMoreQuotes) return;
    setLoadingMoreQuotes(true);
    try {
      const next = await api<{ quotes: Quote[]; pagination?: { hasMore: boolean } }>(`/api/orcamentos?limit=100&offset=${quotes.length}`);
      setQuotes((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...next.quotes.filter((item) => !seen.has(item.id))];
      });
      setHasMoreQuotes(Boolean(next.pagination?.hasMore));
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoadingMoreQuotes(false);
    }
  }, [hasMoreQuotes, loadingMoreQuotes, quotes.length]);
  useEffect(() => {
    const timer = window.setTimeout(() => load().catch((error: Error) => { setMessage(error.message); setLoading(false); }), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!requestedQuoteId || loading || !quoteOpenRequest) return;
    const timer = window.setTimeout(() => {
      const quote = quotes.find((item) => item.id === requestedQuoteId);
      if (!quote) { setMessage("O orçamento desta notificação não foi encontrado ou não está mais disponível."); return; }
      setNewOpen(false); setEditing(null); setDuplicating(null); setRevalidating(null); setClosing(null); setDetails(quote); setFilter("todos");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, quoteOpenRequest, quotes, requestedQuoteId]);
  const quoteComposerOpen = Boolean(newOpen || editing || duplicating);
  const workspaceOpen = Boolean(quoteComposerOpen || quickSaleOpen || revalidating || closing || details);
  const closeQuoteComposer = useCallback((force = false) => {
    if (!force && quoteDirty) { setDiscardConfirmOpen(true); return false; }
    setNewOpen(false); setEditing(null); setDuplicating(null); setQuoteDirty(false); setDiscardConfirmOpen(false); return true;
  }, [quoteDirty]);
  useEffect(() => {
    if (!workspaceOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (discardConfirmOpen) { setDiscardConfirmOpen(false); return; }
      if (quoteComposerOpen && !closeQuoteComposer()) return;
      setQuickSaleOpen(false);
      setRevalidating(null);
      setClosing(null);
      setDetails(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", closeOnEscape); };
  }, [workspaceOpen, quoteComposerOpen, closeQuoteComposer, discardConfirmOpen]);
  const filtered = useMemo(() => quotes.filter((quote) => {
    const haystack = normalizeSearch(`${quote.number} ${quote.customerName} ${quote.company ?? ""} ${quote.phone ?? ""} ${quote.email ?? ""} ${quote.service} ${quote.material ?? ""} ${quote.details ?? ""} ${quote.status} ${quote.source} ${quote.items.map((item) => `${item.description} ${item.material ?? ""} ${item.service_type ?? ""}`).join(" ")}`);
    const matchesSearch = [search, quoteSearch].map(normalizeSearch).filter(Boolean).every((term) => haystack.includes(term));
    const matchesFilter = filter === "todos" || (filter === "abertos" && !["convertido", "recusado", "expirado"].includes(quote.status)) || (filter === "carteira" && !["recusado", "expirado"].includes(quote.status)) || quote.status === filter;
    return matchesSearch && matchesFilter;
  }), [quotes, search, quoteSearch, filter]);
  const reminders = useMemo(() => {
    const now = new Date();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
    const followUpLimit = new Date(now); followUpLimit.setDate(followUpLimit.getDate() - 2);
    const expiringLimit = new Date(now); expiringLimit.setDate(expiringLimit.getDate() + 2);
    const expiringDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(expiringLimit);
    return {
      followUps: quotes.filter((quote) => quote.status === "aguardando_cliente" && new Date(quote.updatedAt ?? quote.createdAt) <= followUpLimit),
      expiring: quotes.filter((quote) => ["novo", "em_analise", "aguardando_cliente"].includes(quote.status) && Boolean(quote.validUntil) && quote.validUntil! >= today && quote.validUntil! <= expiringDate),
      approved: quotes.filter((quote) => quote.status === "aprovado"),
      overduePayments: quotes.filter((quote) => quote.status === "convertido" && Number(quote.overdueBalance) > 0),
    };
  }, [quotes]);
  const reminderCount = reminders.followUps.length + reminders.expiring.length + reminders.approved.length + reminders.overduePayments.length;
  const reminderGroups = [
    { key: "followUps" as const, label: "Retornos", description: "Propostas esperando resposta", count: reminders.followUps.length, icon: Clock3 },
    { key: "expiring" as const, label: "Validade", description: "Vencem nos próximos dias", count: reminders.expiring.length, icon: CalendarClock },
    { key: "approved" as const, label: "Aprovados", description: "Prontos para fechar", count: reminders.approved.length, icon: Check },
    { key: "overduePayments" as const, label: "Cobranças", description: "Pagamentos em atraso", count: reminders.overduePayments.length, icon: CircleDollarSign },
  ];
  const currentReminderView = reminders[reminderView].length ? reminderView : (reminderGroups.find((group) => group.count)?.key ?? reminderView);
  const currentReminders = reminders[currentReminderView];

  function openFollowUp(quote: Quote) {
    const destination = whatsappUrl(quote.phone, `Olá, ${quote.customerName}! Tudo bem? Estou retornando sobre a proposta #${quote.number} — ${quote.service}. Conseguiu analisar? Posso esclarecer alguma dúvida ou ajustar alguma opção?`);
    if (!destination) { setMessage("Cadastre um WhatsApp válido no cliente deste orçamento para fazer o acompanhamento."); return; }
    window.open(destination, "_blank", "noopener,noreferrer");
  }

  async function changeStatus(id: string, status: string) {
    try { await api("/api/orcamentos", { method: "PATCH", body: JSON.stringify({ id, status }) }); await load(); setMessage("OK:Status atualizado."); } catch (error) { setMessage((error as Error).message); }
  }
  const pipeline = { open: quotes.filter((quote) => !["convertido", "recusado", "expirado"].includes(quote.status)).length, approved: quotes.filter((quote) => quote.status === "aprovado").length, closed: quotes.filter((quote) => quote.status === "convertido").length, value: quotes.filter((quote) => !["recusado", "expirado"].includes(quote.status)).reduce((sum, quote) => sum + Number(quote.estimatedValue ?? 0), 0) };

  return <>
    <SectionHeading eyebrow="PROPOSTAS E PRECIFICAÇÃO" title="Orçamentos" description="Controle do funil, composição de custos, margem, validade e conversão em ordem de serviço." action={<div className="quote-heading-actions"><Button variant="outline" onClick={() => setQuickSaleOpen(true)}><ShoppingCart/>Venda rápida</Button><Button onClick={() => { setQuoteDirty(false); setNewOpen(true); }}><Plus/>Novo orçamento</Button></div>}/>
    <section className="commercial-kpis" aria-label="Filtros rápidos do funil"><button type="button" className={filter === "abertos" ? "active" : ""} onClick={() => setFilter("abertos")}><span>EM ABERTO</span><b>{pipeline.open}</b><small>propostas no funil</small></button><button type="button" className={filter === "aprovado" ? "active" : ""} onClick={() => setFilter("aprovado")}><span>APROVADOS</span><b>{pipeline.approved}</b><small>aguardando fechamento</small></button><button type="button" className={filter === "convertido" ? "active" : ""} onClick={() => setFilter("convertido")}><span>CONVERTIDOS</span><b>{pipeline.closed}</b><small>ordens geradas</small></button><button type="button" className={filter === "carteira" ? "active" : ""} onClick={() => setFilter("carteira")}><span>CARTEIRA</span><b>{currency.format(pipeline.value)}</b><small>valor potencial</small></button></section>
    {!loading && <section className="quote-followup-center"><header><div><small>PRÓXIMAS AÇÕES</small><h2>Central de acompanhamento</h2><p>Prioridades comerciais reunidas sem esconder sua lista de orçamentos.</p></div><span className={reminderCount ? "has-reminders" : ""}>{reminderCount} ação(ões)</span></header>{reminderCount ? <><div className="quote-reminder-tabs">{reminderGroups.map(({ key, label, description, count, icon: Icon }) => <button key={key} type="button" className={currentReminderView === key ? "active" : ""} onClick={() => setReminderView(key)}><Icon/><span><b>{label}</b><small>{description}</small></span><strong>{count}</strong></button>)}</div><div className="quote-reminder-grid">{currentReminders.slice(0, 5).map((quote) => <article className={currentReminderView} key={`${currentReminderView}-${quote.id}`}><span>{currentReminderView === "approved" ? <Check/> : currentReminderView === "overduePayments" ? <CircleDollarSign/> : currentReminderView === "expiring" ? <CalendarClock/> : <Clock3/>}</span><div><small>{currentReminderView === "followUps" ? "RETORNO COMERCIAL" : currentReminderView === "expiring" ? "VALIDADE PRÓXIMA" : currentReminderView === "approved" ? "APROVADO — PRÓXIMO PASSO" : "PAGAMENTO VENCIDO"}</small><b>#{quote.number} · {quote.company || quote.customerName}</b><p>{currentReminderView === "followUps" ? `${quote.service} · aguardando resposta há pelo menos 2 dias` : currentReminderView === "expiring" ? `Vence em ${date(quote.validUntil)} · ${currency.format(Number(quote.estimatedValue ?? 0))}` : currentReminderView === "approved" ? "Confirme a entrada e gere a ordem de produção." : `${currency.format(Number(quote.overdueBalance))} em atraso · vencimento ${date(quote.nextPaymentDue)}`}</p></div><div><Button size="sm" variant="outline" onClick={() => setDetails(quote)}>Abrir proposta</Button>{currentReminderView === "approved" ? <Button size="sm" onClick={() => setClosing(quote)}>Fechar pedido</Button> : (currentReminderView === "followUps" || currentReminderView === "overduePayments") ? <Button size="sm" onClick={() => openFollowUp(quote)}><MessageCircle/>{currentReminderView === "followUps" ? "Pedir retorno" : "Cobrar"}</Button> : null}</div></article>)}{currentReminders.length > 5 && <p className="quote-reminder-more">Mais {currentReminders.length - 5} ação(ões) nesta categoria. Use os filtros do funil para consultar todas.</p>}</div></> : <div className="quote-reminders-clear"><Check/><span><b>Nenhuma ação pendente agora</b><small>Retornos, aprovações, prazos e pagamentos estão em dia.</small></span></div>}</section>}
    <Feedback message={message}/>
    {newOpen || editing || duplicating ? <div className="workspace-modal" role="dialog" aria-modal="true" aria-label={editing ? `Editar orçamento ${editing.number}` : duplicating ? `Duplicar orçamento ${duplicating.number}` : "Novo orçamento"} onMouseDown={(event) => { if (event.target === event.currentTarget) closeQuoteComposer(); }}><div className="workspace-dialog quote-workspace-dialog"><NewQuoteForm key={editing ? `edit-${editing.id}` : duplicating ? `duplicate-${duplicating.id}` : `new-quote-${composerRequest}`} quote={editing ?? undefined} duplicate={duplicating ?? undefined} prefill={!editing && !duplicating ? prefill : undefined} customers={customers} catalog={catalog} tenderItems={tenderItems} referenceQuotes={quotes} onDirtyChange={setQuoteDirty} onClose={() => closeQuoteComposer()} onManageCalculationTypes={onManageCalculationTypes} onSaved={() => { const revised = Boolean(editing); const copied = Boolean(duplicating); closeQuoteComposer(true); load(); setMessage(revised ? "OK:Nova revisão salva. Versões anteriormente aprovadas foram preservadas." : copied ? "OK:Orçamento duplicado com novo número. Revise e envie a nova proposta." : "OK:Orçamento cadastrado com composição de custos."); }}/></div></div> : null}
    {discardConfirmOpen ? <div className="discard-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDiscardConfirmOpen(false); }}><section className="discard-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="discard-confirm-title" aria-describedby="discard-confirm-description"><span className="discard-confirm-icon"><AlertTriangle/></span><div><small>ORÇAMENTO EM EDIÇÃO</small><h2 id="discard-confirm-title">Sair sem salvar?</h2><p id="discard-confirm-description">As alterações feitas neste orçamento ainda não foram salvas. Se você sair agora, somente essas mudanças recentes serão perdidas.</p></div><footer><Button type="button" variant="outline" onClick={() => setDiscardConfirmOpen(false)}>Voltar ao orçamento</Button><Button type="button" className="discard-confirm-danger" onClick={() => closeQuoteComposer(true)}><Trash2/>Sair sem salvar</Button></footer></section></div> : null}
    {quickSaleOpen ? <div className="workspace-modal" role="dialog" aria-modal="true" aria-label="Registrar venda rápida" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuickSaleOpen(false); }}><div className="workspace-dialog quick-sale-dialog"><QuickSaleForm customers={customers} catalog={catalog} onClose={() => setQuickSaleOpen(false)} onSaved={(number) => { setQuickSaleOpen(false); load(); setFilter("convertido"); setMessage(`OK:Venda rápida${number ? ` #${number}` : ""} registrada no financeiro, histórico e relatórios.`); }}/></div></div> : null}
    {closing ? <div className="workspace-modal" role="dialog" aria-modal="true" aria-label={`Fechar orçamento ${closing.number}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setClosing(null); }}><div className="workspace-dialog compact"><CloseQuoteForm quote={closing} customer={customers.find((customer) => customer.id === closing.customerId)} onClose={() => setClosing(null)} onSaved={() => { setClosing(null); load(); setMessage("OK:Orçamento fechado, recebimento registrado e ordem de produção criada."); }}/></div></div> : null}
    {revalidating ? <div className="workspace-modal" role="dialog" aria-modal="true" aria-label={`Revalidar orçamento ${revalidating.number}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setRevalidating(null); }}><div className="workspace-dialog compact"><RevalidateQuoteForm quote={revalidating} onClose={() => setRevalidating(null)} onSaved={() => { setRevalidating(null); load(); setMessage("OK:Orçamento revalidado. O mesmo link público já está disponível ao cliente."); }}/></div></div> : null}
    {details ? <div className="workspace-modal" role="dialog" aria-modal="true" aria-label={`Detalhes do orçamento ${details.number}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(null); }}><div className="workspace-dialog"><QuoteDetails quote={details} onClose={() => setDetails(null)}/></div></div> : null}
    <div className="table-toolbar quote-table-toolbar"><div><label>Status<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="abertos">Em aberto</option><option value="carteira">Carteira ativa</option><option value="todos">Todos</option><option value="novo">Novos</option><option value="em_analise">Em análise</option><option value="aguardando_cliente">Aguardando cliente</option><option value="aprovado">Aprovados</option><option value="convertido">Fechados</option><option value="recusado">Recusados</option><option value="expirado">Expirados</option></select></label><label className="quote-search-field"><Search/><Input type="search" value={quoteSearch} onChange={(event) => setQuoteSearch(event.target.value)} placeholder="Pesquisar nº, cliente, telefone, projeto ou item" aria-label="Pesquisar orçamentos"/>{quoteSearch && <button type="button" aria-label="Limpar pesquisa de orçamentos" onClick={() => setQuoteSearch("")}><X/></button>}</label></div><span>{filtered.length} resultado(s)</span></div>
    {!loading && !filtered.length ? <EmptyState icon={ClipboardList} title="Nenhum orçamento neste filtro" text="Crie uma proposta detalhada ou altere o filtro para consultar o histórico comercial."/> : <div className="module-table quote-table"><Table><TableHeader><TableRow><TableHead>Nº / origem</TableHead><TableHead>Cliente / projeto</TableHead><TableHead>Validade</TableHead><TableHead>Status</TableHead><TableHead>Margem</TableHead><TableHead>Valor</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{filtered.map((quote) => { const cost = quote.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_cost), 0); const total = Number(quote.estimatedValue ?? 0); const margin = total ? ((total - cost) / total) * 100 : 0; const expired = quote.status === "expirado" || Boolean(quote.validUntil && quote.validUntil < new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())); return <TableRow key={quote.id}><TableCell><b>#{quote.number}</b><small>{sourceLabel[quote.source] ?? quote.source} · {date(quote.createdAt)}</small>{Boolean(quote.viewCount) && <span className="quote-viewed-pill" title={`Última visualização em ${showApprovalDate(quote.lastViewedAt)}`}><Eye/>Vista {quote.viewCount}x</span>}</TableCell><TableCell><b>{quote.company || quote.customerName}</b><small>{quote.service}</small></TableCell><TableCell><span className={expired ? "quote-expired-date" : ""}>{date(quote.validUntil)}{expired && <small>Vencido</small>}</span></TableCell><TableCell><select value={quote.status} disabled={quote.status === "convertido"} onChange={(event) => changeStatus(quote.id, event.target.value)}><option value="novo">Novo</option><option value="em_analise">Em análise</option><option value="aguardando_cliente">Aguardando cliente</option><option value="aprovado">Aprovado</option><option value="recusado">Recusado</option><option value="expirado">Expirado</option><option value="convertido">Fechado</option></select></TableCell><TableCell><span className={margin && margin < 25 ? "margin-badge warning" : "margin-badge"}>{total ? `${margin.toFixed(1)}%` : "—"}</span></TableCell><TableCell><b>{quote.estimatedValue !== null ? currency.format(total) : "A calcular"}</b><small>{quote.items.length} item(ns)</small></TableCell><TableCell><div className="row-actions"><Button size="sm" variant="outline" onClick={() => setDetails(quote)}>Detalhes<ChevronDown/></Button><Button size="sm" variant="outline" onClick={() => { setDuplicating(quote); setEditing(null); setNewOpen(false); setDetails(null); }}><Copy/>Duplicar</Button>{expired && !["convertido", "aprovado"].includes(quote.status) && <Button size="sm" variant="outline" onClick={() => { setRevalidating(quote); setEditing(null); setDuplicating(null); setDetails(null); }}><CalendarClock/>Revalidar</Button>}{quote.status !== "convertido" && <Button size="sm" variant="outline" onClick={() => { setEditing(quote); setDuplicating(null); setRevalidating(null); setNewOpen(false); setDetails(null); }}><Pencil/>Editar</Button>}{quote.status !== "convertido" && <Button size="sm" onClick={() => setClosing(quote)}>Fechar</Button>}</div></TableCell></TableRow>; })}</TableBody></Table></div>}
    {hasMoreQuotes && <div className="list-load-more"><span>Exibindo {quotes.length} orçamento(s) carregado(s). Há mais registros antigos disponíveis.</span><Button type="button" variant="outline" onClick={() => void loadMoreQuotes()} disabled={loadingMoreQuotes}>{loadingMoreQuotes ? "Carregando..." : "Carregar mais orçamentos"}</Button></div>}
  </>;
}
