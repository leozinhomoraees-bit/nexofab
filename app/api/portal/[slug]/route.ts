import { createHash } from "node:crypto";
import { z } from "zod";
import { isValidPublicSlug } from "@/lib/public-portal";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

const MIN_FILL_MS = 1800;
const MAX_CLOCK_SKEW_MS = 60_000;

const publicLeadSchema = z.object({
  customerName: z.string().trim().min(2, "Informe seu nome (mínimo 2 caracteres).").max(120, "Nome muito longo."),
  company: z.string().trim().max(120, "Nome da empresa muito longo.").optional().default(""),
  phone: z
    .string()
    .trim()
    .min(8, "Informe um WhatsApp ou telefone válido.")
    .max(40, "Telefone muito longo.")
    .refine((value) => value.replace(/\D/g, "").length >= 8, "Informe um WhatsApp ou telefone com DDD."),
  email: z.union([z.string().trim().email("Informe um e-mail válido.").max(180), z.literal("")]).optional().default(""),
  service: z.string().trim().min(2, "Escolha o serviço ou projeto desejado.").max(120, "Serviço muito longo."),
  dimensions: z.string().trim().max(120, "Resumo das medidas muito longo.").optional().default(""),
  material: z.string().trim().max(160, "Material muito longo.").optional().default("A definir"),
  details: z.string().trim().max(1800, "Detalhes ultrapassam o limite de 1800 caracteres.").optional().default(""),
  quantity: z.coerce.number().int("Quantidade inválida.").min(1, "Quantidade mínima é 1.").max(1_000_000, "Quantidade acima do limite.").default(1),
  website: z.string().max(200).optional().default(""),
  formStartedAt: z.coerce.number().finite().optional(),
});

function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

function hashClientIp(slug: string, ip: string): string {
  return createHash("sha256").update(`nexofab-portal:${slug}:${ip}`).digest("hex");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const rawSlug = (await context.params).slug ?? "";
  const slug = rawSlug.trim().toLowerCase();
  if (!isValidPublicSlug(slug)) {
    return Response.json({ error: "Portal de orçamento indisponível." }, { status: 404 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "Formato de envio inválido." }, { status: 400 });
  }

  const parsed = publicLeadSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Revise os dados preenchidos e tente novamente.";
    return Response.json({ error: firstIssue }, { status: 400 });
  }

  const body = parsed.data;

  // Antispam camada 1: honeypot preenchido por robôs — descarta silenciosamente sem tocar no banco
  if (body.website.trim().length > 0) {
    return Response.json({ received: true, quoteNumber: null }, { status: 201 });
  }

  // Antispam camada 2: tempo mínimo de preenchimento humano
  const now = Date.now();
  if (
    typeof body.formStartedAt !== "number"
    || body.formStartedAt > now + MAX_CLOCK_SKEW_MS
    || now - body.formStartedAt < MIN_FILL_MS
  ) {
    return Response.json(
      { error: "Envio muito rápido. Revise os dados e tente novamente em alguns segundos." },
      { status: 429 },
    );
  }

  const clientIpHash = hashClientIp(slug, extractClientIp(request));

  const { data, error } = await createPublicClient().rpc("submit_public_quote_lead", {
    p_slug: slug,
    p_customer_name: body.customerName,
    p_phone: body.phone,
    p_service: body.service,
    p_company: body.company || null,
    p_email: body.email || null,
    p_dimensions: body.dimensions || null,
    p_material: body.material || "A definir",
    p_details: body.details || null,
    p_quantity: body.quantity,
    p_client_ip_hash: clientIpHash,
  });

  if (error) {
    const message = error.message || "";
    if (message.includes("Limite")) {
      return Response.json({ error: message }, { status: 429 });
    }
    if (message.includes("indisponível")) {
      return Response.json({ error: "Portal de orçamento indisponível no momento." }, { status: 404 });
    }
    if (
      message.includes("Informe")
      || message.includes("excede")
      || message.includes("Quantidade")
    ) {
      return Response.json({ error: message }, { status: 400 });
    }
    return Response.json({ error: "Não foi possível registrar seu pedido agora. Tente novamente." }, { status: 503 });
  }

  const result = data as {
    quoteNumber?: number;
    createdAt?: string;
    tradeName?: string;
    whatsapp?: string | null;
  } | null;

  return Response.json(
    {
      received: true,
      quoteNumber: result?.quoteNumber ?? null,
      createdAt: result?.createdAt ?? null,
      tradeName: result?.tradeName ?? null,
      whatsapp: result?.whatsapp ?? null,
    },
    { status: 201 },
  );
}
