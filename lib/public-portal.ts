export const RESERVED_PUBLIC_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "arte",
  "auth",
  "billing",
  "cadastro",
  "convite",
  "dashboard",
  "entrar",
  "esqueci-senha",
  "gestao",
  "login",
  "nexofab",
  "onboarding",
  "orcamentos",
  "p",
  "portal",
  "privacidade",
  "proposta",
  "recibo",
  "redefinir-senha",
  "sair",
  "status",
  "suporte",
  "termos",
  "webhook",
  "www",
]);

export const PUBLIC_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizePublicSlug(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function isValidPublicSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 60) return false;
  if (!PUBLIC_SLUG_REGEX.test(normalized)) return false;
  if (RESERVED_PUBLIC_SLUGS.has(normalized)) return false;
  return true;
}

export type PublicPortalOrganization = {
  public_slug: string;
  trade_name: string;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  address_city: string | null;
  address_state: string | null;
  proposal_footer: string | null;
};

export const PUBLIC_PORTAL_SERVICES = [
  {
    value: "Grandes formatos",
    title: "Grandes formatos",
    description: "Banners, adesivos, lonas, placas e painéis",
  },
  {
    value: "Router CNC",
    title: "Router CNC",
    description: "Usinagem em ACM, MDF, PVC, acrílico e madeira",
  },
  {
    value: "Corte a laser",
    title: "Corte a laser",
    description: "Corte e gravação de precisão sob medida",
  },
  {
    value: "Impressão 3D",
    title: "Impressão 3D",
    description: "Peças técnicas, protótipos e personalizados",
  },
  {
    value: "Projeto especial",
    title: "Projeto especial",
    description: "Fachadas, letra-caixa, displays e soluções combinadas",
  },
] as const;

export const PUBLIC_PORTAL_MATERIALS = [
  "A definir",
  "ACM",
  "MDF",
  "Acrílico",
  "PVC expandido",
  "Vinil adesivo",
  "Lona",
  "PLA / PETG",
  "Outro material",
] as const;
