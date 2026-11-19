import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const quoteItemSchema = z.object({
  description: z.string().trim().min(2).max(240),
  serviceType: optionalText(80),
  material: optionalText(160),
  widthMm: z.coerce.number().min(0).max(100000).optional().default(0),
  heightMm: z.coerce.number().min(0).max(100000).optional().default(0),
  depthMm: z.coerce.number().min(0).max(100000).optional().default(0),
  quantity: z.coerce.number().positive().max(100000),
  unit: z.string().trim().min(1).max(20).default("un"),
  unitCost: z.coerce.number().min(0).max(99999999).default(0),
  unitPrice: z.coerce.number().min(0).max(99999999),
  productionNotes: optionalText(600),
  pricingSource: z.enum(["manual", "calculado"]).optional().default("manual"),
  suggestedUnitPrice: z.coerce.number().min(0).max(99999999).nullable().optional().default(null),
  wastePercent: z.coerce.number().min(0).max(100).nullable().optional().default(null),
  pricingSnapshot: z.record(z.unknown()).nullable().optional().default(null),
  productId: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  optionGroup: optionalText(120),
});

const validationLabels: Record<string, string> = {
  customerName: "nome do cliente", phone: "WhatsApp/telefone", email: "e-mail", service: "projeto/serviço", dimensions: "resumo das medidas", material: "resumo dos materiais", details: "escopo", quantity: "quantidade total", validUntil: "validade", paymentTerms: "condições de pagamento", deliveryDays: "prazo de produção", internalNotes: "observações internas",
  description: "descrição", serviceType: "processo", widthMm: "largura", heightMm: "altura", depthMm: "profundidade", unit: "unidade", unitCost: "custo unitário", unitPrice: "preço unitário", productionNotes: "instrução de produção", pricingSnapshot: "memória de cálculo", optionGroup: "grupo de escolha",
};

function quoteValidationMessage(error: z.ZodError) {
  const details = error.issues.slice(0, 5).map((issue) => {
    const [root, index, field] = issue.path;
    const location = root === "items" && typeof index === "number"
      ? `Item ${index + 1} — ${validationLabels[String(field)] ?? String(field ?? "dados")}`
      : validationLabels[String(root)] ?? String(root || "dados do orçamento");
    if (issue.code === "too_big") return `${location} ultrapassa o limite permitido (${issue.maximum})`;
    if (issue.code === "too_small") return `${location} está vazio ou abaixo do mínimo permitido`;
    if (issue.code === "invalid_string") return `${location} está em formato inválido`;
    if (issue.code === "invalid_type") return `${location} possui um valor inválido`;
    return `${location}: ${issue.message}`;
  });
  const remaining = Math.max(0, error.issues.length - details.length);
  return `Não foi possível salvar. ${details.join("; ")}${remaining ? `; e mais ${remaining} pendência(s)` : ""}.`;
}

function selectableSubtotal(items: z.infer<typeof quoteItemSchema>[]) {
  const fixed = items.filter((item) => !item.optionGroup);
  const groups = new Map<string, typeof items>();
  for (const item of items.filter((entry) => entry.optionGroup)) {
    const key = item.optionGroup.toLocaleLowerCase("pt-BR");
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const baseOptions = [...groups.values()].map((entries) => [...entries].sort((a, b) => a.quantity * a.unitPrice - b.quantity * b.unitPrice)[0]);
  return [...fixed, ...baseOptions].reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

const quoteSchema = z.object({
  customerId: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  customerName: z.string().trim().min(2).max(120),
  company: optionalText(120),
  phone: z.string().trim().min(8).max(40),
  email: z.union([z.string().trim().email().max(180), z.literal("")]).optional().default(""),
  service: z.string().trim().min(2).max(120),
  dimensions: optionalText(120),
  material: optionalText(160).transform((value) => value || "A definir"),
  details: optionalText(1800),
  quantity: z.coerce.number().int().min(1).max(100000000).default(1),
  source: z.enum(["site", "whatsapp", "telefone", "presencial", "interno", "outro"]).default("interno"),
  validUntil: optionalText(10),
  paymentTerms: optionalText(500),
  deliveryDays: z.coerce.number().int().min(0).max(365).optional().default(0),
  installationIncluded: z.boolean().optional().default(false),
  freight: z.coerce.number().min(0).max(99999999).optional().default(0),
  discount: z.coerce.number().min(0).max(99999999).optional().default(0),
  internalNotes: optionalText(1800),
  items: z.array(quoteItemSchema).max(100).optional().default([]),
});

const quoteStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["novo", "em_analise", "aguardando_cliente", "aprovado", "recusado", "expirado"]),
});
const quoteRevalidationSchema = z.object({
  action: z.literal("revalidate"),
  id: z.string().uuid(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const quoteUpdateSchema = quoteSchema.extend({ id: z.string().uuid() });

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Acesso não autorizado" }, { status: 401 });

  const { data, error } = await supabase
    .from("quotes")
    .select("id, number, customer_id, customer_name, company, phone, email, service, dimensions, material, details, quantity, status, source, created_at, updated_at, estimated_value, subtotal, discount, valid_until, payment_terms, delivery_days, installation_included, freight, internal_notes, quote_items(id, description, service_type, material, width_mm, height_mm, depth_mm, quantity, unit, unit_cost, unit_price, total, production_notes, sort_order, pricing_source, suggested_unit_price, waste_percent, pricing_snapshot, pricing_product_id, option_group, selected_by_customer)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return Response.json({ error: "Não foi possível consultar os orçamentos." }, { status: 500 });
  const quoteIds = (data ?? []).map((quote) => quote.id);
  const versionsResult = quoteIds.length
    ? await supabase.from("quote_approval_versions").select("id, quote_id, version, approval_source, approved_at").in("quote_id", quoteIds).order("version", { ascending: false })
    : { data: [] };
  const receivablesResult = quoteIds.length
    ? await supabase.from("receivable_installments").select("quote_id, amount, due_date, status").in("quote_id", quoteIds).in("status", ["pendente", "agendado"])
    : { data: [] };
  const versionsByQuote = new Map<string, Array<{ id: string; version: number; approval_source: string; approved_at: string }>>();
  for (const version of versionsResult.data ?? []) {
    const current = versionsByQuote.get(version.quote_id) ?? [];
    current.push(version);
    versionsByQuote.set(version.quote_id, current);
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const receivablesByQuote = new Map<string, { open: number; overdue: number; nextDue: string | null }>();
  for (const installment of receivablesResult.data ?? []) {
    const current = receivablesByQuote.get(installment.quote_id) ?? { open: 0, overdue: 0, nextDue: null };
    const amount = Number(installment.amount ?? 0);
    current.open += amount;
    if (installment.due_date < today) current.overdue += amount;
    if (!current.nextDue || installment.due_date < current.nextDue) current.nextDue = installment.due_date;
    receivablesByQuote.set(installment.quote_id, current);
  }

  return Response.json({ quotes: (data ?? []).map((quote) => ({
    id: quote.id,
    number: quote.number,
    customerId: quote.customer_id,
    customerName: quote.customer_name,
    company: quote.company,
    phone: quote.phone,
    email: quote.email,
    service: quote.service,
    dimensions: quote.dimensions,
    material: quote.material,
    details: quote.details,
    quantity: quote.quantity,
    status: quote.status,
    source: quote.source,
    createdAt: quote.created_at,
    updatedAt: quote.updated_at,
    estimatedValue: quote.estimated_value,
    subtotal: quote.subtotal,
    discount: quote.discount,
    validUntil: quote.valid_until,
    paymentTerms: quote.payment_terms,
    deliveryDays: quote.delivery_days,
    installationIncluded: quote.installation_included,
    freight: quote.freight,
    internalNotes: quote.internal_notes,
    approvalVersions: versionsByQuote.get(quote.id) ?? [],
    openBalance: receivablesByQuote.get(quote.id)?.open ?? 0,
    overdueBalance: receivablesByQuote.get(quote.id)?.overdue ?? 0,
    nextPaymentDue: receivablesByQuote.get(quote.id)?.nextDue ?? null,
    items: [...(quote.quote_items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  })) });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Acesso não autorizado" }, { status: 401 });
  const body = await request.json();
  const revalidation = quoteRevalidationSchema.safeParse(body);
  if (revalidation.success) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    if (revalidation.data.validUntil < today) return Response.json({ error: "A nova validade não pode estar no passado." }, { status: 400 });
    const { data: quote } = await supabase.from("quotes").select("status").eq("id", revalidation.data.id).maybeSingle();
    if (!quote) return Response.json({ error: "Orçamento não encontrado." }, { status: 404 });
    if (["convertido", "aprovado"].includes(quote.status)) return Response.json({ error: "Pedidos aprovados ou fechados não podem ser revalidados." }, { status: 409 });
    const { error } = await supabase.from("quotes").update({ valid_until: revalidation.data.validUntil, status: "em_analise", updated_at: new Date().toISOString() }).eq("id", revalidation.data.id);
    if (error) return Response.json({ error: "Não foi possível revalidar o orçamento." }, { status: 500 });
    return Response.json({ saved: true, validUntil: revalidation.data.validUntil, status: "em_analise" });
  }
  const parsed = quoteStatusSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Status inválido." }, { status: 400 });
  if (parsed.data.status === "aprovado") {
    const { count } = await supabase.from("quote_items").select("id", { count: "exact", head: true }).eq("quote_id", parsed.data.id).not("option_group", "is", null);
    if (count) return Response.json({ error: "Este orçamento possui alternativas. Envie o link para o cliente escolher ou edite os itens antes de aprovar manualmente." }, { status: 409 });
  }
  const { error } = await supabase.from("quotes").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) return Response.json({ error: "Não foi possível atualizar o orçamento." }, { status: 500 });
  return Response.json({ saved: true });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Acesso não autorizado" }, { status: 401 });
  const payload = quoteUpdateSchema.safeParse(await request.json());
  if (!payload.success) return Response.json({ error: quoteValidationMessage(payload.error), validationIssues: payload.error.issues }, { status: 400 });
  const body = payload.data;
  const itemSubtotal = selectableSubtotal(body.items);
  const estimatedValue = Math.max(0, itemSubtotal + body.freight - body.discount);
  const { data, error } = await supabase.rpc("update_quote_revision", {
    p_quote_id: body.id,
    p_quote: {
      customerId: body.customerId || null, customerName: body.customerName, company: body.company || null,
      phone: body.phone, email: body.email || null, service: body.service, dimensions: body.dimensions || null,
      material: body.material, details: body.details || null, quantity: body.quantity, source: body.source,
      subtotal: itemSubtotal, discount: body.discount, estimatedValue, validUntil: body.validUntil || null,
      paymentTerms: body.paymentTerms || null, deliveryDays: body.deliveryDays || null,
      installationIncluded: body.installationIncluded, freight: body.freight, internalNotes: body.internalNotes || null,
    },
    p_items: body.items,
  });
  if (error) return Response.json({ error: error.message.includes("fechado") ? error.message : "Não foi possível salvar a revisão. Aplique a nova migração no Supabase." }, { status: 500 });
  return Response.json({ quote: data });
}

export async function POST(request: Request) {
  try {
    const payload = quoteSchema.safeParse(await request.json());
    if (!payload.success) return Response.json({ error: quoteValidationMessage(payload.error), validationIssues: payload.error.issues }, { status: 400 });

    const body = payload.data;
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) {
      return Response.json({ error: "O portal público será habilitado depois que a empresa for identificada com segurança." }, { status: 503 });
    }
    const database = sessionClient;
    const itemSubtotal = selectableSubtotal(body.items);
    const subtotal = body.items.length ? itemSubtotal : 0;
    const estimatedValue = Math.max(0, subtotal + body.freight - body.discount);

    const { data, error } = await database.from("quotes").insert({
      customer_id: body.customerId || null,
      customer_name: body.customerName,
      company: body.company || null,
      phone: body.phone,
      email: body.email || null,
      service: body.service,
      dimensions: body.dimensions || null,
      material: body.material,
      details: body.details || null,
      quantity: body.quantity,
      source: body.source,
      subtotal,
      discount: body.discount,
      estimated_value: body.items.length ? estimatedValue : null,
      valid_until: body.validUntil || null,
      payment_terms: body.paymentTerms || null,
      delivery_days: body.deliveryDays || null,
      installation_included: body.installationIncluded,
      freight: body.freight,
      internal_notes: body.internalNotes || null,
      created_by: user.id,
    }).select("id, number, status, created_at").single();
    if (error) throw error;

    if (body.items.length) {
      const { error: itemError } = await database.from("quote_items").insert(body.items.map((item, index) => ({
        quote_id: data.id,
        description: item.description,
        service_type: item.serviceType || null,
        material: item.material || null,
        width_mm: item.widthMm || null,
        height_mm: item.heightMm || null,
        depth_mm: item.depthMm || null,
        quantity: item.quantity,
        unit: item.unit,
        unit_cost: item.unitCost,
        unit_price: item.unitPrice,
        production_notes: item.productionNotes || null,
        pricing_source: item.pricingSource,
        suggested_unit_price: item.suggestedUnitPrice,
        waste_percent: item.wastePercent,
        pricing_snapshot: item.pricingSnapshot,
        pricing_product_id: item.productId || null,
        option_group: item.optionGroup || null,
        selected_by_customer: null,
        sort_order: index,
      })));
      if (itemError) {
        await database.from("quotes").delete().eq("id", data.id);
        throw itemError;
      }
    }

    return Response.json({ quote: data }, { status: 201 });
  } catch (error) {
    console.error("Quote creation failed", error);
    return Response.json({ error: "Não foi possível salvar agora. Tente novamente." }, { status: 503 });
  }
}
