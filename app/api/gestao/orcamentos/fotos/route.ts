import { z } from "zod";
import { getManagementAccess } from "@/lib/management-auth";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PHOTOS_PER_QUOTE = 10;
const MAX_BYTES = 10 * 1024 * 1024;

const patchSchema = z.object({
  id: z.string().uuid(),
  caption: z.string().trim().max(160).optional(),
  showOnProposal: z.boolean().optional(),
}).refine((val) => val.caption !== undefined || val.showOnProposal !== undefined, { message: "Nenhuma alteração informada." });

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(request: Request) {
  const access = await getManagementAccess();
  if ("response" in access) return access.response;
  const quoteId = new URL(request.url).searchParams.get("quoteId")?.trim() ?? "";
  if (!UUID_RE.test(quoteId)) return Response.json({ error: "Orçamento inválido." }, { status: 400 });

  const { data, error } = await access.supabase
    .from("quote_attachments")
    .select("id, quote_id, caption, file_url, content_type, show_on_proposal, sort_order, created_at")
    .eq("quote_id", quoteId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error && ["42P01", "PGRST205"].includes(error.code)) {
    return Response.json({ attachments: [], setupRequired: true });
  }
  if (error) return Response.json({ error: "Não foi possível carregar as fotos de referência." }, { status: 500 });
  return Response.json({ attachments: data ?? [], setupRequired: false });
}

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "comercial", "producao"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;

  const form = await request.formData();
  const quoteId = String(form.get("quoteId") ?? "").trim();
  const caption = String(form.get("caption") ?? "").trim().slice(0, 160);
  const showOnProposal = String(form.get("showOnProposal") ?? "true") !== "false";
  const file = form.get("file");

  if (!UUID_RE.test(quoteId) || !(file instanceof File)) {
    return Response.json({ error: "Selecione uma imagem válida para anexar ao orçamento." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json({ error: "Envie imagens em formato PNG, JPG ou WebP." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return Response.json({ error: "A imagem deve ter no máximo 10 MB." }, { status: 400 });
  }

  const { data: quote } = await access.supabase.from("quotes").select("id").eq("id", quoteId).maybeSingle();
  if (!quote) return Response.json({ error: "Orçamento não encontrado." }, { status: 404 });

  const { count, error: countError } = await access.supabase
    .from("quote_attachments")
    .select("id", { count: "exact", head: true })
    .eq("quote_id", quoteId);
  if (countError && ["42P01", "PGRST205"].includes(countError.code)) {
    return Response.json({ error: "Execute a migration 202611250003_quote_reference_photos.sql no Supabase para ativar fotos de referência." }, { status: 400 });
  }
  if ((count ?? 0) >= MAX_PHOTOS_PER_QUOTE) {
    return Response.json({ error: `Limite de ${MAX_PHOTOS_PER_QUOTE} fotos por orçamento atingido.` }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || (file.type === "image/webp" ? "webp" : file.type === "image/jpeg" ? "jpg" : "png");
  const storagePath = `${access.organizationId}/referencias/${quoteId}/${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const upload = await access.supabase.storage.from("artes-aprovacao").upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (upload.error) {
    return Response.json({ error: "Não foi possível enviar a imagem para o armazenamento." }, { status: 500 });
  }

  const publicUrl = access.supabase.storage.from("artes-aprovacao").getPublicUrl(storagePath).data.publicUrl;
  const { data, error } = await access.supabase
    .from("quote_attachments")
    .insert({
      quote_id: quoteId,
      caption: caption || null,
      file_url: publicUrl,
      storage_path: storagePath,
      content_type: file.type,
      show_on_proposal: showOnProposal,
      sort_order: count ?? 0,
      created_by: access.user.id,
    })
    .select("id, quote_id, caption, file_url, content_type, show_on_proposal, sort_order, created_at")
    .single();

  if (error || !data) {
    await access.supabase.storage.from("artes-aprovacao").remove([storagePath]);
    return Response.json({ error: "Não foi possível registrar a foto de referência." }, { status: 500 });
  }
  return Response.json({ attachment: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await getManagementAccess(["admin", "comercial", "producao"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });

  const changes: Record<string, string | boolean | null> = {};
  if (parsed.data.caption !== undefined) changes.caption = parsed.data.caption || null;
  if (parsed.data.showOnProposal !== undefined) changes.show_on_proposal = parsed.data.showOnProposal;

  const { data, error } = await access.supabase
    .from("quote_attachments")
    .update(changes)
    .eq("id", parsed.data.id)
    .select("id, quote_id, caption, file_url, content_type, show_on_proposal, sort_order, created_at")
    .single();

  if (error || !data) return Response.json({ error: "Não foi possível atualizar a foto." }, { status: 500 });
  return Response.json({ attachment: data });
}

export async function DELETE(request: Request) {
  const access = await getManagementAccess(["admin", "comercial", "producao"], { requireActiveSubscription: true });
  if ("response" in access) return access.response;

  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Foto inválida." }, { status: 400 });

  const { data: existing } = await access.supabase
    .from("quote_attachments")
    .select("id, storage_path")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (!existing) return Response.json({ error: "Foto não encontrada." }, { status: 404 });

  const { error } = await access.supabase.from("quote_attachments").delete().eq("id", existing.id);
  if (error) return Response.json({ error: "Não foi possível excluir a foto." }, { status: 500 });

  if (existing.storage_path) {
    await access.supabase.storage.from("artes-aprovacao").remove([existing.storage_path]);
  }
  return Response.json({ deleted: true });
}
