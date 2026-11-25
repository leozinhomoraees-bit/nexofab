"use client";
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Eye, EyeOff, ImagePlus, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type QuoteAttachment = {
  id: string;
  quote_id: string;
  caption?: string | null;
  file_url: string;
  content_type: string;
  show_on_proposal: boolean;
  sort_order: number;
  created_at: string;
};

export function QuotePhotosGallery({
  quoteId,
  initialAttachments,
  mode = "quote",
  onChanged,
}: {
  quoteId: string;
  initialAttachments?: QuoteAttachment[];
  mode?: "quote" | "os";
  onChanged?: () => void;
}) {
  const [attachments, setAttachments] = useState<QuoteAttachment[]>(initialAttachments ?? []);
  const [loading, setLoading] = useState(initialAttachments === undefined);
  const [setupRequired, setSetupRequired] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [showOnProposal, setShowOnProposal] = useState(true);
  const [feedback, setFeedback] = useState("");

  const fetchPhotos = useCallback(async () => {
    const response = await fetch(`/api/gestao/orcamentos/fotos?quoteId=${encodeURIComponent(quoteId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Não foi possível carregar as fotos.");
    return {
      attachments: (payload.attachments ?? []) as QuoteAttachment[],
      setupRequired: Boolean(payload.setupRequired),
    };
  }, [quoteId]);

  useEffect(() => {
    if (initialAttachments !== undefined) return;
    let active = true;
    fetchPhotos()
      .then((res) => {
        if (!active) return;
        setAttachments(res.attachments);
        setSetupRequired(res.setupRequired);
      })
      .catch((error: unknown) => {
        if (active) setFeedback(error instanceof Error ? error.message : "Não foi possível carregar as fotos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [fetchPhotos, initialAttachments]);

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      setFeedback("Selecione uma imagem PNG, JPG ou WebP.");
      return;
    }
    formData.set("quoteId", quoteId);
    formData.set("caption", caption.trim());
    formData.set("showOnProposal", showOnProposal ? "true" : "false");
    setUploading(true);
    setFeedback("");
    try {
      const response = await fetch("/api/gestao/orcamentos/fotos", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível enviar a foto.");
      setAttachments((current) => [...current, payload.attachment as QuoteAttachment]);
      setCaption("");
      formElement.reset();
      setFeedback("OK:Foto anexada com sucesso.");
      onChanged?.();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  async function toggleVisibility(photo: QuoteAttachment) {
    setBusyId(photo.id);
    setFeedback("");
    try {
      const response = await fetch("/api/gestao/orcamentos/fotos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: photo.id, showOnProposal: !photo.show_on_proposal }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível atualizar a visibilidade.");
      setAttachments((current) => current.map((item) => item.id === photo.id ? payload.attachment as QuoteAttachment : item));
      onChanged?.();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar a foto.");
    } finally {
      setBusyId(null);
    }
  }

  async function removePhoto(photo: QuoteAttachment) {
    if (!window.confirm("Remover esta foto de referência?")) return;
    setBusyId(photo.id);
    setFeedback("");
    try {
      const response = await fetch("/api/gestao/orcamentos/fotos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: photo.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível excluir a foto.");
      setAttachments((current) => current.filter((item) => item.id !== photo.id));
      setFeedback("OK:Foto removida.");
      onChanged?.();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível excluir a foto.");
    } finally {
      setBusyId(null);
    }
  }

  if (mode === "os" && !attachments.length && !loading) {
    return null;
  }

  const isSuccess = feedback.startsWith("OK:");

  return (
    <section className={`quote-photos-section ${mode === "os" ? "in-os" : ""}`}>
      <header>
        <div>
          <small>{mode === "os" ? "REFERÊNCIAS VISUAIS DO PROJETO" : "FOTOS DE REFERÊNCIA E MOCKUPS"}</small>
          <h3>{mode === "os" ? "Fotos e mockups do orçamento" : "Galeria visual da proposta e produção"}</h3>
        </div>
        <span>{attachments.length} foto(s)</span>
      </header>

      {setupRequired && (
        <div className="module-feedback">
          <AlertTriangle />
          Execute a migration <code>202611250003_quote_reference_photos.sql</code> no Supabase para ativar o envio de fotos de referência.
        </div>
      )}

      {feedback && (
        <div className={`module-feedback ${isSuccess ? "success" : ""}`}>
          {isSuccess ? <Check /> : <AlertTriangle />}
          {feedback.replace(/^OK:/, "")}
        </div>
      )}

      {loading ? (
        <p className="detail-empty">Carregando fotos…</p>
      ) : attachments.length > 0 ? (
        <div className="quote-photos-grid">
          {attachments.map((photo) => (
            <figure key={photo.id} className="quote-photo-card">
              <a href={photo.file_url} target="_blank" rel="noopener noreferrer" className="quote-photo-thumb" title="Abrir imagem em tamanho original">
                <img src={photo.file_url} alt={photo.caption || "Foto de referência"} loading="lazy" />
              </a>
              <figcaption>
                <b>{photo.caption || "Referência visual"}</b>
                <div className="quote-photo-actions no-print">
                  {mode === "quote" && (
                    <button
                      type="button"
                      className={`quote-photo-vis ${photo.show_on_proposal ? "public" : "internal"}`}
                      disabled={busyId === photo.id}
                      onClick={() => void toggleVisibility(photo)}
                      title={photo.show_on_proposal ? "Visível na proposta pública — clique para deixar só interno" : "Oculta na proposta (só produção) — clique para mostrar ao cliente"}
                    >
                      {photo.show_on_proposal ? <><Eye /> Na proposta</> : <><EyeOff /> Só interno</>}
                    </button>
                  )}
                  <a href={photo.file_url} target="_blank" rel="noopener noreferrer" title="Abrir em nova aba">
                    <ExternalLink />
                  </a>
                  {mode === "quote" && (
                    <button
                      type="button"
                      className="danger"
                      disabled={busyId === photo.id}
                      onClick={() => void removePhoto(photo)}
                      aria-label="Excluir foto"
                    >
                      <Trash2 />
                    </button>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="detail-empty">Nenhuma foto anexada ainda. Envie fotos da fachada, local de instalação ou mockup para valorizar a proposta e orientar a produção.</p>
      )}

      {mode === "quote" && !setupRequired && attachments.length < 10 && (
        <form className="quote-photo-upload no-print" onSubmit={uploadPhoto}>
          <label>
            <ImagePlus /> Imagem (PNG, JPG ou WebP · até 10 MB)
            <Input name="file" type="file" accept="image/png,image/jpeg,image/webp" required />
          </label>
          <label>
            Legenda (opcional)
            <Input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Ex.: Mockup aprovado, foto da fachada..." maxLength={160} />
          </label>
          <label className="quote-photo-check">
            <input type="checkbox" checked={showOnProposal} onChange={(event) => setShowOnProposal(event.target.checked)} />
            Exibir na proposta pública para o cliente
          </label>
          <Button type="submit" size="sm" disabled={uploading}>
            <UploadCloud />
            {uploading ? "Enviando..." : "Anexar foto"}
          </Button>
        </form>
      )}
    </section>
  );
}
