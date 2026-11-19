import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/i) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Entre na sua conta para aceitar o convite." }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Convite inválido." }, { status: 400 });

  const { data, error } = await supabase.rpc("accept_organization_invitation", { p_token: parsed.data.token });
  if (error || !data) {
    const message = error?.message.includes("mesmo e-mail") ? "Entre com o mesmo e-mail que recebeu o convite."
      : error?.message.includes("expirado") ? "Este convite expirou. Solicite um novo link."
      : "Este convite é inválido ou já foi utilizado.";
    return Response.json({ error: message }, { status: 400 });
  }
  return Response.json({ organizationId: data });
}
