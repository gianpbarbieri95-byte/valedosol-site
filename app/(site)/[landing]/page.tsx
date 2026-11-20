import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { searchProperties } from "@/lib/queries/properties";
import { getSettings } from "@/lib/queries/settings";
import { whatsappUrl } from "@/lib/format";
import { PRIMARY_CITY, SITE } from "@/lib/site";
import { DEFAULT_OG_IMAGE, LANDINGS, ORG_ID, faqJsonLd, getLanding } from "@/lib/seo";
import { parseFilters, type SearchParams } from "@/lib/validations/filters";

import { Breadcrumb, breadcrumbJsonLd, type Crumb } from "@/components/ui/breadcrumb";
import { PropertyCard } from "@/components/property/property-card";
import { Pagination } from "@/components/ui/pagination";
import { ButtonExternal, ButtonLink } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/icons";

/**
 * Páginas de entrada por busca ("casas à venda em Arujá" etc.). Têm URL
 * própria e limpa, ficam no índice e mostram o acervo ao vivo — ao contrário
 * de /imoveis?perfil=casas, que é um filtro e fica fora do índice.
 */
export const revalidate = 600;
export const dynamicParams = false;

export function generateStaticParams() {
  return LANDINGS.map((landing) => ({ landing: landing.slug }));
}

type Props = {
  params: Promise<{ landing: string }>;
  searchParams: Promise<SearchParams>;
};

async function load(slug: string, rawSearch: SearchParams) {
  const landing = getLanding(slug);
  if (!landing) return null;
  const page = parseFilters(rawSearch).page;
  const result = await searchProperties({
    ...landing.filters,
    city: PRIMARY_CITY,
    page,
    pageSize: 12,
  });
  return { landing, result };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { landing: slug } = await params;
  const data = await load(slug, await searchParams);
  if (!data) return { title: "Página não encontrada", robots: { index: false, follow: false } };

  const { landing, result } = data;
  const page = result.page > 1 ? result.page : null;
  const path = `/${landing.slug}${page ? `?pagina=${page}` : ""}`;
  const title = page ? `${landing.title} — página ${page}` : landing.title;

  return {
    title,
    description: landing.description,
    alternates: { canonical: path },
    // Sem imóvel publicado a página não tem o que oferecer: fica fora do índice.
    robots: result.total === 0 ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: "website",
      title,
      description: landing.description,
      url: `${SITE.url}${path}`,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description: landing.description },
  };
}

export default async function LandingPage({ params, searchParams }: Props) {
  const { landing: slug } = await params;
  const data = await load(slug, await searchParams);
  if (!data) notFound();

  const { landing, result } = data;
  const { contact } = await getSettings();
  const whatsapp = whatsappUrl(
    contact.whatsapp,
    `Olá, vim pela página "${landing.h1}" no site da Vale do Sol Imóveis e gostaria de falar com vocês.`,
  );

  const crumbs: Crumb[] = [{ label: landing.label }];
  const url = `${SITE.url}/${landing.slug}`;

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#pagina`,
    url,
    name: landing.h1,
    description: landing.description,
    inLanguage: "pt-BR",
    isPartOf: { "@id": `${SITE.url}/#website` },
    about: { "@id": ORG_ID },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: result.total,
      itemListElement: result.items.map((property, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE.url}/imoveis/${property.slug}`,
        name: property.title,
      })),
    },
  };

  const others = LANDINGS.filter((item) => item.slug !== landing.slug);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([collectionLd, breadcrumbJsonLd(crumbs, SITE.url), faqJsonLd(landing.faq)]),
        }}
      />

      <div className="container-site py-10 md:py-14">
        <Breadcrumb items={crumbs} />

        <header className="mt-6 max-w-3xl border-b border-line pb-8">
          <p className="eyebrow">{PRIMARY_CITY} · desde {SITE.foundedYear}</p>
          <h1 className="mt-3 text-balance text-display">{landing.h1}</h1>
          {landing.intro.map((paragraph) => (
            <p key={paragraph} className="mt-4 text-pretty text-[0.9375rem] leading-relaxed text-ink-soft">
              {paragraph}
            </p>
          ))}
          <p className="mt-4 text-sm text-ink-soft tabular">
            {result.total === 0
              ? "Nenhum imóvel publicado agora"
              : result.total === 1
                ? "1 imóvel disponível"
                : `${result.total} imóveis disponíveis`}
          </p>
        </header>

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
              buildHref={(page) => `/${landing.slug}${page > 1 ? `?pagina=${page}` : ""}`}
            />
          </>
        ) : (
          <div className="mt-10 rounded-[var(--radius-sm)] border border-line bg-surface p-8 text-center">
            <p className="text-lg text-ink">Sem imóveis desse tipo publicados neste momento.</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
              Nem tudo que temos está publicado. Fale com a equipe e avisamos quando algo entrar.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/contato">Quero ser avisado</ButtonLink>
              <ButtonLink href="/imoveis" variant="outline">
                Ver todo o acervo
              </ButtonLink>
            </div>
          </div>
        )}

        <section aria-labelledby="faq" className="mt-16 max-w-3xl">
          <h2 id="faq" className="text-2xl">
            Perguntas frequentes
          </h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {landing.faq.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="cursor-pointer list-none text-[0.9375rem] font-medium text-ink marker:hidden">
                  {item.question}
                </summary>
                <p className="mt-3 text-pretty text-[0.9375rem] leading-relaxed text-ink-soft">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-16 flex flex-col gap-6 border-t border-line pt-10 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl">Fale com quem conhece Arujá desde {SITE.foundedYear}</h2>
            <p className="mt-2 text-sm text-ink-soft">
              CRECI {SITE.creciCompany} · corretor responsável CRECI {SITE.creciBroker}
            </p>
          </div>
          {whatsapp ? (
            <ButtonExternal href={whatsapp} variant="gold" size="lg">
              <WhatsAppIcon />
              Chamar no WhatsApp
            </ButtonExternal>
          ) : (
            <ButtonLink href="/contato" size="lg">
              Fale conosco
            </ButtonLink>
          )}
        </section>

        <nav aria-label="Outras buscas" className="mt-12 border-t border-line pt-8">
          <p className="eyebrow">Veja também</p>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem]">
            {others.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/${item.slug}`}
                  className="text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/regioes"
                className="text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
              >
                Bairros e condomínios de Arujá
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
}
