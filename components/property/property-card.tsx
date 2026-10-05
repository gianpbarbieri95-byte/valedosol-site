import Image from "next/image";
import Link from "next/link";
import { storageUrl } from "@/lib/supabase/env";
import { STORAGE_BUCKETS } from "@/lib/site";
import { formatArea, formatNumber, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge, StatusBadge } from "@/components/ui/primitives";
import { ArrowRightIcon, CameraIcon } from "@/components/ui/icons";
import { FavoriteButton } from "@/components/property/favorite-button";
import type { PropertyCardData } from "@/types/database";

export function propertyCoverUrl(property: Pick<PropertyCardData, "images">): string | null {
  const images = property.images ?? [];
  const cover = images.find((image) => image.is_cover) ?? images[0];
  return storageUrl(STORAGE_BUCKETS.property, cover?.storage_path);
}

/**
 * Card do imóvel.
 *
 * A fotografia é o produto: ocupa a largura inteira, sem véu escuro por cima.
 * O texto fica embaixo, em composição editorial — tipo e local em caixa alta,
 * nome na serifa, medidas numa linha, e o valor fechando com um fio fino.
 * `size="lg"` e `size="xl"` são as versões de vitrine da home; o "xl" é o
 * protagonista em largura total, com o texto em duas colunas.
 */
export function PropertyCard({
  property,
  priority = false,
  className,
  imageClassName = "aspect-[4/3]",
  size = "md",
  sizes = "(min-width: 1280px) 420px, (min-width: 768px) 45vw, 100vw",
  lede,
}: {
  property: PropertyCardData;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  size?: "md" | "lg" | "xl";
  sizes?: string;
  /** Linha de apresentação (ver propertyLede) — só nas versões de vitrine. */
  lede?: string | null;
}) {
  const showcase = size !== "md";
  const cover = propertyCoverUrl(property);
  const area = formatArea(property.area_total ?? property.area_built);
  const bedrooms = formatNumber(property.bedrooms);
  const rooms = formatNumber(property.rooms);
  const parking = formatNumber(property.parking_spaces);

  // No máximo três medidas, numa linha só: o resto está na página do imóvel.
  const features = [
    area ? { value: area, label: "" } : null,
    property.is_commercial
      ? rooms
        ? { value: rooms, label: property.rooms === 1 ? "sala" : "salas" }
        : null
      : bedrooms
        ? { value: bedrooms, label: property.bedrooms === 1 ? "dormitório" : "dormitórios" }
        : null,
    parking ? { value: parking, label: property.parking_spaces === 1 ? "vaga" : "vagas" } : null,
  ].filter(Boolean) as { value: string; label: string }[];

  const place = property.neighborhood || property.city;
  const meta = [property.property_type?.name, place].filter(Boolean).join(" · ");

  return (
    <article className={cn("group relative flex flex-col", className)}>
      <div className={cn("relative overflow-hidden rounded-[var(--radius-xs)] bg-primary-deep", imageClassName)}>
        {cover ? (
          <Image
            src={cover}
            alt={property.images?.[0]?.alt_text || property.title}
            fill
            sizes={sizes}
            priority={priority}
            quality={80}
            className="object-cover transition-[transform,filter] duration-700 ease-[var(--ease-premium)] group-hover:scale-[1.035] group-hover:contrast-[1.06]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <p className="flex items-center gap-2 text-white/50">
              <CameraIcon className="size-4" />
              <span className="label-caps text-[0.625rem]">Fotos em breve</span>
            </p>
          </div>
        )}

        {/* Véu levíssimo no hover: a foto "acende" o card sem mudar de lugar */}
        <span
          aria-hidden
          className="absolute inset-0 bg-[#06180e]/0 transition-colors duration-700 group-hover:bg-[#06180e]/6"
        />

        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
          {property.is_featured ? <Badge tone="gold">Destaque</Badge> : null}
          <StatusBadge status={property.status} />
        </div>

        <div className="absolute right-3 top-3 z-10">
          <FavoriteButton propertyId={property.id} title={property.title} />
        </div>
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col",
          size === "xl" ? "pt-7 md:grid md:grid-cols-12 md:items-end md:gap-12 md:pt-9" : size === "lg" ? "pt-6" : "pt-5"
        )}
      >
        <div className={size === "xl" ? "md:col-span-7" : undefined}>
          {meta ? <p className="label-caps truncate text-[0.625rem] text-gold">{meta}</p> : null}

          <h3
            className={cn(
              "mt-2 text-pretty leading-[1.08] text-ink",
              size === "xl"
                ? "text-[clamp(2rem,1.4rem+2vw,3.25rem)] md:mt-3"
                : size === "lg"
                  ? "text-[clamp(1.75rem,1.3rem+1.3vw,2.4rem)]"
                  : "line-clamp-2 text-[1.6rem]"
            )}
          >
            {/* O link cobre o card inteiro: alvo grande no toque, um só foco no teclado. */}
            <Link
              href={`/imoveis/${property.slug}`}
              className="after:absolute after:inset-0 after:z-[5] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-primary"
            >
              {property.title}
            </Link>
          </h3>

          {features.length ? (
            <ul className="mt-3 flex flex-wrap items-center gap-y-1 text-[0.8125rem] text-ink-soft">
              {features.map((feature, index) => (
                <li key={feature.value + feature.label} className="flex items-center whitespace-nowrap">
                  {index > 0 ? <span aria-hidden className="mx-2.5 h-3 w-px bg-line-strong" /> : null}
                  <span className="tabular">{feature.value}</span>
                  {feature.label ? <span className="ml-1">{feature.label}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}

          {showcase && lede ? (
            <p
              className={cn(
                "mt-4 max-w-xl text-pretty leading-relaxed text-ink-soft",
                size === "xl" ? "text-[1.0625rem] md:text-lg" : "line-clamp-2 text-[0.9375rem]"
              )}
            >
              {lede}
            </p>
          ) : null}
        </div>

        <div className={cn("mt-auto pt-5", size === "xl" && "md:col-span-5 md:pt-0")}>
          <div className="flex items-end justify-between gap-4 border-t border-line pt-4">
            <p
              className={cn(
                "font-display leading-none text-primary tabular",
                size === "xl" ? "text-[2.25rem]" : size === "lg" ? "text-[1.9rem]" : "text-[1.5rem]"
              )}
            >
              {formatPrice(property.price, {
                purpose: property.purpose,
                onRequest: property.price_on_request,
              })}
            </p>
            {/* Na vitrine o convite fica sempre à vista. Nas listagens, com
                mouse ele aparece no hover; no toque fica sempre visível. */}
            <span
              aria-hidden
              className={cn(
                "link-line shrink-0 text-[0.625rem] text-ink",
                !showcase &&
                  "transition-[opacity,transform] duration-500 ease-[var(--ease-premium)] [@media(hover:hover)]:-translate-x-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-x-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100"
              )}
            >
              {showcase ? "Explorar imóvel" : "Conhecer imóvel"}
              <ArrowRightIcon className="size-3.5" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
