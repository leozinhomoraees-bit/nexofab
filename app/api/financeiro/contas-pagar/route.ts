import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const installmentSchema = z.object({
  installmentNumber: z.coerce.number().int().min(1).max(120),
  dueDate: z.string().regex(datePattern),
  amount: z.coerce.number().positive().max(999999999999),
  paymentMethod: z.enum(["boleto", "pix", "transferencia", "cartao", "debito_automatico", "dinheiro", "outro"]),
  digitableLine: z.string().trim().max(180).optional(),
  pixCode: z.string().trim().max(1000).optional(),
  documentUrl: z.string().trim().url().max(2000).or(z.literal("")).optional(),
});
const payableSchema = z.object({
  supplierId: z.string().uuid().or(z.literal("")),
  expenseCategoryId: z.string().uuid(),
  costCenterId: z.string().uuid(),
  description: z.string().trim().min(3).max(240),
  documentType: z.enum(["boleto", "nota_fiscal", "fatura", "recibo", "contrato", "imposto", "folha", "outro"]),
  documentNumber: z.string().trim().max(80).optional(),
  purchaseOrder: z.string().trim().max(80).optional(),
  issueDate: z.string().regex(datePattern),
  competenceDate: z.string().regex(datePattern),
  totalAmount: z.coerce.number().positive().max(999999999999),
  recurring: z.boolean().default(false),
  recurrenceFrequency: z.enum(["semanal", "quinzenal", "mensal", "bimestral", "trimestral", "semestral", "anual"]).optional(),
  recurrenceEndDate: z.string().regex(datePattern).or(z.literal("")).optional(),
  notes: z.string().trim().max(3000).optional(),
  financialDocumentId: z.string().uuid().optional(),
  installments: z.array(installmentSchema).min(1).max(120),
}).superRefine((data, context) => {
  const sum = data.installments.reduce((total, item) => total + item.amount, 0);
  if (Math.abs(sum - data.totalAmount) > 0.01) context.addIssue({ code: "custom", message: "A soma das parcelas precisa corresponder ao valor total.", path: ["installments"] });
  if (data.recurring && !data.recurrenceFrequency) context.addIssue({ code: "custom", message: "Escolha a frequência da recorrência.", path: ["recurrenceFrequency"] });
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pay"), installmentId: z.string().uuid(), paidOn: z.string().regex(datePattern), paidAmount: z.coerce.number().min(0), interest: z.coerce.number().min(0).default(0), fine: z.coerce.number().min(0).default(0), discount: z.coerce.number().min(0).default(0), bankAccount: z.string().trim().max(120).optional(), receiptUrl: z.string().trim().url().max(2000).or(z.literal("")).optional(), notes: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("schedule"), installmentId: z.string().uuid(), scheduledOn: z.string().regex(datePattern) }),
  z.object({ action: z.literal("reopen"), installmentId: z.string().uuid() }),
  z.object({ action: z.literal("cancel"), payableId: z.string().uuid() }),
]);

function monthEnd(month: string) {
  const date = new Date(`${month}-01T12:00:00`);
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const access = await getManagementAccess(["admin", "financeiro"]);
  if ("response" in access) return access.response;
  const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!monthPattern.test(month)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  const start = `${month}-01`, end = monthEnd(month);
  const [installments, suppliers, categories, centers] = await Promise.all([
    access.supabase.from("payable_installments").select("*, payables!inner(id, description, document_type, document_number, purchase_order, issue_date, competence_date, total_amount, installment_count, recurring, recurrence_frequency, notes, status, supplier_id, expense_category_id, cost_center_id, suppliers(id, legal_name, trade_name, document), expense_categories(id, name, classification, color), cost_centers(id, name, code))").gte("due_date", start).lt("due_date", end).order("due_date").order("installment_number"),
    access.supabase.from("suppliers").select("id, legal_name, trade_name, document, default_payment_terms, active").eq("active", true).order("legal_name"),
    access.supabase.from("expense_categories").select("id, name, classification, color").eq("active", true).order("name"),
    access.supabase.from("cost_centers").select("id, name, code").eq("active", true).order("name"),
  ]);
  const error = installments.error || suppliers.error || categories.error || centers.error;
  if (error) return Response.json({ error: "Não foi possível carregar as contas a pagar. Aplique a migração financeira no Supabase." }, { status: 500 });
  return Response.json({ month, installments: installments.data ?? [], suppliers: suppliers.data ?? [], categories: categories.data ?? [], costCenters: centers.data ?? [] });
}

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "financeiro"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;
  const parsed = payableSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Confira os dados da conta." }, { status: 400 });
  const input = parsed.data;
  const { data, error } = await access.supabase.rpc("create_payable_with_installments", {
    p_payable: {
      supplier_id: input.supplierId, expense_category_id: input.expenseCategoryId, cost_center_id: input.costCenterId,
      description: input.description, document_type: input.documentType, document_number: input.documentNumber ?? "", purchase_order: input.purchaseOrder ?? "",
      issue_date: input.issueDate, competence_date: input.competenceDate, total_amount: input.totalAmount, recurring: input.recurring,
      recurrence_frequency: input.recurrenceFrequency ?? "", recurrence_end_date: input.recurrenceEndDate ?? "", notes: input.notes ?? "",
    },
    p_installments: input.installments.map((item) => ({ installment_number: item.installmentNumber, due_date: item.dueDate, amount: item.amount, payment_method: item.paymentMethod, digitable_line: item.digitableLine ?? "", pix_code: item.pixCode ?? "", document_url: item.documentUrl ?? "" })),
  });
  if (error) return Response.json({ error: error.message.includes("soma das parcelas") ? error.message : "Não foi possível cadastrar a conta a pagar." }, { status: 500 });
  if (input.financialDocumentId) {
    const linked = await access.supabase.from("financial_documents").update({ payable_id: data, extraction_status: "revisado" }).eq("id", input.financialDocumentId).is("payable_id", null);
    if (linked.error) return Response.json({ error: "A conta foi criada, mas o documento não pôde ser vinculado." }, { status: 500 });
  }
  return Response.json({ saved: true, payableId: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await getManagementAccess(["admin", "financeiro"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Ação financeira inválida." }, { status: 400 });
  const input = parsed.data;
  if (input.action === "pay") {
    const { error } = await access.supabase.rpc("settle_payable_installment", { p_installment_id: input.installmentId, p_paid_on: input.paidOn, p_paid_amount: input.paidAmount, p_interest: input.interest, p_fine: input.fine, p_discount: input.discount, p_bank_account: input.bankAccount ?? "", p_receipt_url: input.receiptUrl ?? "", p_notes: input.notes ?? "" });
    if (error) return Response.json({ error: "Não foi possível registrar o pagamento." }, { status: 500 });
  } else if (input.action === "schedule") {
    const { error } = await access.supabase.from("payable_installments").update({ status: "agendado", scheduled_on: input.scheduledOn }).eq("id", input.installmentId).in("status", ["pendente", "agendado"]);
    if (error) return Response.json({ error: "Não foi possível agendar a parcela." }, { status: 500 });
  } else if (input.action === "reopen") {
    const { error } = await access.supabase.from("payable_installments").update({ status: "pendente", scheduled_on: null }).eq("id", input.installmentId).eq("status", "agendado");
    if (error) return Response.json({ error: "Não foi possível remover o agendamento." }, { status: 500 });
  } else {
    const { error } = await access.supabase.rpc("cancel_payable", { p_payable_id: input.payableId });
    if (error) return Response.json({ error: error.message.includes("parcela paga") ? error.message : "Não foi possível cancelar a conta." }, { status: 500 });
  }
  return Response.json({ saved: true });
}
