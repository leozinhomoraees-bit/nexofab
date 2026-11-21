import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";

const supplierSchema = z.object({
  id: z.string().uuid().optional(),
  personType: z.enum(["pessoa", "empresa"]).default("empresa"),
  legalName: z.string().trim().min(2).max(180),
  tradeName: z.string().trim().max(180).optional(),
  document: z.string().trim().max(30).optional(),
  stateRegistration: z.string().trim().max(30).optional(),
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  whatsapp: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(180).or(z.literal("")).optional(),
  postalCode: z.string().trim().max(12).optional(),
  street: z.string().trim().max(180).optional(),
  addressNumber: z.string().trim().max(30).optional(),
  addressComplement: z.string().trim().max(100).optional(),
  district: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(2).optional(),
  defaultPaymentTerms: z.string().trim().max(180).optional(),
  notes: z.string().trim().max(2000).optional(),
  active: z.boolean().default(true),
});

const row = (input: z.infer<typeof supplierSchema>, userId: string) => ({
  person_type: input.personType,
  legal_name: input.legalName,
  trade_name: input.tradeName || null,
  document: input.document || null,
  state_registration: input.stateRegistration || null,
  contact_name: input.contactName || null,
  phone: input.phone || null,
  whatsapp: input.whatsapp || null,
  email: input.email || null,
  postal_code: input.postalCode || null,
  street: input.street || null,
  address_number: input.addressNumber || null,
  address_complement: input.addressComplement || null,
  district: input.district || null,
  city: input.city || null,
  state: input.state?.toUpperCase() || null,
  default_payment_terms: input.defaultPaymentTerms || null,
  notes: input.notes || null,
  active: input.active,
  created_by: userId,
});

export async function GET() {
  const access = await getManagementAccess(["admin", "financeiro"]);
  if ("response" in access) return access.response;
  const { data, error } = await access.supabase.from("suppliers").select("*").order("active", { ascending: false }).order("legal_name");
  if (error) return Response.json({ error: "Não foi possível carregar os fornecedores. Aplique a migração financeira no Supabase." }, { status: 500 });
  return Response.json({ suppliers: data ?? [] });
}

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "financeiro"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;
  const parsed = supplierSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Confira os dados do fornecedor." }, { status: 400 });
  const { data, error } = await access.supabase.from("suppliers").insert(row(parsed.data, access.user.id)).select("*").single();
  if (error) return Response.json({ error: error.code === "23505" ? "Já existe um fornecedor com este CPF/CNPJ." : "Não foi possível cadastrar o fornecedor." }, { status: 500 });
  return Response.json({ supplier: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await getManagementAccess(["admin", "financeiro"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;
  const parsed = supplierSchema.required({ id: true }).safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Confira os dados do fornecedor." }, { status: 400 });
  const payload = row(parsed.data, access.user.id);
  delete (payload as Partial<typeof payload>).created_by;
  const { data, error } = await access.supabase.from("suppliers").update(payload).eq("id", parsed.data.id).select("*").single();
  if (error) return Response.json({ error: error.code === "23505" ? "Já existe um fornecedor com este CPF/CNPJ." : "Não foi possível atualizar o fornecedor." }, { status: 500 });
  return Response.json({ supplier: data });
}
