"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Printer, X } from "lucide-react";

export function ProposalActions({ token, initialStatus, quoteNumber, selectedItemIds = [], choicesComplete = true }: { token: string; initialStatus: string; quoteNumber: number; selectedItemIds?: string[]; choicesComplete?: boolean }) {
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const answered = ["aprovado", "recusado", "convertido"].includes(status);

  async function respond(action: "aprovar" | "recusar") {
    if (action === "aprovar" && !choicesComplete) { setMessage("Selecione uma opção em cada grupo antes de aprovar."); return; }
    const label = action === "aprovar" ? "aprovar" : "recusar";
    if (!window.confirm(`Deseja realmente ${label} esta proposta?`)) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/proposta/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, selectedItemIds }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível registrar a resposta.");
      setStatus(payload.status);
      setMessage(action === "aprovar" ? "Proposta aprovada. A equipe já pode dar sequência ao atendimento." : "Resposta registrada. A equipe poderá preparar uma nova condição.");
    } catch (error) { setMessage((error as Error).message); }
    finally { setSaving(false); }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setMessage("Link copiado.");
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(`Proposta #${quoteNumber}: ${window.location.href}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  return <div className="proposal-actions no-print">
    <div className="proposal-share-actions"><button type="button" onClick={() => window.print()}><Printer/>Imprimir / salvar em PDF</button><button type="button" onClick={copyLink}><Copy/>Copiar link</button><button type="button" onClick={shareWhatsApp}><MessageCircle/>WhatsApp</button></div>
    <div className={`proposal-response status-${status}`}><div><small>RESPOSTA DO CLIENTE</small><b>{status === "aprovado" ? "Proposta aprovada" : status === "recusado" ? "Proposta recusada" : status === "convertido" ? "Pedido em produção" : choicesComplete ? "Tudo pronto para sua decisão" : "Escolha uma opção para continuar"}</b></div>{!answered && <div><button className="reject" type="button" disabled={saving} onClick={() => respond("recusar")}><X/>Recusar</button><button className="approve" type="button" disabled={saving || !choicesComplete} onClick={() => respond("aprovar")}><Check/>{choicesComplete ? "Aprovar proposta escolhida" : "Selecione as opções"}</button></div>}</div>
    {message && <p className="proposal-action-message">{message}</p>}
  </div>;
}
