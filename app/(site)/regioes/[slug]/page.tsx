import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { getRegionBySlug, getRegions } from "@/lib/queries/taxonomies";
import { searchProperties } from "@/lib/queries/properties";
import { storageUrl } from "@/lib/supabase/public";
import { SITE, STORAGE_BUCKETS } from "@/lib/site";
import { filtersToQuery, parseFilters, type SearchParams } from "@/lib/validations/filters";

import { Breadcrumb, breadcrumbJsonLd, type Crumb } from "@/components/ui/breadcrumb";
import { PropertyCard } from "@/components/property/property-card";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";

export const revalidate = 600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const regions = await getRegions();
  return regions.map((region) => ({ slug: region.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const region = await getRegionBySlug(slug);

  if (!region) {
    return { title: "Região não encontrada", robots: { index: false, follow: false } };
  }

  const title = region.seo_title || `Imóveis em ${region.name}, ${region.city}`;
  const description =
    region.seo_description ||
    region.description ||
    `Casas, terrenos e imóveis disponíveis em ${region.name}, ${region.city}. Vale do Sol Imóveis, em Arujá desde ${SITE.foundedYear}.`;

  return {
    title,
    description,
    alternates: { canonical: `/regioes/${region.slug}` },
    openGraph: { title, description, url: `${SITE.url}/regioes/${region.slug}` },
  };
}

export default async function RegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ slug }, rawSearch] = await Promise.all([params, searchParams]);
  const region = await getRegionBySlug(slug);

  if (!region) notFound();

  const filters = { ...parseFilters(rawSearch), region: region.id };
  const result = await searchProperties(filters);

  const image = storageUrl(STORAGE_BUCKETS.region, region.image_path);
  const crumbs: Crumb[] = [{ label: "Regiões", href: "/regioes" }, { label: region.name }];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(crumbs, SITE.url)) }}
      />

      <section className="relative isolate overflow-hidden bg-primary">
        {image ? (
          <>
            <Image src={image} alt="" fill priority sizes="100vw" className="object-cover" />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-[#0a2415]/92 via-[#0a2415]/70 to-[#0a2415]/50"
            />
          </>
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_0%,#14532a_0%,#0b4423_45%,#07301a_100%)]"
          />
        )}

        <div className="container-site relative py-14 md:py-20">
          <Breadcrumb items={crumbs} className="[&_*]:text-white/60 [&_a:hover]:text-white" />
          <p className="mt-6 text-[0.6875rem] uppercase tracking-[0.18em] text-gold-soft">
            {region.city}
          </p>
          <h1 className="mt-3 text-balance text-[2.5rem] leading-[1.06] text-white md:text-[3.25rem]">
            {region.name}
          </h1>
          {region.description ? (
            <p className="mt-5 max-w-2xl text-pretty leading-relaxed text-white/85 md:text-lg">
              {region.description}
            </p>
          ) : null}
        </div>
      </section>

      <div className="container-site py-12 md:py-16">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-6">
          <h2 className="text-2xl">
            {result.total === 0
              ? "Nenhum imóvel disponível agora"
              : result.total === 1
                ? "1 imóvel disponível"
                : `${result.total} imóveis disponíveis`}
          </h2>
          <ButtonLink href="/imoveis" variant="ghost" size="sm">
            Buscar em toda a região
          </ButtonLink>
        </div>

        {result.items.length ? (
          <>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((property, index) => (
                <PropertyCard key={property.id} property={property} priority={index < 3} />
              ))}
            </div>

            <Pagination
              className="mt-12"
              page={result.page}
              pageCount={result.pageCount}
              buildHref={(page) =>
                `/regioes/${region.slug}${filtersToQuery(
                  { ...filters, region: undefined },
                  { page: page > 1 ? page : undefined }
                )}`
              }
            />
          </>
        ) : (
          <EmptyState
            className="mt-10"
            title={`Sem imóveis em ${region.name} no momento`}
            description="Nem tudo que temos está publicado. Se você procura nesta região, fale com a gente — podemos avisar quando algo entrar."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <ButtonLink href="/contato">Quero ser avisado</ButtonLink>
                <ButtonLink href="/imoveis" variant="outline">
                  Ver outros imóveis
                </ButtonLink>
              </div>
            }
          />
        )}
      </div>
    </>
  );
}
