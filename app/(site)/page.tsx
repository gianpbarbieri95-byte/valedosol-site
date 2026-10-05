import type { Metadata } from "next";

import { PRIMARY_CITY, SITE, STORAGE_BUCKETS } from "@/lib/site";
import {
  PATH_PROFILES,
  PROFILE_DEFINITIONS,
  SHORTCUT_PROFILES,
} from "@/lib/profiles";
import { propertyLede, whatsappUrl } from "@/lib/format";
import { getSettings } from "@/lib/queries/settings";
import {
  getCities,
  getNeighborhoods,
  getPropertyTypes,
  getRegions,
} from "@/lib/queries/taxonomies";
import {
  getPriceRange,
  getPropertyExtras,
  getPropertyCounts,
  getRegionCovers,
  getShowcaseProperties,
  searchProperties,
} from "@/lib/queries/properties";
import { storageUrl } from "@/lib/supabase/public";
import { buildPriceBands } from "@/lib/price-bands";

import { PropertySearch } from "@/components/property/property-search";
import { propertyCoverUrl } from "@/components/property/property-card";
import { Reveal } from "@/components/ui/reveal";
import { HeroFilm } from "@/components/brand-film";
import { FeaturedProperties } from "@/components/home/featured-properties";
import { SearchPaths } from "@/components/home/search-paths";
import { HistorySection } from "@/components/home/history-section";
import { AboutSection } from "@/components/home/about-section";
import { LocalKnowledge } from "@/components/home/local-knowledge";
import { CTASection } from "@/components/home/cta-section";
import { SellSection } from "@/components/home/sell-section";
import { Shortcuts } from "@/components/home/shortcuts";

// Tudo o que aparece escrito no filme, na ordem, para quem usa leitor de tela.
const FILM_TRANSCRIPT = [
  "Vale do Sol Imóveis. Em Arujá desde 1975.",
  "Centro, Arujá-SP. Conhecimento local. Atendimento próximo. Av. Antônio Afonso de Lima, 704.",
  "Condomínio Arujá 5. Estância São Domingos. Condomínio Arujá Hills III. Imóveis para morar, investir ou recomeçar.",
  "Uma história de família. 1975: Leonardo Barbieri. Hoje: Maria e Franco Barbieri.",
  "Compra, venda e locação. Casas, terrenos, chácaras e condomínios, mais galpões e áreas comerciais.",
  "Seu próximo imóvel com quem conhece Arujá.",
  "WhatsApp (11) 99987-6642. Telefone (11) 4655-3399. valedosolimoveis.com.br. Av. Antônio Afonso de Lima, 704, Centro, Arujá-SP. CRECI 38.124-F.",
];

// Institucional v2 (30/09/2026), gerado em Desktop/valedosol-videos/sol-sobre-aruja
// (build-v2.mjs), formato 16x9-hero: todo texto na faixa de cima, porque na hero o
// título do site ocupa o terço de baixo. O mesmo corte serve à janela (720p), à hero
// larga e ao visor de tela cheia (1080p). O fim dissolve no primeiro quadro, então o
// loop não tem salto.
const FILM = {
  src: "/video/institucional-v2-hero-720.mp4",
  fullSrc: "/video/institucional-v2-hero.mp4",
  poster: "/video/institucional-v2-hero-poster.jpg",
  transcript: FILM_TRANSCRIPT,
  duration: 37,
};

// Conteúdo muda quando o corretor publica um imóvel; o revalidate cobre
// o caso de a revalidação por caminho não ter sido disparada.
export const revalidate = 300;

export const metadata: Metadata = {
  // O título padrão (layout) já é "Vale do Sol Imóveis — Imóveis em Arujá desde 1975".
  description:
    "Imobiliária em Arujá desde 1975. Casas, terrenos, imóveis de alto padrão em condomínio, chácaras e imóveis comerciais à venda em Arujá e região. CRECI 38.124-F.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [
    settings,
    featured,
    types,
    cities,
    neighborhoods,
    regions,
    priceRange,
    counts,
    regionCovers,
    profileResults,
    shortcutTotals,
    rentTotal,
  ] = await Promise.all([
    getSettings(),
    getShowcaseProperties(3),
    getPropertyTypes(),
    getCities(),
    getNeighborhoods(),
    getRegions(),
    getPriceRange(),
    getPropertyCounts(),
    getRegionCovers(),
    Promise.all(
      PATH_PROFILES.map((profile) =>
        searchProperties({ profile, pageSize: 60 }),
      ),
    ),
    Promise.all(
      SHORTCUT_PROFILES.map(
        async (profile) =>
          (await searchProperties({ profile, pageSize: 1 })).total,
      ),
    ),
    searchProperties({ purpose: "locacao", pageSize: 1 }).then(
      (result) => result.total,
    ),
  ]);

  // A vitrine abre pelo imóvel de maior valor entre os três: é o que melhor
  // representa o padrão do acervo. Preço sob consulta fica por último.
  const showcase = [...featured].sort(
    (a, b) => (b.price ?? 0) - (a.price ?? 0),
  );

  const extras = await getPropertyExtras(showcase.map((property) => property.id));
  const ledes = new Map(
    showcase.map((property) => {
      const extra = extras.get(property.id);
      return [property.id, propertyLede({ title: property.title, ...extra })] as const;
    }),
  );

  const regionTotals = await Promise.all(
    regions.map(
      async (region) =>
        [
          region.id,
          (await searchProperties({ region: region.id, pageSize: 1 })).total,
        ] as const,
    ),
  );
  const countByRegion = new Map(regionTotals);

  const { hero, about, contact, social } = settings;

  // Foto de fundo só se a imobiliária cadastrar uma no painel; ela entra bem
  // apagada, como textura atrás do verde. Sem ela, o fundo é o da marca.
  const heroImage = storageUrl(STORAGE_BUCKETS.site, hero.image_path);

  const locationOptions = [
    ...neighborhoods.map((name) => ({ value: name, label: name })),
    ...cities
      .filter((city) => !neighborhoods.includes(city))
      .map((city) => ({ value: city, label: city })),
  ];

  // Cada caminho de busca usa a foto de um imóvel dele que não esteja já na
  // vitrine logo acima — a mesma foto duas vezes seguidas parece descuido.
  const usedIds = new Set(featured.map((property) => property.id));
  const paths = PATH_PROFILES.map((profile, index) => {
    const result = profileResults[index];
    const candidates = result.items.filter(
      (item) => item.images?.length && item.status !== "vendido",
    );
    const pick =
      candidates.find((item) => !usedIds.has(item.id)) ?? candidates[0];
    // O mesmo imóvel não ilustra dois caminhos.
    if (pick) usedIds.add(pick.id);
    return {
      profile,
      count: result.total,
      image: pick ? propertyCoverUrl(pick) : null,
    };
  });

  // Regiões com foto e com mais imóveis primeiro; a ordem cadastrada desempata.
  const places = regions
    .map((region, index) => ({
      region,
      index,
      count: countByRegion.get(region.id) ?? 0,
      image:
        storageUrl(STORAGE_BUCKETS.region, region.image_path) ??
        storageUrl(STORAGE_BUCKETS.property, regionCovers.get(region.id)),
    }))
    .filter((place) => place.count > 0 || place.image)
    .sort(
      (a, b) =>
        Number(Boolean(b.image)) - Number(Boolean(a.image)) ||
        b.count - a.count ||
        a.index - b.index,
    )
    .map(({ region, count, image }) => ({
      slug: region.slug,
      name: region.name,
      city: region.city,
      count,
      image,
    }));

  const yearsOfHistory = new Date().getFullYear() - SITE.foundedYear;
  const office = [contact.address, contact.district, contact.city]
    .filter(Boolean)
    .join(" · ");

  // Só entra aqui o que é verificável: a data de fundação, a contagem real
  // de imóveis publicados e o registro no CRECI.
  const trust = [
    { value: `${yearsOfHistory} anos`, label: "de história" },
    ...(counts.total > 0
      ? [
          {
            value: String(counts.total),
            label:
              counts.total === 1
                ? "imóvel selecionado"
                : "imóveis selecionados",
          },
        ]
      : []),
    { value: SITE.creci.replace("CRECI ", ""), label: "CRECI" },
  ];

  // Último parágrafo do fechamento institucional ("São décadas conhecendo
  // Arujá..."); o primeiro repetiria "gerações" logo abaixo do título.
  const closingLine =
    about.closing
      ?.split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1) ||
    about.intro ||
    null;

  // O título vem do painel; cada frase ganha a sua linha.
  const headline = hero.title.split(/(?<=[.!?])\s+/).filter(Boolean);

  // Dados estruturados da imobiliária: só o que está cadastrado no painel.
  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": `${SITE.url}/#imobiliaria`,
    name: SITE.name,
    legalName: SITE.legalName,
    url: SITE.url,
    logo: `${SITE.url}/brand/logo.png`,
    image: `${SITE.url}/video/institucional-v2-hero-poster.jpg`,
    description: `Imobiliária em ${PRIMARY_CITY} desde ${SITE.foundedYear}: casas, terrenos, condomínios, chácaras e imóveis comerciais em Arujá e região.`,
    foundingDate: String(SITE.foundedYear),
    founder: { "@type": "Person", name: "Leonardo Barbieri" },
    telephone: contact.phone || undefined,
    email: contact.email || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: contact.address,
      addressLocality: contact.city,
      addressRegion: contact.state,
      postalCode: contact.zip,
      addressCountry: "BR",
    },
    areaServed: { "@type": "City", name: PRIMARY_CITY },
    identifier: SITE.creci,
    sameAs: [social.facebook, social.instagram].filter(Boolean),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
      />

      {/* ------------------------------------------------------------ Abertura */}
      {/*
        O filme institucional é a primeira tela. Ele tem texto próprio na
        faixa do meio, então a tipografia do site assenta no terço de baixo,
        sobre um degradê — nada cobre o que o filme escreve. No celular o
        filme entra inteiro (16:9) e o título vem logo abaixo. Os arquivos do
        filme não são tocados; só a moldura mudou.
      */}
      <section
        id="home-hero"
        className="relative isolate bg-primary-deep pt-20 text-white lg:flex lg:min-h-[max(calc(100svh-4.5rem),42rem)] lg:flex-col lg:pt-0"
      >
        <HeroFilm
          film={FILM}
          className="aspect-video lg:absolute lg:inset-0 lg:aspect-auto"
          controlsClassName="right-3 top-[calc(5rem+56.25vw-3rem)] lg:inset-x-0 lg:bottom-[156px] lg:right-0 lg:top-auto"
          overlay={
            <>
              {/* Topo: o cabeçalho continua legível até no quadro claro do fim */}
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 hidden h-48 bg-gradient-to-b from-black/45 to-transparent lg:block"
              />
              {/* Base: a área do título. No celular só funde o filme ao verde. */}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-primary-deep to-transparent lg:h-[62%] lg:from-primary-deep lg:via-primary-deep/80"
              />
            </>
          }
        >
          <div className="container-site relative z-10 pb-10 pt-8 lg:mt-auto lg:pb-0 lg:pt-0">
            <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-12 lg:pb-16">
              <div className="lg:col-span-8">
                <p
                  className="rise-in label-caps text-[0.6875rem] text-gold-bright"
                  style={{ animationDelay: "40ms" }}
                >
                  {PRIMARY_CITY} <span aria-hidden className="mx-2 text-white/40">·</span> Desde{" "}
                  {SITE.foundedYear}
                </p>
                <h1
                  className="rise-in mt-5 max-w-[22ch] text-balance font-display text-[clamp(2.4rem,1.3rem+3vw,4.5rem)] leading-[1.02] tracking-[-0.02em] text-white"
                  style={{ animationDelay: "90ms" }}
                >
                  {headline.map((line, index) => (
                    <span
                      key={line}
                      className={
                        index > 0 ? "block italic text-white/80" : "block"
                      }
                    >
                      {line}
                    </span>
                  ))}
                </h1>
              </div>

              <div
                className="rise-in lg:col-span-4 lg:pb-1"
                style={{ animationDelay: "200ms" }}
              >
                <p className="max-w-sm text-pretty text-[1.0625rem] leading-relaxed text-white/80 lg:text-lg">
                  {hero.subtitle}
                </p>
                {/* Lugar reservado para os controles do filme (em HeroFilm),
                  que ficam alinhados a esta linha: 156px da base do hero. */}
                <div aria-hidden className="mt-7 hidden h-9 lg:block" />
              </div>
            </div>

            {/* A busca assenta na borda entre a abertura e a página. Os
              controles do filme (em HeroFilm) se alinham ao fim do texto acima:
              156px da base do hero, fixos porque a busca tem altura fixa. */}
            <PropertySearch
              className="rise-in relative z-10 mt-10 lg:mt-0 lg:translate-y-1/2"
              types={types.map((type) => ({
                value: type.slug,
                label: type.name,
              }))}
              locations={locationOptions}
              priceBands={buildPriceBands(priceRange)}
            />
          </div>
        </HeroFilm>
      </section>

      {/* ------------------------------------------------ Faixa de credibilidade */}
      {/* Só o verificável: a fundação, o acervo publicado e o CRECI. */}
      <section
        aria-label="A Vale do Sol em números"
        className="border-b border-line"
      >
        <div className="container-site flex flex-col gap-8 py-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:pb-12 lg:pt-[calc(2.75rem+3.5rem)]">
          <dl className="grid grid-cols-3 lg:flex lg:gap-0">
            {trust.map((item, index) => (
              <div
                key={item.label}
                className={
                  index > 0
                    ? "border-l border-line pl-4 sm:pl-8 lg:pr-10"
                    : "pr-4 sm:pr-8 lg:pr-10"
                }
              >
                <dt className="sr-only">{item.label}</dt>
                <dd className="font-display text-[1.75rem] leading-none text-ink tabular sm:text-[2rem]">
                  {item.value}
                </dd>
                <p className="label-caps mt-2 text-[0.5625rem] leading-snug text-muted sm:text-[0.625rem]">
                  {item.label}
                </p>
              </div>
            ))}
          </dl>

          {/* Atalhos por tipo: um toque e a listagem já abre filtrada */}
          <Shortcuts
            items={[
              ...SHORTCUT_PROFILES.map((profile, index) => ({
                href: `/imoveis?perfil=${profile}`,
                label: PROFILE_DEFINITIONS[profile].label,
                count: shortcutTotals[index],
              })),
              {
                href: "/imoveis?finalidade=locacao",
                label: "Alugar",
                count: rentTotal,
              },
            ]}
          />
        </div>
      </section>

      <FeaturedProperties
        properties={showcase}
        total={counts.total}
        ledes={ledes}
      />

      <SearchPaths paths={paths} />

      {places.length ? (
        <section
          aria-labelledby="regiao"
          className="border-t border-line bg-surface section-xl"
        >
          <div className="container-site">
            <div className="grid gap-8 lg:grid-cols-12 lg:gap-16">
              <Reveal className="lg:col-span-6">
                <p className="eyebrow">Regiões de Arujá</p>
                <h2 id="regiao" className="mt-6 text-balance text-hero">
                  Conhecemos Arujá.
                </h2>
              </Reveal>
              <Reveal
                className="self-end lg:col-span-5 lg:col-start-8"
                delay={120}
              >
                <p className="text-pretty font-display text-[clamp(1.5rem,1.2rem+1vw,2.1rem)] italic leading-snug text-primary">
                  Conhecemos a região porque fazemos parte dela.
                </p>
                <p className="mt-4 text-pretty leading-relaxed text-ink-soft">
                  Os bairros e condomínios onde a Vale do Sol tem imóveis hoje.
                </p>
              </Reveal>
            </div>
            <Reveal className="mt-14 md:mt-20" delay={80}>
              <LocalKnowledge
                places={places}
                office={`Escritório no coração de Arujá: ${office}. ${SITE.creci}.`}
              />
            </Reveal>
          </div>
        </section>
      ) : null}

      <HistorySection />

      <AboutSection closing={closingLine} />

      <SellSection specialties={about.specialties ?? null} years={yearsOfHistory} />

      <CTASection
        whatsapp={whatsappUrl(
          contact.whatsapp,
          "Olá! Estou procurando um imóvel em Arujá e região e gostaria de ajuda da Vale do Sol.",
        )}
        image={heroImage}
      />
    </>
  );
}
