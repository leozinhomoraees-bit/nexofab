import type { Metadata } from "next";
import "@fontsource/sora/400.css";
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./site.css";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://nexofab.vercel.app").replace(/\/+$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NexoFab | Gestão para comunicação visual e fabricação",
    template: "%s | NexoFab",
  },
  description:
    "Plataforma multiempresa para orçamentos técnicos, precificação real, plano de corte, produção, estoque e financeiro. Comece grátis por 7 dias.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "NexoFab",
    title: "NexoFab — Do orçamento técnico ao caixa realizado",
    description:
      "Orçamentos, precificação, plano de corte, produção, estoque e financeiro no mesmo lugar. Teste grátis por 7 dias.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NexoFab — Gestão para comunicação visual e fabricação",
    description:
      "Orçamentos técnicos, produção, estoque e financeiro integrados. Comece grátis por 7 dias.",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
