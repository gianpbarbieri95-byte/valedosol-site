import type { Metadata } from "next";
import Link from "next/link";

import { searchProperties } from "@/lib/queries/properties";
import { getCities, getNeighborhoods, getPropertyTypes } from "@/lib/queries/taxonomies";
import { countActiveFilters, filtersToQuery, parseFilters, type SearchParams } from "@/lib/validations/filters";
import { SORT_OPTIONS, PURPOSE_LABEL, type SortKey } from "@/lib/site";
import { PROFILE_DEFINITIONS } from "@/lib/profiles";
import { cn } from "@/lib/utils";

import { PropertyFilters } from "@/components/property/property-filters";
import { PropertyCard } from "@/components/property/property-card";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const filters = parseFilters(await searchParams);
  const parts: string[] = [];

  if (filters.profile) parts.push(`para ${PROFILE_DEFINITIONS[filters.profile].label.toLowerCase()}`);
  if (filters.purpose) parts.push(filters.purpose === "venda" ? "à venda" : "para alugar");
  if (filters.neighborhood) parts.push(`em ${filters.neighborhood}`);
  else if (filters.city) parts.push(`em ${filters.city}`);

  const title = `Imóveis ${parts.join(" ")}`.trim();
  const hasFilters = countActiveFilters(filters) > 0;

  return {
    title: hasFilters ? title : "Imóveis em Arujá e região",
    description:
      "Casas, terrenos, condomínios, chácaras e imóveis comerciais disponíveis na Vale do Sol Imóveis.",
    alternates: { canonical: `/imoveis${filtersToQuery(filters)}` },
    // Combinação de filtros gera muita URL parecida: só a listagem limpa e
    // a paginação entram no índice.
    robots: hasFilters ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseFilters(await searchParams);
  const activeCount = countActiveFilters(filters);
  // "Alugar" sem nenhum outro filtro: a lista vazia não é culpa de filtro.
  const onlyRent = filters.purpose === "locacao" && activeCount === 1;

  const [result, types, cities, neighborhoods] = await Promise.all([
    searchProperties(filters),
    getPropertyTypes(),
    getCities(),
    getNeighborhoods(filters.city),
  ]);

  const currentSort: SortKey = filters.sort ?? "recentes";
  const profile = filters.profile ? PROFILE_DEFINITIONS[filters.profile] : null;
  const heading = profile
    ? profile.heading
    : filters.purpose
      ? `Imóveis para ${PURPOSE_LABEL[filters.purpose].toLowerCase()}`
      : "Imóveis";

  return (
    <div className="container-site py-10 md:py-14">
      <Breadcrumb items={[{ label: "Imóveis" }]} />

      <header className="mt-6 flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Acervo Vale do Sol</p>
          <h1 className="mt-3 text-display">{heading}</h1>
          {profile ? (
            <p className="mt-3 text-[0.9375rem] text-ink-soft">
              {profile.description}{" "}
              <Link
                href={`/imoveis${filtersToQuery({ ...filters, profile: undefined }, { page: undefined })}`}
                className="text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
              >
                Ver todo o acervo
              </Link>
            </p>
          ) : null}
          <p className="mt-3 text-sm text-ink-soft tabular">
            {result.total === 0
              ? "Nenhum imóvel encontrado"
              : result.total === 1
                ? "1 imóvel encontrado"
                : `${result.total} imóveis encontrados`}
          </p>
        </div>

        <nav
          aria-label="Ordenação"
          className="grid w-full grid-cols-4 gap-1 rounded-[var(--radius-sm)] border border-line bg-surface p-1 shadow-subtle md:flex md:w-auto md:items-center"
        >
          {(Object.keys(SORT_OPTIONS) as SortKey[]).map((key) => (
            <Link
              key={key}
              href={`/imoveis${filtersToQuery(filters, { sort: key, page: undefined })}`}
              aria-current={key === currentSort ? "true" : undefined}
              className={cn(
                "whitespace-nowrap rounded-[var(--radius-xs)] px-1 py-2 text-center text-[0.75rem] transition-colors duration-300 sm:px-3 sm:text-[0.8125rem] md:py-1.5",
                key === currentSort
                  ? "bg-primary text-white shadow-subtle"
                  : "text-ink-soft hover:bg-surface-alt hover:text-ink"
              )}
            >
              {SORT_OPTIONS[key].label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[19rem_1fr] lg:gap-10">
        <PropertyFilters
          filters={filters}
          activeCount={activeCount}
          types={types.map((type) => ({ value: type.slug, label: type.name }))}
          cities={cities.map((city) => ({ value: city, label: city }))}
          neighborhoods={neighborhoods.map((name) => ({ value: name, label: name }))}
        />

        <div>
          {result.items.length ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {result.items.map((property, index) => (
                  <PropertyCard
                    key={property.id}
                    property={property}
                    priority={index < 2}
                    variant="spec"
                    sizes="(min-width: 1280px) 340px, (min-width: 640px) 45vw, 100vw"
                  />
                ))}
              </div>

              <Pagination
                className="mt-12"
                page={result.page}
                pageCount={result.pageCount}
                buildHref={(page) => `/imoveis${filtersToQuery(filters, { page: page > 1 ? page : undefined })}`}
              />
            </>
          ) : (
            <EmptyState
              title={
                onlyRent
                  ? "No momento, nenhum imóvel para alugar publicado"
                  : "Nenhum imóvel com esses filtros"
              }
              description={
                onlyRent
                  ? "Conte o que você procura para alugar em Arujá e região e fale direto com a Vale do Sol."
                  : activeCount > 0
                  ? "Tente ampliar a faixa de preço ou remover algum filtro. Se preferir, fale com a gente: nem tudo que temos está publicado."
                  : "Assim que os imóveis forem publicados no painel, eles aparecem aqui."
              }
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  {activeCount > 0 ? (
                    <ButtonLink href="/imoveis" variant="outline">
                      {onlyRent ? "Ver imóveis à venda" : "Limpar filtros"}
                    </ButtonLink>
                  ) : null}
                  <ButtonLink href="/contato">Falar com a Vale do Sol</ButtonLink>
                </div>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
