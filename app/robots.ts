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
        // Área administrativa e lista pessoal de favoritos não têm por que
        // ser rastreadas. A proteção de verdade é a autenticação, não isto.
        disallow: ["/admin", "/admin/", "/favoritos"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
