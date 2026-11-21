import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

const quickSaleSchema = z.object({
  customerId: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
  customerName: z.string().trim().max(120).optional().default("Consumidor final"),
  phone: z.string().trim().max(40).optional().default(""),
  paymentStatus: z.enum(["recebido", "pendente"]),
  paymentMethod: z.enum(["pix", "dinheiro", "cartao", "boleto", "transferencia", "outro"]),
  saleDate: z.string().date(),
  dueDate: z.union([z.string().date(), z.literal("")]).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  items: z.array(z.object({
    description: z.string().trim().min(2).max(240),
    quantity: z.coerce.number().positive().max(100000),
    unit: z.string().trim().min(1).max(20),
    unitCost: z.coerce.number().min(0).max(99999999),
    unitPrice: z.coerce.number().positive().max(99999999),
    inventoryItemId: z.union([z.string().uuid(), z.literal("")]).optional().default(""),
    materialName: z.string().trim().max(160).optional().default(""),
    stockQuantity: z.coerce.number().min(0).max(999999999).optional().default(0),
    notes: z.string().trim().max(500).optional().default(""),
  })).min(1).max(20),
}).refine((data) => data.paymentStatus === "recebido" || Boolean(data.dueDate), { message: "Informe o vencimento da venda a receber.", path: ["dueDate"] });

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "comercial", "financeiro"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;
  const parsed = quickSaleSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Confira os dados da venda rápida." }, { status: 400 });
  const input = parsed.data;
  const { data, error } = await access.supabase.rpc("register_quick_sale", {
    p_customer_id: input.customerId || null,
    p_customer_name: input.customerName || "Consumidor final",
    p_phone: input.phone || "",
    p_items: input.items,
    p_payment_status: input.paymentStatus,
    p_payment_method: input.paymentMethod,
    p_sale_date: input.saleDate,
    p_due_date: input.dueDate || null,
    p_notes: input.notes || "",
  });
  if (error) {
    const known = ["Saldo insuficiente", "Confira descrição", "Informe o vencimento", "Insumo de estoque"];
    const message = known.some((entry) => error.message.includes(entry)) ? error.message : "Não foi possível registrar a venda rápida. Aplique a migração de vendas rápidas no Supabase.";
    return Response.json({ error: message }, { status: 500 });
  }
  return Response.json({ sale: data }, { status: 201 });
}
