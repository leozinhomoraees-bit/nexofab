import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { isValidPublicSlug, type PublicPortalOrganization } from "@/lib/public-portal";
import { createPublicClient } from "@/lib/supabase/public";
import { PublicPortalForm } from "./public-portal-form";
import "./portal.css";

export const dynamic = "force-dynamic";

const loadPublicPortal = cache(async (rawSlug: string): Promise<PublicPortalOrganization | null> => {
  const slug = rawSlug.trim().toLowerCase();
  if (!isValidPublicSlug(slug)) return null;

  const { data, error } = await createPublicClient().rpc("get_public_quote_portal", {
    p_slug: slug,
  });

  if (error || !data) return null;
  const organization = data as Partial<PublicPortalOrganization>;
  if (!organization.public_slug || !organization.trade_name) return null;

  return {
    public_slug: organization.public_slug,
    trade_name: organization.trade_name,
    logo_url: organization.logo_url ?? null,
    email: organization.email ?? null,
    phone: organization.phone ?? null,
    whatsapp: organization.whatsapp ?? null,
    website: organization.website ?? null,
    address_city: organization.address_city ?? null,
    address_state: organization.address_state ?? null,
    proposal_footer: organization.proposal_footer ?? null,
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const organization = await loadPublicPortal(slug);

  if (!organization) {
    return {
      title: "Portal indisponível | NexoFab",
      robots: { index: false, follow: false },
    };
  }

  const title = `Solicitar orçamento — ${organization.trade_name}`;
  const description = `Envie os detalhes do seu projeto e solicite um orçamento diretamente com ${organization.trade_name}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    robots: { index: false, follow: false },
  };
}

export default async function PublicQuotePortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const organization = await loadPublicPortal(slug);
  if (!organization) notFound();

  const locationLine = [organization.address_city, organization.address_state]
    .filter(Boolean)
    .join(" — ");
  const contactLine = [
    organization.phone,
    organization.whatsapp && organization.whatsapp !== organization.phone
      ? `WhatsApp ${organization.whatsapp}`
      : null,
    organization.email,
    organization.website,
  ]
    .filter(Boolean)
    .join(" · ");
  const monogram = organization.trade_name.trim().charAt(0).toUpperCase() || "N";

  return (
    <main className="public-portal-page">
      <section className="public-portal-shell">
        <header className="portal-header">
          <div className="portal-brand">
            {organization.logo_url ? (
              <Image
                src={organization.logo_url}
                alt={`Logo ${organization.trade_name}`}
                width={180}
                height={54}
                unoptimized
                className="portal-logo-img"
              />
            ) : (
              <span className="portal-monogram" aria-hidden="true">
                {monogram}
              </span>
            )}
            <div className="portal-brand-text">
              <h1>{organization.trade_name}</h1>
              {locationLine && (
                <span className="portal-brand-meta">
                  <MapPin />
                  {locationLine}
                </span>
              )}
            </div>
          </div>
          <span className="portal-badge">Portal de orçamentos</span>
        </header>

        <div className="portal-intro">
          <small>ATENDIMENTO DIRETO</small>
          <h2>Solicite seu orçamento em poucos passos</h2>
          <p>
            Preencha as informações abaixo para que a equipe da{" "}
            <b>{organization.trade_name}</b> analise seu projeto e retorne com valores e prazo.
          </p>
        </div>

        <div className="portal-body">
          <PublicPortalForm
            slug={organization.public_slug}
            tradeName={organization.trade_name}
            whatsapp={organization.whatsapp}
          />
        </div>

        <footer className="portal-footer">
          <div className="portal-footer-info">
            <b>{organization.trade_name}</b>
            {organization.proposal_footer && <span>{organization.proposal_footer}</span>}
            {contactLine && <span>{contactLine}</span>}
          </div>
          <Link href="/" className="portal-powered">
            Tecnologia NexoFab
          </Link>
        </footer>
      </section>
    </main>
  );
}
