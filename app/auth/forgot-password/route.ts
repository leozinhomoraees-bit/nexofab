import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const forgotSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").max(180),
});

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = forgotSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/redefinir-senha`,
  });

  if (error && error.status === 0) {
    return Response.json({ error: "Não foi possível conectar ao serviço de autenticação." }, { status: 503 });
  }
  if (error && error.status === 429) {
    return Response.json({ error: "Aguarde alguns minutos antes de solicitar um novo link." }, { status: 429 });
  }

  return Response.json({
    sent: true,
    message: "Se existir uma conta com este e-mail, enviamos um link para redefinir sua senha.",
  });
}
