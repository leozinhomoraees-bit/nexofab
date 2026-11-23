import { z } from "zod";
import { isQuoteToken } from "@/lib/quote-link";
import { createPublicClient } from "@/lib/supabase/public";

const responseSchema = z.object({ action: z.enum(["aprovar", "recusar"]), selectedItemIds: z.array(z.string().uuid()).max(100).optional().default([]) });

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  if (!isQuoteToken(token)) return Response.json({ error: "Link de proposta inválido." }, { status: 404 });
  const parsed = responseSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Resposta inválida." }, { status: 400 });
  const { data, error } = await createPublicClient().rpc("respond_public_proposal", {
    p_token: token,
    p_decision: parsed.data.action,
    p_selected_item_ids: parsed.data.selectedItemIds,
  });
  if (error) return Response.json({ error: error.message || "Não foi possível registrar sua resposta." }, { status: 409 });
  const result = data as { saved?: boolean; status?: string; error?: string } | null;
  if (!result?.saved || !result.status) return Response.json({ error: result?.error || "Não foi possível registrar sua resposta." }, { status: 409 });
  return Response.json(result);
}

export async function PATCH(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  if (!isQuoteToken(token)) return Response.json({ recorded: false }, { status: 404 });
  const { data, error } = await createPublicClient().rpc("record_public_proposal_view", { p_token: token });
  if (error) return Response.json({ recorded: false }, { status: 200 });
  return Response.json(data ?? { recorded: false });
}
