import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const addressSchema = z.object({
  zip: optionalText(12),
  street: optionalText(160),
  number: optionalText(30),
  complement: optionalText(100),
  neighborhood: optionalText(100),
  city: optionalText(100),
  state: optionalText(2),
});

const optionalNumber = (min: number, max: number) => z.preprocess(
  (value) => value === "" || value === null || value === undefined ? null : value,
  z.coerce.number().min(min).max(max).nullable(),
);

const customerSchema = z.object({
  personType: z.enum(["pessoa", "empresa"]).default("empresa"),
  name: z.string().trim().min(2).max(160),
  companyName: optionalText(160),
  document: optionalText(24),
  phone: optionalText(40),
  whatsapp: optionalText(40),
  email: z.union([z.string().trim().email().max(180), z.literal("")]).optional().default(""),
  address: addressSchema.default({}),
  notes: optionalText(1500),
  billingCycle: z.enum(["imediato", "semanal", "mensal"]).default("imediato"),
  billingWeekday: optionalNumber(1, 6),
  billingDay: optionalNumber(1, 28),
  creditLimit: z.coerce.number().min(0).max(999999999999).default(0),
  billingNotes: optionalText(1000),
});

const updateSchema = customerSchema.extend({ id: z.string().uuid() });

export async function GET() {
  const access = await getManagementAccess();
  if ("response" in access) return access.response;

  const [{ data, error }, { data: quotes }] = await Promise.all([
    access.supabase
      .from("customers")
      .select("id, person_type, name, company_name, document, phone, whatsapp, email, address, notes, billing_cycle, billing_weekday, billing_day, credit_limit, billing_notes, active, created_at, updated_at")
      .eq("active", true)
      .order("name"),
    access.supabase.from("quotes").select("customer_id").not("customer_id", "is", null),
  ]);

  if (error) return Response.json({ error: "Não foi possível carregar os clientes." }, { status: 500 });
  const quoteCount = new Map<string, number>();
  for (const quote of quotes ?? []) {
    if (quote.customer_id) quoteCount.set(quote.customer_id, (quoteCount.get(quote.customer_id) ?? 0) + 1);
  }

  return Response.json({
    customers: (data ?? []).map((customer) => ({ ...customer, quote_count: quoteCount.get(customer.id) ?? 0 })),
  });
}

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "comercial"]);
  if ("response" in access) return access.response;
  const parsed = customerSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Confira os dados obrigatórios e o formato do e-mail." }, { status: 400 });
  const input = parsed.data;
  const { data, error } = await access.supabase.from("customers").insert({
    person_type: input.personType,
    name: input.name,
    company_name: input.companyName || null,
    document: input.document || null,
    phone: input.phone || null,
    whatsapp: input.whatsapp || input.phone || null,
    email: input.email || null,
    address: input.address,
    notes: input.notes || null,
    billing_cycle: input.billingCycle,
    billing_weekday: input.billingCycle === "semanal" ? input.billingWeekday : null,
    billing_day: input.billingCycle === "mensal" ? input.billingDay : null,
    credit_limit: input.creditLimit,
    billing_notes: input.billingNotes || null,
    created_by: access.user.id,
  }).select("id").single();
  if (error) return Response.json({ error: "Não foi possível cadastrar o cliente." }, { status: 500 });
  return Response.json({ saved: true, id: data.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await getManagementAccess(["admin", "comercial"]);
  if ("response" in access) return access.response;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Confira os dados obrigatórios e o formato do e-mail." }, { status: 400 });
  const input = parsed.data;
  const { error } = await access.supabase.from("customers").update({
    person_type: input.personType,
    name: input.name,
    company_name: input.companyName || null,
    document: input.document || null,
    phone: input.phone || null,
    whatsapp: input.whatsapp || input.phone || null,
    email: input.email || null,
    address: input.address,
    notes: input.notes || null,
    billing_cycle: input.billingCycle,
    billing_weekday: input.billingCycle === "semanal" ? input.billingWeekday : null,
    billing_day: input.billingCycle === "mensal" ? input.billingDay : null,
    credit_limit: input.creditLimit,
    billing_notes: input.billingNotes || null,
  }).eq("id", input.id);
  if (error) return Response.json({ error: "Não foi possível atualizar o cliente." }, { status: 500 });
  return Response.json({ saved: true });
}
