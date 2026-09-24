import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  getPropertyBySlug,
  getPublishedPropertyRefs,
  getRelatedProperties,
} from "@/lib/queries/properties";
import { getSettings } from "@/lib/queries/settings";
import { storageUrl } from "@/lib/supabase/public";
import { SITE, STATUS_LABEL, STORAGE_BUCKETS } from "@/lib/site";
import {
  formatArea,
  formatLocation,
  formatNumber,
  formatPrice,
  propertyWhatsAppMessage,
  truncate,
  whatsappUrl,
} from "@/lib/format";

import { PropertyGallery } from "@/components/property/property-gallery";
import { PropertyCard } from "@/components/property/property-card";
import { PropertyInterestForm } from "@/components/forms/property-interest-form";
import { FavoriteButton } from "@/components/property/favorite-button";
import { Breadcrumb, breadcrumbJsonLd, type Crumb } from "@/components/ui/breadcrumb";
import { Badge, SectionHeading, StatusBadge } from "@/components/ui/primitives";
import { ButtonExternal, ButtonLink } from "@/components/ui/button";
import { PinIcon, WhatsAppIcon } from "@/components/ui/icons";

export const revalidate = 300;
// Um imóvel publicado depois do build é renderizado sob demanda e cacheado.
export const dynamicParams = true;

export async function generateStaticParams() {
  const refs = await getPublishedPropertyRefs();
  return refs.map((ref) => ({ slug: ref.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);

  if (!property) {
    return { title: "Imóvel não encontrado", robots: { index: false, follow: false } };
  }

  const location = formatLocation(property);
  const title = property.seo_title || `${property.title} — ${location}`;
  const description =
    property.seo_description ||
    truncate(
      property.description ||
        `${property.property_type?.name ?? "Imóvel"} ${location ? `em ${location}` : ""} · ${formatPrice(
          property.price,
          { purpose: property.purpose, onRequest: property.price_on_request }
        )} · Código ${property.code}.`,
      160
    );

  const cover = storageUrl(STORAGE_BUCKETS.property, property.images?.[0]?.storage_path);

  return {
    title,
    description,
    alternates: { canonical: `/imoveis/${property.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${SITE.url}/imoveis/${property.slug}`,
      images: cover ? [{ url: cover, width: 1200, height: 900, alt: property.title }] : undefined,
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [property, settings] = await Promise.all([getPropertyBySlug(slug), getSettings()]);

  if (!property) notFound();

  const related = await getRelatedProperties(property, 3);

  const images = (property.images ?? []).map((image, index) => ({
    url: storageUrl(STORAGE_BUCKETS.property, image.storage_path) ?? "",
    alt: image.alt_text || `${property.title} — foto ${index + 1}`,
  })).filter((image) => image.url);

  const location = formatLocation(property);
  const price = formatPrice(property.price, {
    purpose: property.purpose,
    onRequest: property.price_on_request,
  });

  const whatsapp = whatsappUrl(
    settings.contact.whatsapp,
    propertyWhatsAppMessage({ code: property.code, title: property.title })
  );

  const crumbs: Crumb[] = [
    { label: "Imóveis", href: "/imoveis" },
    ...(property.region ? [{ label: property.region.name, href: `/regioes/${property.region.slug}` }] : []),
    { label: property.title },
  ];

  // Ficha principal: número grande na serifa, rótulo em caixa alta embaixo.
  const specs = [
    { value: formatArea(property.area_total), label: "Terreno" },
    { value: formatArea(property.area_built), label: "Construídos" },
    { value: formatNumber(property.bedrooms), label: property.bedrooms === 1 ? "Dormitório" : "Dormitórios" },
    { value: formatNumber(property.suites), label: property.suites === 1 ? "Suíte" : "Suítes" },
    { value: formatNumber(property.parking_spaces), label: property.parking_spaces === 1 ? "Vaga" : "Vagas" },
    { value: formatNumber(property.bathrooms), label: property.bathrooms === 1 ? "Banheiro" : "Banheiros" },
    { value: property.code, label: "Código" },
  ].filter((spec) => spec.value);

  // Uma linha de abertura sob o nome: o começo da própria descrição, cortado
  // sem partir palavra. O texto completo continua em "Sobre este imóvel".
  const paragraphs = property.description?.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean) ?? [];
  const lede = paragraphs[0] ? truncate(paragraphs[0], 190) : null;
  // Descrição longa abre só o começo; o resto fica a um clique.
  const [openParagraphs, moreParagraphs] =
    paragraphs.length > 3 ? [paragraphs.slice(0, 2), paragraphs.slice(2)] : [paragraphs, []];
  const place = [property.neighborhood, property.city].filter(Boolean).join(", ");

  const details = [
    { label: "Tipo", value: property.property_type?.name },
    { label: "Finalidade", value: property.purpose === "venda" ? "Venda" : "Locação" },
    { label: "Situação", value: STATUS_LABEL[property.status] },
    { label: "Cidade", value: property.city },
    { label: "Bairro", value: property.neighborhood },
    { label: "Condomínio", value: property.condo_name },
    { label: "Condomínio (mensal)", value: property.condo_fee ? formatPrice(property.condo_fee) : null },
    { label: "IPTU", value: property.iptu ? formatPrice(property.iptu) : null },
    { label: "Mobiliado", value: property.is_furnished ? "Sim" : null },
  ].filter((item) => item.value);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Residence",
    name: property.title,
    description: property.description || undefined,
    url: `${SITE.url}/imoveis/${property.slug}`,
    identifier: property.code,
    image: images.slice(0, 6).map((image) => image.url),
    address: {
      "@type": "PostalAddress",
      streetAddress: property.address || undefined,
      addressLocality: property.city,
      addressRegion: "SP",
      postalCode: property.zip_code || undefined,
      addressCountry: "BR",
    },
    ...(property.latitude && property.longitude
      ? { geo: { "@type": "GeoCoordinates", latitude: property.latitude, longitude: property.longitude } }
      : {}),
    ...(property.area_total
      ? { floorSize: { "@type": "QuantitativeValue", value: property.area_total, unitCode: "MTK" } }
      : {}),
    ...(property.bedrooms ? { numberOfRooms: property.bedrooms } : {}),
    ...(property.price && !property.price_on_request
      ? {
          offers: {
            "@type": "Offer",
            price: property.price,
            priceCurrency: "BRL",
            availability:
              property.status === "disponivel"
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([jsonLd, breadcrumbJsonLd(crumbs, SITE.url)]),
        }}
      />

      {/* O espaço extra embaixo deixa a barra fixa do celular sem cobrir nada */}
      <div id="property-page" className="container-site pb-[calc(7rem+env(safe-area-inset-bottom))] pt-6 md:pt-8 lg:pb-16">
        <Breadcrumb items={crumbs} />

        {/* A galeria é a protagonista: abre a página, na largura inteira. */}
        <div className="mt-6">
          <PropertyGallery images={images} title={property.title} />
        </div>

        {/* Logo abaixo das fotos: o que é, onde fica e quanto custa. */}
        <header className="mt-10 grid gap-8 border-b border-line pb-10 md:mt-14 lg:grid-cols-12 lg:items-end lg:gap-12">
          <div className="min-w-0 lg:col-span-8">
            <div className="flex flex-wrap items-center gap-2.5">
              {property.is_featured ? <Badge tone="gold">Destaque</Badge> : null}
              <StatusBadge status={property.status} />
              <p className="label-caps text-[0.625rem] text-gold">
                {[property.property_type?.name, place].filter(Boolean).join(" · ")}
              </p>
            </div>

            <h1 className="mt-5 text-balance text-display">{property.title}</h1>

            {lede ? (
              <p className="mt-5 max-w-2xl text-pretty text-[1.0625rem] leading-relaxed text-ink-soft">{lede}</p>
            ) : null}

            {location ? (
              <p className="mt-5 flex items-center gap-2 text-sm text-muted">
                <PinIcon className="text-gold" />
                {property.address || location}
              </p>
            ) : null}
          </div>

          <div className="lg:col-span-4 lg:text-right">
            <p className="label-caps text-[0.625rem] text-muted">
              {property.purpose === "venda" ? "Valor de venda" : "Aluguel"}
            </p>
            <p className="mt-2 font-display text-[clamp(2.2rem,1.8rem+1.2vw,3rem)] leading-none text-primary tabular">
              {price}
            </p>
          </div>
        </header>

        {specs.length ? (
          <dl className="grid grid-cols-2 border-b border-line sm:grid-cols-3 lg:flex lg:divide-x lg:divide-line">
            {specs.map((spec) => (
              <div key={spec.label} className="flex flex-col-reverse py-7 pr-6 lg:flex-1 lg:px-8 lg:first:pl-0">
                <dt className="label-caps mt-2.5 text-[0.625rem] text-muted">{spec.label}</dt>
                <dd className="font-display text-[2rem] leading-none text-ink tabular">{spec.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="mt-14 grid gap-12 lg:mt-20 lg:grid-cols-12 lg:gap-16">
          <div className="min-w-0 lg:col-span-7">
            {paragraphs.length ? (
              <section>
                <p className="eyebrow">Descrição</p>
                <h2 className="mt-4 text-title">Sobre este imóvel</h2>
                <div className="mt-6 max-w-[65ch] space-y-4 text-pretty text-[1.0625rem] leading-relaxed text-ink-soft">
                  {openParagraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
                {moreParagraphs.length ? (
                  // <details> nativo: funciona sem JavaScript e o texto segue indexável.
                  <details className="group mt-4 max-w-[65ch]">
                    <summary className="link-line cursor-pointer list-none text-ink [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">Ler a descrição completa</span>
                      <span className="hidden group-open:inline">Mostrar menos</span>
                    </summary>
                    <div className="mt-6 space-y-4 text-pretty text-[1.0625rem] leading-relaxed text-ink-soft">
                      {moreParagraphs.map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                    </div>
                  </details>
                ) : null}
              </section>
            ) : null}

            {property.highlights?.length ? (
              <section className="mt-16">
                <p className="eyebrow">Ambientes</p>
                <h2 className="mt-4 text-title">Composição</h2>
                <ul className="mt-6 grid gap-x-10 sm:grid-cols-2">
                  {property.highlights.map((item, index) => (
                    <li
                      key={index}
                      className="flex gap-3 break-words border-b border-line py-3.5 text-[0.9375rem] leading-relaxed text-ink-soft [overflow-wrap:anywhere]"
                    >
                      <span aria-hidden className="mt-3 h-px w-3 shrink-0 bg-gold" />
                      {/* Os textos vieram do WordPress como frases de lista, com ";" no fim. */}
                      {item.trim().replace(/[\s;,.]+$/, "")}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {details.length ? (
              <section className="mt-16">
                <p className="eyebrow">Características</p>
                <h2 className="mt-4 text-title">Ficha do imóvel</h2>
                <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3">
                  {details.map((item) => (
                    <div key={item.label} className="flex min-w-0 flex-col-reverse border-t border-line pt-4">
                      <dt className="label-caps mt-2 text-[0.5625rem] text-muted">{item.label}</dt>
                      <dd className="font-display text-[1.4rem] leading-tight text-ink [overflow-wrap:anywhere]">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {property.latitude && property.longitude ? (
              <section className="mt-16">
                <p className="eyebrow">Localização</p>
                <h2 className="mt-4 text-title">Onde fica</h2>
                <p className="mt-2 text-sm text-ink-soft">{property.address || location}</p>
                <div className="mt-6 overflow-hidden rounded-[var(--radius-xs)] border border-line">
                  <iframe
                    title={`Mapa — ${property.title}`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-[380px] w-full border-0"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${property.longitude - 0.006}%2C${property.latitude - 0.004}%2C${property.longitude + 0.006}%2C${property.latitude + 0.004}&layer=mapnik&marker=${property.latitude}%2C${property.longitude}`}
                  />
                </div>
              </section>
            ) : null}
          </div>

          {/* ------------------------------------------------------- Lateral */}
          <aside className="min-w-0 lg:col-span-5 xl:col-span-4 xl:col-start-9">
            <div className="sticky top-28 border border-line bg-surface">
              <div className="border-b border-line p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="label-caps text-[0.625rem] text-muted">
                      {property.purpose === "venda" ? "Valor de venda" : "Aluguel"}
                    </p>
                    <p className="mt-2 font-display text-[2.1rem] leading-none text-primary tabular">{price}</p>
                    <p className="label-caps mt-3 text-[0.5625rem] text-muted">Código {property.code}</p>
                  </div>
                  <FavoriteButton propertyId={property.id} title={property.title} variant="inline" />
                </div>

                {whatsapp ? (
                  <>
                    <ButtonExternal href={whatsapp} variant="gold" size="lg" className="mt-7 w-full">
                      <WhatsAppIcon />
                      Quero conhecer este imóvel
                    </ButtonExternal>
                    <p className="mt-3 text-center text-xs text-muted">
                      Conversa direta com a Vale do Sol, pelo WhatsApp.
                    </p>
                  </>
                ) : null}
              </div>

              <div className="p-7" id="interesse">
                <h2 className="text-2xl">Prefere que a gente entre em contato?</h2>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
                  Deixe seu contato e a gente responde sobre o imóvel {property.code}.
                </p>
                <div className="mt-5">
                  <PropertyInterestForm
                    propertyId={property.id}
                    propertyCode={property.code}
                    propertyTitle={property.title}
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>

        {related.length ? (
          <section className="mt-28 border-t border-line pt-20">
            <SectionHeading eyebrow="Do mesmo acervo" title="Talvez você também goste." />
            <div className="mt-12 grid gap-x-10 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <PropertyCard key={item.id} property={item} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {/*
        Barra fixa no celular: no telefone a lateral com preço e WhatsApp fica
        lá embaixo, longe. Aqui ela acompanha a leitura do anúncio inteiro.
      */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="label-caps text-[0.5625rem] text-muted">
              {property.purpose === "venda" ? "Venda" : "Aluguel"} · {property.code}
            </p>
            <p className="mt-1 truncate font-display text-xl leading-tight text-primary tabular">{price}</p>
          </div>
          {whatsapp ? (
            <ButtonExternal href={whatsapp} variant="gold" className="shrink-0 px-4">
              <WhatsAppIcon />
              Tenho interesse
            </ButtonExternal>
          ) : (
            <ButtonLink href="#interesse" className="shrink-0">
              Tenho interesse
            </ButtonLink>
          )}
        </div>
      </div>
    </>
  );
}
