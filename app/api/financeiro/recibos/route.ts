import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";
const schema = z.object({ paymentId: z.string().uuid() });

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "financeiro"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Pagamento inválido." }, { status: 400 });

  const { data: payment } = await access.supabase.from("quote_payments").select("id").eq("id", parsed.data.paymentId).maybeSingle();
  if (!payment) return Response.json({ error: "Pagamento não encontrado." }, { status: 404 });

  const { data: existing } = await access.supabase.from("payment_receipts").select("public_token").eq("payment_id", payment.id).maybeSingle();
  if (existing?.public_token) return Response.json({ token: existing.public_token, path: `/recibo/${existing.public_token}` });

  const { data, error } = await access.supabase.from("payment_receipts").insert({ payment_id: payment.id, issued_by: access.user.id }).select("public_token").single();
  if (error || !data) return Response.json({ error: "Não foi possível emitir o recibo. Aplique a nova migração do Supabase." }, { status: 500 });
  return Response.json({ token: data.public_token, path: `/recibo/${data.public_token}` }, { status: 201 });
}
