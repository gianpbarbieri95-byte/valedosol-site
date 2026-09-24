import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { getPublishedPropertyRefs } from "@/lib/queries/properties";
import { getRegions } from "@/lib/queries/taxonomies";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [properties, regions] = await Promise.all([
    getPublishedPropertyRefs().catch(() => []),
    getRegions().catch(() => []),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/imoveis`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/regioes`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE.url}/a-imobiliaria`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/venda-seu-imovel`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE.url}/contato`, changeFrequency: "monthly", priority: 0.6 },
  ];

  return [
    ...staticPages,
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
