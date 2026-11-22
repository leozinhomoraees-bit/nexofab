import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";
import { createQuoteToken, hashQuoteToken } from "@/lib/quote-link";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getManagementAccess(["admin", "comercial", "financeiro"], { requireActiveSubscription: true });
    if ("response" in access) return access.response;
    const parsed = z.string().uuid().safeParse((await params).id);
    if (!parsed.success) return Response.json({ error: "Orçamento inválido." }, { status: 400 });
    const { data, error } = await access.supabase.from("quotes").select("id").eq("id", parsed.data).maybeSingle();
    if (error || !data) return Response.json({ error: "Orçamento não encontrado." }, { status: 404 });

    const token = createQuoteToken();
    const { error: shareError } = await access.supabase.from("proposal_shares").upsert({
      quote_id: data.id,
      token_hash: hashQuoteToken(token),
      created_by: access.user.id,
      revoked_at: null,
    }, { onConflict: "quote_id" });
    if (shareError) {
      console.error("Falha ao criar link público da proposta:", shareError.message);
      return Response.json({ error: "Não foi possível criar o link. Verifique se a atualização do banco foi aplicada." }, { status: 500 });
    }
    return Response.json({ url: `${new URL(request.url).origin}/proposta/${token}` });
  } catch (error) {
    console.error("Falha inesperada ao criar link público:", error);
    return Response.json({ error: "Não foi possível criar o link público." }, { status: 500 });
  }
}
