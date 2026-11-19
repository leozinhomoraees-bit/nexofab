import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(6).max(200),
});

export async function POST(request: Request) {
  const acceptsJson = request.headers.get("content-type")?.includes("application/json") ?? false;
  const body = acceptsJson
    ? await request.json()
    : Object.fromEntries(await request.formData());
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Informe um e-mail e uma senha válidos." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.status === 0) {
      return Response.json({ error: "Não foi possível conectar ao serviço de autenticação." }, { status: 503 });
    }
    return Response.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  if (!acceptsJson) {
    return Response.redirect(new URL("/gestao", request.url), 303);
  }

  return Response.json({ authenticated: true });
}
