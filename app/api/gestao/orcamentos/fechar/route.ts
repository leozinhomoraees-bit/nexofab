import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

const closeSchema = z.object({
  quoteId: z.string().uuid(),
  totalValue: z.coerce.number().positive().max(999999999999),
  deposit: z.coerce.number().min(0).max(999999999999),
  paymentMethod: z.enum(["pix", "dinheiro", "cartao", "boleto", "transferencia", "outro"]),
  receivedOn: z.string().date(),
  installments: z.array(z.object({
    installmentNumber: z.coerce.number().int().min(1).max(120),
    dueDate: z.string().date(),
    amount: z.coerce.number().positive(),
    paymentMethod: z.enum(["pix", "dinheiro", "cartao", "boleto", "transferencia", "outro"]),
    notes: z.string().trim().max(500).optional(),
  })).max(120),
}).refine((data) => data.deposit <= data.totalValue, { message: "A entrada não pode superar o valor total.", path: ["deposit"] });

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "comercial", "financeiro"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;
  const parsed = closeSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Confira os dados do fechamento." }, { status: 400 });

  const input = parsed.data;
  const scheduled = input.installments.reduce((sum, item) => sum + item.amount, 0);
  if (Math.abs(scheduled - (input.totalValue - input.deposit)) > 0.01) return Response.json({ error: "A soma das parcelas deve corresponder ao saldo do orçamento." }, { status: 400 });
  const { data, error } = await access.supabase.rpc("close_quote_with_receivables", {
    p_quote_id: input.quoteId,
    p_total_value: input.totalValue,
    p_deposit: input.deposit,
    p_deposit_method: input.paymentMethod,
    p_received_on: input.receivedOn,
    p_installments: input.installments.map((item) => ({ installment_number: item.installmentNumber, due_date: item.dueDate, amount: item.amount, payment_method: item.paymentMethod, notes: item.notes ?? "" })),
  });
  if (error) return Response.json({ error: error.message.includes("soma das parcelas") || error.message.includes("já possui") ? error.message : "Não foi possível fechar o orçamento. Aplique a nova migração financeira no Supabase." }, { status: 500 });
  return Response.json({ closed: data });
}
