import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://nexofab.vercel.app").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/cadastro", "/termos", "/privacidade"],
        disallow: [
          "/gestao",
          "/onboarding",
          "/login",
          "/esqueci-senha",
          "/redefinir-senha",
          "/api/",
          "/proposta/",
          "/recibo/",
          "/arte/",
          "/convite/",
          "/p/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
