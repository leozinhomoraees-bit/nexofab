import type { Metadata } from "next";
/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { isQuoteToken } from "@/lib/quote-link";
import { createPublicClient } from "@/lib/supabase/public";
import { ProposalConfigurator, type ProposalItem } from "./proposal-configurator";
import "./proposal.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const date = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "A definir";

type PublicProposal = {
  id: string;
  number: number;
  customer_name: string;
  company?: string | null;
  service: string;
  details?: string | null;
  status: string;
  subtotal: number;
  discount: number;
  estimated_value: number;
  valid_until?: string | null;
  payment_terms?: string | null;
  delivery_days?: number | null;
  installation_included?: boolean | null;
  freight?: number | null;
  created_at: string;
  items?: ProposalItem[];
  attachments?: Array<{ id: string; caption?: string | null; file_url: string; sort_order: number }>;
  issuer?: {
    trade_name?: string | null; legal_name?: string | null; document?: string | null; state_registration?: string | null;
    email?: string | null; phone?: string | null; whatsapp?: string | null; website?: string | null; logo_url?: string | null;
    proposal_footer?: string | null; address_street?: string | null; address_number?: string | null;
    address_complement?: string | null; address_district?: string | null; address_city?: string | null;
    address_state?: string | null; address_zip_code?: string | null;
  } | null;
};

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  if (!isQuoteToken(token)) notFound();
  const { data, error } = await createPublicClient().rpc("get_public_proposal", { p_token: token });
  const quote = data as PublicProposal | null;
  if (error || !quote?.id) notFound();
  const items = [...(quote.items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const attachments = [...(quote.attachments ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const expired = Boolean(quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10));
  const status = expired && !["aprovado", "convertido", "recusado"].includes(quote.status) ? "expirado" : quote.status;
  const issuer = quote.issuer ?? {};
  const tradeName = issuer.trade_name || "Empresa";
  const logoUrl = issuer.logo_url || null;
  const addressLine = [issuer.address_street, issuer.address_number, issuer.address_complement, issuer.address_district, issuer.address_city, issuer.address_state].filter(Boolean).join(" · ");
  const contactLine = [issuer.phone, issuer.whatsapp && issuer.whatsapp !== issuer.phone ? `WhatsApp ${issuer.whatsapp}` : null, issuer.email, issuer.website].filter(Boolean).join(" · ");
  const legalLine = [issuer.legal_name && issuer.legal_name !== tradeName ? issuer.legal_name : null, issuer.document ? `CNPJ/CPF ${issuer.document}` : null, issuer.state_registration ? `IE ${issuer.state_registration}` : null].filter(Boolean).join(" · ");

  return <main className="public-proposal-page">
    <section className="public-proposal">
      <header className="proposal-brand"><div className="proposal-brand-identity">{logoUrl ? <img src={logoUrl} alt={tradeName}/> : <span><b>{tradeName}</b>{issuer.document && <small>CNPJ/CPF {issuer.document}</small>}</span>}</div><div className="proposal-brand-number"><small>PROPOSTA COMERCIAL</small><b>#{quote.number}</b></div></header>
      <div className="proposal-intro"><div><small>PREPARADA PARA</small><h1>{quote.company || quote.customer_name}</h1><p>{quote.company ? `A/C ${quote.customer_name}` : quote.service}</p></div><dl><div><dt>Emissão</dt><dd>{date(quote.created_at)}</dd></div><div><dt>Validade</dt><dd>{date(quote.valid_until)}</dd></div><div><dt>Status</dt><dd className={`status-${status}`}>{status === "aprovado" ? "Aprovada" : status === "recusado" ? "Recusada" : status === "convertido" ? "Em produção" : status === "expirado" ? "Expirada" : "Aguardando resposta"}</dd></div></dl></div>
      <div className="proposal-title"><small>PROJETO</small><h2>{quote.service}</h2>{quote.details && <p>{quote.details}</p>}</div>
      {attachments.length > 0 && (
        <section className="proposal-gallery" aria-label="Referências visuais do projeto">
          <header>
            <small>REFERÊNCIAS VISUAIS & MOCKUPS</small>
            <b>Clique em qualquer imagem para ampliar</b>
          </header>
          <div className="proposal-gallery-grid">
            {attachments.map((photo) => (
              <figure key={photo.id}>
                <a href={photo.file_url} target="_blank" rel="noopener noreferrer">
                  <img src={photo.file_url} alt={photo.caption || `Referência do projeto ${quote.service}`} loading="lazy" />
                </a>
                {photo.caption && <figcaption>{photo.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}
      <ProposalConfigurator items={items} token={token} status={status} quoteNumber={quote.number} freight={Number(quote.freight ?? 0)} discount={Number(quote.discount ?? 0)} deliveryDays={quote.delivery_days} paymentTerms={quote.payment_terms} installationIncluded={quote.installation_included} expired={status === "expirado"}/>
      <footer className="proposal-footer"><div><b>{tradeName}</b>{legalLine && <span>{legalLine}</span>}{addressLine && <span>{addressLine}</span>}</div><div>{issuer.proposal_footer && <span>{issuer.proposal_footer}</span>}{contactLine && <span>{contactLine}</span>}</div></footer>
    </section>
  </main>;
}
