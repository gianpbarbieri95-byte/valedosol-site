import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (SITE.noindex) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // A lista pessoal de favoritos não tem por que ser rastreada. O painel
        // não aparece aqui: ele mora em outro host (admin.*), que tem o
        // próprio robots.txt bloqueando tudo, e /admin responde 404 neste.
        disallow: ["/favoritos"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
