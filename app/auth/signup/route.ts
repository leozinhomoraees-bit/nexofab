import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo.").max(120),
  email: z.string().trim().email("Informe um e-mail válido.").max(180),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(200),
  next: z.string().optional(),
});

function sanitizeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/onboarding";
  }
  return value;
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(rawBody);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Revise os dados informados." },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;
  const nextPath = sanitizeNextPath(parsed.data.next);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (error) {
    if (error.status === 0) {
      return Response.json({ error: "Não foi possível conectar ao serviço de autenticação." }, { status: 503 });
    }
    if (error.status === 429) {
      return Response.json({ error: "Muitas tentativas em sequência. Aguarde alguns minutos e tente novamente." }, { status: 429 });
    }
    // Resposta segura sem expor detalhes internos nem enumerar e-mails já cadastrados.
    return Response.json({
      created: true,
      needsEmailConfirmation: true,
      nextPath,
    });
  }

  return Response.json(
    {
      created: true,
      needsEmailConfirmation: !data.session,
      nextPath,
    },
    { status: 201 },
  );
}
