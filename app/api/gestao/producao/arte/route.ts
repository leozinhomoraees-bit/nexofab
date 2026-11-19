import { getManagementAccess } from "@/lib/management-auth";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "producao", "comercial"]);
  if ("response" in access) return access.response;
  const form = await request.formData();
  const orderId = String(form.get("orderId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const file = form.get("file");
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || title.length < 2 || title.length > 160 || !(file instanceof File)) return Response.json({ error: "Informe o título e selecione o print da arte." }, { status: 400 });
  if (!allowedTypes.has(file.type)) return Response.json({ error: "Envie PNG, JPG, WebP ou PDF." }, { status: 400 });
  if (file.size <= 0 || file.size > 12 * 1024 * 1024) return Response.json({ error: "O arquivo deve ter no máximo 12 MB." }, { status: 400 });
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || (file.type === "application/pdf" ? "pdf" : "png");
  const storagePath = `${access.organizationId}/${orderId}/${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const upload = await access.supabase.storage.from("artes-aprovacao").upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (upload.error) return Response.json({ error: upload.error.message.includes("Bucket") ? "Aplique a migração de upload de artes no Supabase." : "Não foi possível enviar o arquivo da arte." }, { status: 500 });
  const publicUrl = access.supabase.storage.from("artes-aprovacao").getPublicUrl(storagePath).data.publicUrl;
  const { data: latest } = await access.supabase.from("production_artwork_approvals").select("version").eq("production_order_id", orderId).order("version", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await access.supabase.from("production_artwork_approvals").insert({ production_order_id: orderId, version: Number(latest?.version ?? 0) + 1, title, file_url: publicUrl, storage_path: storagePath, content_type: file.type, created_by: access.user.id }).select("id, public_token, version").single();
  if (error) await access.supabase.storage.from("artes-aprovacao").remove([storagePath]);
  if (error) return Response.json({ error: ["42P01", "PGRST205"].includes(error.code) ? "Aplique a migração de aprovação de arte no Supabase." : "Não foi possível criar a aprovação de arte." }, { status: 500 });
  return Response.json({ approval: data }, { status: 201 });
}
