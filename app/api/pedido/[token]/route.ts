import { createPublicClient } from "@/lib/supabase/public";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const normalized = token.trim().toLowerCase();
  if (!/^[a-f0-9]{48}$/.test(normalized)) {
    return Response.json({ error: "Link de acompanhamento inválido." }, { status: 404 });
  }
  const { data, error } = await createPublicClient().rpc("get_public_order_tracking", { p_token: normalized });
  if (error || !data) {
    return Response.json({ error: "Pedido não encontrado ou link expirado." }, { status: 404 });
  }
  return Response.json({ order: data });
}
