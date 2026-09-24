import type { Metadata } from "next";

import { getRegions } from "@/lib/queries/taxonomies";
import { getRegionCovers, searchProperties } from "@/lib/queries/properties";
import { PRIMARY_CITY } from "@/lib/site";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { RegionCard } from "@/components/property/region-card";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Regiões de Arujá",
  description:
    "Bairros, condomínios e regiões de Arujá e cidades vizinhas onde a Vale do Sol Imóveis atua.",
  alternates: { canonical: "/regioes" },
};

export default async function RegionsPage() {
  const [regions, covers] = await Promise.all([getRegions(), getRegionCovers()]);

  // Quantos imóveis cada região tem — uma região vazia não ajuda ninguém,
  // então ela aparece sem contagem em vez de prometer o que não existe.
  const counts = await Promise.all(
    regions.map(async (region) => {
      const { total } = await searchProperties({ region: region.id, pageSize: 1 });
      return [region.id, total] as const;
    })
  );
  const countByRegion = new Map(counts);

  const primary = regions.filter((region) => region.city === PRIMARY_CITY);
  const others = regions.filter((region) => region.city !== PRIMARY_CITY);

  return (
    <div className="container-site py-10 md:py-14">
      <Breadcrumb items={[{ label: "Regiões" }]} />

      <header className="mt-8 max-w-2xl">
        <p className="eyebrow">Onde procurar</p>
        <h1 className="mt-4 text-balance text-hero">
          Explore Arujá
        </h1>
        <p className="mt-5 text-pretty text-lg leading-relaxed text-ink-soft">
          Cada bairro e cada condomínio da cidade tem um jeito próprio de morar. Comece pelo que
          combina com você.
        </p>
      </header>

      {regions.length === 0 ? (
        <EmptyState
          className="mt-12"
          title="Nenhuma região cadastrada ainda"
          description="As regiões cadastradas no painel administrativo aparecem aqui."
          action={<ButtonLink href="/imoveis">Ver todos os imóveis</ButtonLink>}
        />
      ) : (
        <>
          <RegionGrid regions={primary} countByRegion={countByRegion} covers={covers} />

          {others.length ? (
            <section className="mt-16">
              <h2 className="text-title">Cidades vizinhas</h2>
              <RegionGrid regions={others} countByRegion={countByRegion} covers={covers} className="mt-8" />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function RegionGrid({
  regions,
  countByRegion,
  covers,
  className,
}: {
  regions: Awaited<ReturnType<typeof getRegions>>;
  countByRegion: Map<string, number>;
  covers: Map<string, string>;
  className?: string;
}) {
  if (!regions.length) return null;

  return (
    <div className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${className ?? "mt-12"}`}>
      {regions.map((region, index) => {
        const total = countByRegion.get(region.id) ?? 0;

        // Em três colunas, sobra de uma ou duas regiões deixaria buraco na
        // última fileira. Sobrando duas, o primeiro cartão ocupa duas colunas;
        // sobrando uma, o primeiro e o último — e as fileiras fecham.
        const rest = regions.length % 3;
        const wide =
          regions.length > 1 &&
          ((rest === 2 && index === 0) || (rest === 1 && (index === 0 || index === regions.length - 1)));

        return (
          <Reveal key={region.id} delay={Math.min(index, 3) * 80} className={wide ? "lg:col-span-2" : undefined}>
            <RegionCard
              region={region}
              count={total}
              fallbackImagePath={covers.get(region.id)}
              description
              className={wide ? "aspect-[5/4] lg:aspect-auto lg:h-full" : "aspect-[5/4]"}
              sizes={wide ? "(min-width: 1024px) 66vw, (min-width: 640px) 45vw, 100vw" : undefined}
            />
          </Reveal>
        );
      })}
    </div>
  );
}
