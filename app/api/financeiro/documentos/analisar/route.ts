import { createHash, randomUUID } from "node:crypto";
import { getManagementAccess } from "@/lib/management-auth";
import { parseFinancialPdf, parseFinancialXml } from "@/lib/financial-document-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-120);
}

export async function POST(request: Request) {
  const access = await getManagementAccess(["admin", "financeiro"]);
  if ("response" in access) return access.response;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Selecione um arquivo PDF ou XML." }, { status: 400 });
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) return Response.json({ error: "O arquivo deve ter no máximo 10 MB." }, { status: 400 });
  const extension = file.name.toLowerCase().split(".").pop();
  const isPdf = file.type === "application/pdf" || extension === "pdf";
  const isXml = ["application/xml", "text/xml"].includes(file.type) || extension === "xml";
  if (!isPdf && !isXml) return Response.json({ error: "Formato não aceito. Envie PDF ou XML." }, { status: 400 });

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    const duplicate = await access.supabase.from("financial_documents").select("id, original_name, created_at").eq("content_hash", contentHash).maybeSingle();
    if (duplicate.data) return Response.json({ error: `Este arquivo já foi importado como “${duplicate.data.original_name}”.` }, { status: 409 });
    const extracted = isPdf ? await parseFinancialPdf(bytes) : parseFinancialXml(bytes.toString("utf8"));
    const day = new Date().toISOString().slice(0, 10);
    const path = `${access.organizationId}/${access.user.id}/${day}/${randomUUID()}-${safeName(file.name)}`;
    const upload = await access.supabase.storage.from("financeiro-documentos").upload(path, bytes, { contentType: isPdf ? "application/pdf" : "application/xml", upsert: false });
    if (upload.error) return Response.json({ error: "Não foi possível guardar o documento. Aplique a nova migração financeira no Supabase." }, { status: 500 });
    const saved = await access.supabase.from("financial_documents").insert({
      original_name: file.name, storage_path: path, mime_type: isPdf ? "application/pdf" : "application/xml", size_bytes: file.size, content_hash: contentHash,
      document_kind: extracted.documentKind, extraction_status: extracted.needsOcr ? "precisa_ocr" : "processado",
      confidence: extracted.confidence, extracted_data: extracted, uploaded_by: access.user.id,
    }).select("id").single();
    if (saved.error) {
      await access.supabase.storage.from("financeiro-documentos").remove([path]);
      return Response.json({ error: "O documento foi lido, mas não pôde ser registrado. Aplique a nova migração financeira." }, { status: 500 });
    }
    return Response.json({ documentId: saved.data.id, fileName: file.name, extracted });
  } catch {
    return Response.json({ error: "Não foi possível interpretar este arquivo. Verifique se ele não está protegido ou corrompido." }, { status: 422 });
  }
}
