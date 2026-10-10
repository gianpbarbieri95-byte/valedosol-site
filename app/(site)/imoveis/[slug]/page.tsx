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
  propertyLede,
  propertyWhatsAppMessage,
  truncate,
  whatsappUrl,
} from "@/lib/format";
import { descriptionPlainText, formatDescription, formatListItem } from "@/lib/description";

import Link from "next/link";
import { PropertyGallery, PropertyPhotoGrid } from "@/components/property/property-gallery";
import { PropertyCard } from "@/components/property/property-card";
import { DescriptionBlocks } from "@/components/property/description-blocks";
import { PropertyInterestForm } from "@/components/forms/property-interest-form";
import { FavoriteButton } from "@/components/property/favorite-button";
import { WhatsAppLeadButton } from "@/components/property/whatsapp-lead-button";
import { FinancingSimulator } from "@/components/property/financing-simulator";
import { Breadcrumb, breadcrumbJsonLd, type Crumb } from "@/components/ui/breadcrumb";
import { Badge, SectionHeading, StatusBadge } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon, PinIcon, WhatsAppIcon } from "@/components/ui/icons";

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
      descriptionPlainText(property.description) ||
        `${property.property_type?.name ?? "Imóvel"} ${location ? `em ${location}` : ""} · ${formatPrice(
          property.price,
          { purpose: property.purpose, onRequest: property.price_on_request }
        )} · Código ${property.code}.`,
      160
    );

  // A foto marcada como capa; sem marcação, a primeira.
  const coverImage = property.images?.find((image) => image.is_cover) ?? property.images?.[0];
  const cover = storageUrl(STORAGE_BUCKETS.property, coverImage?.storage_path);

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

  const videos = (property.videos ?? [])
    .map((video) => storageUrl(STORAGE_BUCKETS.video, video.storage_path))
    .filter((url): url is string => Boolean(url));

  const location = formatLocation(property);
  const price = formatPrice(property.price, {
    purpose: property.purpose,
    onRequest: property.price_on_request,
  });

  const whatsapp = whatsappUrl(
    settings.contact.whatsapp,
    propertyWhatsAppMessage({ code: property.code, title: property.title })
  );

  // Só imóvel à venda com valor publicado ganha simulação de financiamento.
  const canSimulate = property.purpose === "venda" && !property.price_on_request && (property.price ?? 0) > 0;

  // Link de compartilhamento: abre o WhatsApp com o anúncio já escrito.
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(
    `${property.title} — ${price}
${SITE.url}/imoveis/${property.slug}`
  )}`;

  const crumbs: Crumb[] = [
    { label: "Imóveis", href: "/imoveis" },
    ...(property.region ? [{ label: property.region.name, href: `/regioes/${property.region.slug}` }] : []),
    { label: property.title },
  ];

  // Ficha principal: número grande na serifa, rótulo em caixa alta embaixo.
  const specs = [
    { value: formatArea(property.area_total), label: "Terreno" },
    { value: formatArea(property.area_built), label: "Construídos" },
    // Comercial: salas no lugar de dormitórios e suítes.
    ...(property.is_commercial
      ? [{ value: formatNumber(property.rooms), label: property.rooms === 1 ? "Sala" : "Salas" }]
      : [
          { value: formatNumber(property.bedrooms), label: property.bedrooms === 1 ? "Dormitório" : "Dormitórios" },
          { value: formatNumber(property.suites), label: property.suites === 1 ? "Suíte" : "Suítes" },
        ]),
    { value: formatNumber(property.parking_spaces), label: property.parking_spaces === 1 ? "Vaga" : "Vagas" },
    { value: formatNumber(property.bathrooms), label: property.bathrooms === 1 ? "Banheiro" : "Banheiros" },
    { value: property.code, label: "Código" },
  ].filter((spec) => spec.value);

  // Uma linha de abertura sob o nome: o começo da própria descrição, cortado
  // sem partir palavra. O texto completo continua em "Sobre este imóvel".
  // Descrição padronizada (lib/description.ts): parágrafos e listas no mesmo
  // formato em todos os imóveis, digitados agora ou vindos do WordPress.
  const paragraphs = formatDescription(property.description);
  const lede = propertyLede(property, 200);
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

  const sections = [
    { id: "sobre", label: "Sobre", show: paragraphs.length > 0 },
    { id: "caracteristicas", label: "Características", show: details.length > 0 },
    { id: "ambientes", label: "Ambientes", show: Boolean(property.highlights?.length) },
    { id: "financiamento", label: "Financiamento", show: canSimulate },
    { id: "localizacao", label: "Localização", show: Boolean(location) },
    { id: "galeria", label: "Galeria", show: images.length > 1 },
    { id: "videos", label: videos.length === 1 ? "Vídeo" : "Vídeos", show: videos.length > 0 },
    { id: "interesse", label: "Contato", show: true },
  ].filter((section) => section.show);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Residence",
    name: property.title,
    description: descriptionPlainText(property.description) || undefined,
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
    ...(property.is_commercial
      ? property.rooms
        ? { numberOfRooms: property.rooms }
        : {}
      : property.bedrooms
        ? { numberOfRooms: property.bedrooms }
        : {}),
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

        {/* Como a abertura de uma matéria: onde fica, o nome, uma linha que
            o apresenta e o valor. As fotos vêm logo em seguida. */}
        <header className="mt-8 grid gap-6 md:mt-10 lg:grid-cols-12 lg:items-end lg:gap-12">
          <div className="min-w-0 lg:col-span-8">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="label-caps text-[0.6875rem] text-gold">
                {[place, property.property_type?.name].filter(Boolean).join(" · ")}
              </p>
              {property.is_featured ? <Badge tone="gold">Destaque</Badge> : null}
              <StatusBadge status={property.status} />
            </div>

            <h1 className="mt-5 text-balance text-display">{property.title}</h1>

            {lede ? (
              <p className="mt-5 max-w-2xl text-pretty text-[1.0625rem] leading-relaxed text-ink-soft">{lede}</p>
            ) : null}

            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link-line mt-6 inline-flex items-center gap-2 text-[0.6875rem] text-ink-soft hover:text-ink"
            >
              <WhatsAppIcon className="size-4" />
              Compartilhar no WhatsApp
            </a>

          </div>

          {/* No celular o valor já acompanha a leitura na barra fixa de baixo. */}
          <div className="max-lg:hidden lg:col-span-4 lg:text-right">
            <p className="label-caps text-[0.625rem] text-muted">
              {property.purpose === "venda" ? "Valor de venda" : "Aluguel"}
            </p>
            <p className="mt-2 font-display text-[clamp(2.2rem,1.8rem+1.2vw,3rem)] leading-none text-primary tabular">
              {price}
            </p>
          </div>
        </header>

        {/* A galeria é a protagonista, na largura inteira. */}
        <div className="mt-8 md:mt-10">
          <PropertyGallery images={images} title={property.title} />
        </div>

        {specs.length ? (
          <dl className="mt-6 grid grid-cols-2 border-b border-line sm:grid-cols-3 lg:mt-8 lg:flex lg:divide-x lg:divide-line lg:border-t">
            {specs.map((spec) => (
              <div key={spec.label} className="flex flex-col-reverse py-7 pr-6 lg:flex-1 lg:px-8 lg:first:pl-0">
                <dt className="label-caps mt-2.5 text-[0.625rem] text-muted">{spec.label}</dt>
                <dd className="font-display text-[2rem] leading-none text-ink tabular">{spec.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {/* Índice do anúncio: só as seções que este imóvel tem. */}
        <nav aria-label="Seções do anúncio" className="mt-10 lg:mt-12">
          <ul className="-mx-5 flex gap-7 overflow-x-auto px-5 scrollbar-none md:mx-0 md:px-0">
            {sections.map((section) => (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  className="label-caps inline-block py-2 text-[0.6875rem] text-ink-soft transition-colors duration-300 hover:text-ink"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-12 lg:gap-16">
          <div className="min-w-0 space-y-20 lg:col-span-7">
            {paragraphs.length ? (
              <section id="sobre" aria-labelledby="sobre-titulo">
                <p className="eyebrow">Sobre o imóvel</p>
                <h2 id="sobre-titulo" className="mt-4 text-title">
                  {property.property_type?.name ?? "O imóvel"}
                  {place ? ` em ${place}` : ""}
                </h2>
                <DescriptionBlocks blocks={openParagraphs} className="mt-6 max-w-[65ch]" />
                {moreParagraphs.length ? (
                  // <details> nativo: funciona sem JavaScript e o texto segue indexável.
                  <details className="group mt-4 max-w-[65ch]">
                    <summary className="link-line cursor-pointer list-none text-ink [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">Ler a descrição completa</span>
                      <span className="hidden group-open:inline">Mostrar menos</span>
                    </summary>
                    <DescriptionBlocks blocks={moreParagraphs} className="mt-6" />
                  </details>
                ) : null}
              </section>
            ) : null}

            {details.length ? (
              <section id="caracteristicas" aria-labelledby="caracteristicas-titulo">
                <p className="eyebrow">Características</p>
                <h2 id="caracteristicas-titulo" className="mt-4 text-title">Ficha do imóvel</h2>
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

            {property.highlights?.length ? (
              <section id="ambientes" aria-labelledby="ambientes-titulo">
                <p className="eyebrow">Ambientes</p>
                <h2 id="ambientes-titulo" className="mt-4 text-title">Composição</h2>
                <ul className="mt-6 grid gap-x-10 sm:grid-cols-2">
                  {property.highlights.map((item, index) => (
                    <li
                      key={index}
                      className="flex gap-3 break-words border-b border-line py-3.5 text-[0.9375rem] leading-relaxed text-ink-soft [overflow-wrap:anywhere]"
                    >
                      <span aria-hidden className="mt-3 h-px w-3 shrink-0 bg-gold" />
                      {formatListItem(item)}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {canSimulate ? (
              <section id="financiamento" aria-labelledby="financiamento-titulo">
                <p className="eyebrow">Financiamento</p>
                <h2 id="financiamento-titulo" className="mt-4 text-title">Simule a parcela</h2>
                <FinancingSimulator price={property.price as number} className="mt-8" />
              </section>
            ) : null}

            {location ? (
              <section id="localizacao" aria-labelledby="localizacao-titulo">
                <p className="eyebrow">Localização</p>
                <h2 id="localizacao-titulo" className="mt-4 text-title">Onde fica</h2>
                <p className="mt-3 flex items-start gap-2 text-[0.9375rem] text-ink-soft">
                  <PinIcon className="mt-0.5 shrink-0 text-gold" />
                  {property.address || location}
                </p>
                {property.latitude && property.longitude ? (
                  <div className="mt-6 overflow-hidden rounded-[var(--radius-xs)] border border-line bg-surface-alt">
                    <iframe
                      title={`Mapa — ${property.title}`}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="h-[320px] w-full border-0 md:h-[380px]"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${property.longitude - 0.006}%2C${property.latitude - 0.004}%2C${property.longitude + 0.006}%2C${property.latitude + 0.004}&layer=mapnik&marker=${property.latitude}%2C${property.longitude}`}
                    />
                  </div>
                ) : null}
                <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
                  {property.region ? (
                    <Link href={`/regioes/${property.region.slug}`} className="link-line text-ink">
                      Imóveis em {property.region.name}
                      <ArrowRightIcon className="size-3.5" />
                    </Link>
                  ) : null}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      property.latitude && property.longitude
                        ? `${property.latitude},${property.longitude}`
                        : `${property.address || location}, SP`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-line text-ink"
                  >
                    Abrir no Google Maps
                    <ArrowRightIcon className="size-3.5" />
                  </a>
                </div>
              </section>
            ) : null}

            {images.length > 1 ? (
              <section id="galeria" aria-labelledby="galeria-titulo">
                <div className="flex items-end justify-between gap-6">
                  <div>
                    <p className="eyebrow">Galeria</p>
                    <h2 id="galeria-titulo" className="mt-4 text-title">Todas as fotos</h2>
                  </div>
                  <p className="label-caps pb-1 text-[0.625rem] text-muted tabular">
                    {images.length} fotos
                  </p>
                </div>
                <div className="mt-8">
                  <PropertyPhotoGrid images={images} title={property.title} />
                </div>
              </section>
            ) : null}

            {videos.length ? (
              <section id="videos" aria-labelledby="videos-titulo">
                <p className="eyebrow">{videos.length === 1 ? "Vídeo" : "Vídeos"}</p>
                <h2 id="videos-titulo" className="mt-4 text-title">
                  {videos.length === 1 ? "Conheça o imóvel em vídeo" : "O imóvel em vídeo"}
                </h2>
                <div className="mt-8 grid gap-4">
                  {videos.map((url, index) => (
                    // Só baixa o vídeo quando a pessoa toca no play; #t=0.1 mostra o 1º quadro.
                    <video
                      key={url}
                      src={`${url}#t=0.1`}
                      controls
                      preload="metadata"
                      playsInline
                      aria-label={`${property.title} — vídeo ${index + 1}`}
                      className="aspect-video w-full border border-line bg-black"
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {/* ------------------------------------------------------- Lateral */}
          <aside className="min-w-0 lg:col-span-5 xl:col-span-4 xl:col-start-9">
            <div className="sticky top-24 border border-line bg-surface">
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
                    <WhatsAppLeadButton
                      number={settings.contact.whatsapp}
                      propertyId={property.id}
                      propertyCode={property.code}
                      propertyTitle={property.title}
                      size="lg"
                      className="mt-7 w-full"
                    >
                      <WhatsAppIcon />
                      Falar sobre este imóvel
                    </WhatsAppLeadButton>
                    <p className="mt-3 text-center text-xs text-muted">
                      Conversa direta com a Vale do Sol, pelo WhatsApp.
                    </p>
                  </>
                ) : null}
              </div>

              <div className="p-7" id="interesse">
                <p className="eyebrow">Contato</p>
                <h2 className="mt-3 text-2xl">Prefere que a gente entre em contato?</h2>
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
            <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <PropertyCard key={item.id} property={item} variant="spec" />
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
            <WhatsAppLeadButton
              number={settings.contact.whatsapp}
              propertyId={property.id}
              propertyCode={property.code}
              propertyTitle={property.title}
              className="shrink-0 px-4"
            >
              <WhatsAppIcon />
              Tenho interesse
            </WhatsAppLeadButton>
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
