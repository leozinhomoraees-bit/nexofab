import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

const companySchema = z.object({
  tradeName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(180).optional().default(""),
  document: z.string().trim().max(32).optional().default(""),
  stateRegistration: z.string().trim().max(40).optional().default(""),
  email: z.union([z.string().trim().email().max(180), z.literal("")]).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  whatsapp: z.string().trim().max(40).optional().default(""),
  website: z.string().trim().max(240).optional().default(""),
  addressStreet: z.string().trim().max(180).optional().default(""),
  addressNumber: z.string().trim().max(30).optional().default(""),
  addressComplement: z.string().trim().max(100).optional().default(""),
  addressDistrict: z.string().trim().max(100).optional().default(""),
  addressCity: z.string().trim().max(100).optional().default(""),
  addressState: z.string().trim().max(2).optional().default(""),
  addressZipCode: z.string().trim().max(20).optional().default(""),
  proposalFooter: z.string().trim().max(240).optional().default(""),
});

export async function GET() {
  const access = await getManagementAccess();
  if ("response" in access) return access.response;
  const { data, error } = await access.supabase.from("organizations").select("*").eq("id", access.organizationId).single();
  if (error) return Response.json({ error: "Não foi possível carregar os dados da empresa." }, { status: 500 });
  return Response.json({ company: data });
}

export async function PATCH(request: Request) {
  const access = await getManagementAccess(["admin"]);
  if ("response" in access) return access.response;
  const parsed = companySchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Revise os campos obrigatórios e o formato do e-mail." }, { status: 400 });
  const value = parsed.data;
  const { data, error } = await access.supabase.from("organizations").update({
    trade_name: value.tradeName, legal_name: value.legalName || null, document: value.document || null,
    state_registration: value.stateRegistration || null, email: value.email || null, phone: value.phone || null,
    whatsapp: value.whatsapp || null, website: value.website || null, address_street: value.addressStreet || null,
    address_number: value.addressNumber || null, address_complement: value.addressComplement || null,
    address_district: value.addressDistrict || null, address_city: value.addressCity || null,
    address_state: value.addressState.toUpperCase() || null, address_zip_code: value.addressZipCode || null,
    proposal_footer: value.proposalFooter || null,
  }).eq("id", access.organizationId).select("*").single();
  if (error) return Response.json({ error: "Não foi possível salvar os dados da empresa." }, { status: 500 });
  return Response.json({ company: data });
}

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin"]);
  if ("response" in access) return access.response;
  const form = await request.formData();
  const file = form.get("logo");
  if (!(file instanceof File) || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) return Response.json({ error: "Envie uma logo em PNG, JPG ou WebP." }, { status: 400 });
  if (file.size <= 0 || file.size > 3 * 1024 * 1024) return Response.json({ error: "A logo deve ter no máximo 3 MB." }, { status: 400 });
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const storagePath = `${access.organizationId}/logo-${Date.now()}.${extension}`;
  const upload = await access.supabase.storage.from("company-assets").upload(storagePath, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (upload.error) return Response.json({ error: upload.error.message.includes("Bucket") ? "Aplique a migração de identidade da empresa no Supabase." : "Não foi possível enviar a logo." }, { status: 500 });
  const logoUrl = access.supabase.storage.from("company-assets").getPublicUrl(storagePath).data.publicUrl;
  const { data: previous } = await access.supabase.from("organizations").select("logo_storage_path").eq("id", access.organizationId).single();
  const { data, error } = await access.supabase.from("organizations").update({ logo_url: logoUrl, logo_storage_path: storagePath }).eq("id", access.organizationId).select("*").single();
  if (error) { await access.supabase.storage.from("company-assets").remove([storagePath]); return Response.json({ error: "A logo foi enviada, mas não foi possível vinculá-la à empresa." }, { status: 500 }); }
  if (previous?.logo_storage_path) await access.supabase.storage.from("company-assets").remove([previous.logo_storage_path]);
  return Response.json({ company: data });
}
