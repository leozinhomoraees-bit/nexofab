import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";

const responseSchema = z.object({ decision: z.enum(["aprovada", "ajustes"]), notes: z.string().trim().max(1000).optional().default("") });

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) return Response.json({ error: "Link inválido." }, { status: 404 });
  const { data, error } = await createPublicClient().rpc("get_public_artwork", { p_token: token });
  if (error || !data) return Response.json({ error: "Arte não encontrada." }, { status: 404 });
  return Response.json({ artwork: data });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = responseSchema.safeParse(await request.json());
  if (!/^[a-f0-9]{48}$/.test(token) || !parsed.success) return Response.json({ error: "Resposta inválida." }, { status: 400 });
  const { data, error } = await createPublicClient().rpc("respond_public_artwork", { p_token: token, p_decision: parsed.data.decision, p_notes: parsed.data.notes });
  const result = data as { saved?: boolean; status?: string; error?: string } | null;
  if (error || !result?.saved) return Response.json({ error: result?.error || "Não foi possível registrar a resposta." }, { status: 409 });
  return Response.json(result);
}
