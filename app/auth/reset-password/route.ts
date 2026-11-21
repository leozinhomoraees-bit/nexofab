import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const resetSchema = z.object({
  password: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres.").max(200),
});

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = resetSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Informe uma senha válida." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json(
      { error: "Link de recuperação inválido ou expirado. Solicite um novo link." },
      { status: 401 },
    );
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return Response.json({ error: "Não foi possível atualizar a senha. Tente novamente." }, { status: 400 });
  }

  return Response.json({ updated: true });
}
