import type { MetadataRoute } from "next";
import { URL_SITE } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // páginas de sessão e operação não têm valor de busca
        disallow: ["/admin", "/carrinho", "/conta", "/entrar"],
      },
    ],
    sitemap: `${URL_SITE}/sitemap.xml`,
  };
}
