import type { MetadataRoute } from "next";
import { PRIMARY_CITY, SITE } from "@/lib/site";
import { LANDINGS } from "@/lib/seo";
import { getPublishedPropertyRefs, searchProperties } from "@/lib/queries/properties";
import { getRegions } from "@/lib/queries/taxonomies";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [properties, regions, landingTotals] = await Promise.all([
    getPublishedPropertyRefs().catch(() => []),
    getRegions().catch(() => []),
    Promise.all(
      LANDINGS.map(async (landing) => ({
        landing,
        total: await searchProperties({ ...landing.filters, city: PRIMARY_CITY, pageSize: 1 })
          .then((result) => result.total)
          .catch(() => 0),
      })),
    ),
  ]);

  // O acervo mudou quando o imóvel mais recente mudou: serve de lastmod das
  // páginas que listam imóveis (home, listagem, entradas por tipo).
  const latest = properties
    .map((property) => new Date(property.updated_at))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, lastModified: latest, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/imoveis`, lastModified: latest, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/regioes`, lastModified: latest, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE.url}/a-imobiliaria`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/venda-seu-imovel`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE.url}/contato`, changeFrequency: "monthly", priority: 0.6 },
  ];

  // Entrada sem imóvel publicado fica fora do índice (a própria página já
  // responde noindex), então também fica fora do sitemap.
  const landingPages: MetadataRoute.Sitemap = landingTotals
    .filter(({ total }) => total > 0)
    .map(({ landing }) => ({
      url: `${SITE.url}/${landing.slug}`,
      lastModified: latest,
      changeFrequency: "daily" as const,
      priority: 0.9,
    }));

  return [
    ...staticPages,
    ...landingPages,
    ...regions.map((region) => ({
      url: `${SITE.url}/regioes/${region.slug}`,
      lastModified: new Date(region.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...properties.map((property) => ({
      url: `${SITE.url}/imoveis/${property.slug}`,
      lastModified: new Date(property.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
