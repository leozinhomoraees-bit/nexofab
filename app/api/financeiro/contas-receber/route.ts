import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("receive"), installmentId: z.string().uuid(), receivedOn: z.string().regex(datePattern), receivedAmount: z.coerce.number().positive(), interest: z.coerce.number().min(0).default(0), fine: z.coerce.number().min(0).default(0), discount: z.coerce.number().min(0).default(0), bankAccount: z.string().trim().max(120).optional(), paymentMethod: z.enum(["pix", "dinheiro", "cartao", "boleto", "transferencia", "outro"]), notes: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("schedule"), installmentId: z.string().uuid(), scheduledOn: z.string().regex(datePattern) }),
  z.object({ action: z.literal("reopen"), installmentId: z.string().uuid() }),
  z.object({ action: z.literal("cancel"), installmentId: z.string().uuid() }),
]);

function monthEnd(month: string) {
  const date = new Date(`${month}-01T12:00:00`); date.setMonth(date.getMonth() + 1); return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const access = await getManagementAccess(["admin", "financeiro"]);
  if ("response" in access) return access.response;
  const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!monthPattern.test(month)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  const { data, error } = await access.supabase.from("receivable_installments")
    .select("*, quotes!inner(id, number, customer_id, customer_name, company, phone, email, service, estimated_value, customers(id, name, company_name, document, phone, whatsapp, email, billing_cycle, billing_weekday, billing_day, credit_limit))")
    .gte("due_date", `${month}-01`).lt("due_date", monthEnd(month)).order("due_date").order("installment_number");
  if (error) return Response.json({ error: "Não foi possível carregar as contas a receber. Aplique a nova migração no Supabase." }, { status: 500 });
  return Response.json({ month, installments: data ?? [] });
}

export async function PATCH(request: Request) {
  const access = await getManagementAccess(["admin", "financeiro"]);
  if ("response" in access) return access.response;
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Ação inválida." }, { status: 400 });
  const input = parsed.data;
  if (input.action === "receive") {
    const { error } = await access.supabase.rpc("settle_receivable_installment", { p_installment_id: input.installmentId, p_received_on: input.receivedOn, p_received_amount: input.receivedAmount, p_interest: input.interest, p_fine: input.fine, p_discount: input.discount, p_bank_account: input.bankAccount ?? "", p_payment_method: input.paymentMethod, p_notes: input.notes ?? "" });
    if (error) return Response.json({ error: "Não foi possível registrar o recebimento." }, { status: 500 });
  } else if (input.action === "schedule") {
    const { error } = await access.supabase.from("receivable_installments").update({ status: "agendado", scheduled_on: input.scheduledOn }).eq("id", input.installmentId).in("status", ["pendente", "agendado"]);
    if (error) return Response.json({ error: "Não foi possível agendar a cobrança." }, { status: 500 });
  } else if (input.action === "reopen") {
    const { error } = await access.supabase.from("receivable_installments").update({ status: "pendente", scheduled_on: null }).eq("id", input.installmentId).eq("status", "agendado");
    if (error) return Response.json({ error: "Não foi possível remover o agendamento." }, { status: 500 });
  } else {
    const { error } = await access.supabase.from("receivable_installments").update({ status: "cancelado" }).eq("id", input.installmentId).in("status", ["pendente", "agendado"]);
    if (error) return Response.json({ error: "Não foi possível cancelar a parcela." }, { status: 500 });
  }
  return Response.json({ saved: true });
}
