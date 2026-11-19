"use client";

import { use, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";

type Artwork = { title: string; fileUrl: string; contentType?: string | null; version: number; status: string; customerNotes?: string | null; orderNumber: number; project: string; customer: string };

export default function ArtworkApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch(`/api/arte/${token}`, { cache: "no-store" }).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setArtwork(payload.artwork); }).catch((error: Error) => setMessage(error.message)).finally(() => setLoading(false)); }, [token]);
  async function respond(decision: "aprovada" | "ajustes") { setLoading(true); setMessage(""); try { const response = await fetch(`/api/arte/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, notes }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setArtwork((current) => current ? { ...current, status: payload.status, customerNotes: notes } : current); setMessage(decision === "aprovada" ? "Arte aprovada. A produção já pode seguir." : "Pedido de ajustes enviado para a equipe."); } catch (error) { setMessage((error as Error).message); } finally { setLoading(false); } }
  if (loading && !artwork) return <main className="artwork-public"><div className="artwork-card loading"><RefreshCw/><b>Carregando arte…</b></div></main>;
  if (!artwork) return <main className="artwork-public"><div className="artwork-card error"><AlertTriangle/><h1>Não foi possível abrir esta arte</h1><p>{message}</p></div></main>;
  const answered = artwork.status !== "aguardando";
  return <main className="artwork-public"><article className="artwork-card"><header><small>NEXOFAB · APROVAÇÃO DE ARTE</small><h1>{artwork.title}</h1><p>OS-{artwork.orderNumber} · {artwork.project} · versão {artwork.version}</p></header><section className="artwork-customer"><span>PREPARADA PARA</span><b>{artwork.customer}</b></section><section className="artwork-preview"><iframe src={artwork.fileUrl} title={`Arte para aprovação: ${artwork.title}`}/></section><a className="artwork-open" href={artwork.fileUrl} target="_blank" rel="noopener noreferrer"><ExternalLink/>Abrir arte em tamanho original</a><div className="artwork-warning"><AlertTriangle/><p>Confira textos, telefones, medidas, cores e posicionamento. A aprovação libera esta versão para produção.</p></div>{answered ? <section className={`artwork-result ${artwork.status}`}><CheckCircle2/><div><small>RESPOSTA REGISTRADA</small><h2>{artwork.status === "aprovada" ? "Arte aprovada" : "Ajustes solicitados"}</h2>{artwork.customerNotes && <p>{artwork.customerNotes}</p>}</div></section> : <section className="artwork-response"><label>Observação ou ajuste<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Se precisar alterar algo, descreva com clareza aqui."/></label><div><button type="button" className="adjust" onClick={() => void respond("ajustes")} disabled={loading}>Solicitar ajustes</button><button type="button" className="approve" onClick={() => void respond("aprovada")} disabled={loading}><CheckCircle2/>Aprovar esta arte</button></div></section>}{message && <p className="artwork-message">{message}</p>}<footer>Esta aprovação se refere somente à versão {artwork.version} exibida neste link.</footer></article></main>;
}
