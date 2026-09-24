"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowRightIcon } from "@/components/ui/icons";

export interface LocalPlace {
  slug: string;
  name: string;
  city: string;
  count: number;
  image: string | null;
}

/**
 * Conhecimento local: a lista das regiões onde a Vale do Sol tem imóveis, e
 * uma janela de foto que acompanha o item em foco (hover ou teclado). Sem
 * mapa embutido — um iframe pesaria mais do que ajuda aqui. No celular, onde
 * não existe hover, fica só a lista, com alvos de toque grandes.
 */
export function LocalKnowledge({
  places,
  office,
}: {
  places: LocalPlace[];
  office: string;
}) {
  const withImage = places.filter((place) => place.image);
  const [active, setActive] = useState(withImage[0]?.slug ?? places[0]?.slug);
  if (!places.length) return null;

  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
      <div className="min-w-0 lg:col-span-6">
        <ul className="border-t border-line">
          {places.map((place, index) => {
            const isActive = place.slug === active;
            return (
              <li key={place.slug} className="border-b border-line">
                <Link
                  href={`/regioes/${place.slug}`}
                  onMouseEnter={() => place.image && setActive(place.slug)}
                  onFocus={() => place.image && setActive(place.slug)}
                  className="group flex items-center gap-5 py-5 md:py-6"
                >
                  <span className="hidden w-6 text-xs text-muted tabular sm:block">{String(index + 1).padStart(2, "0")}</span>
                  {/* No celular não há hover para conduzir a janela de foto:
                      cada linha leva a sua miniatura. */}
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-[var(--radius-xs)] bg-surface-alt lg:hidden">
                    {place.image ? (
                      <Image src={place.image} alt="" fill quality={70} sizes="64px" className="object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-balance font-display text-[1.45rem] leading-tight transition-colors duration-500 md:truncate md:text-[2rem]",
                        // Sem hover no toque: no celular todas as linhas ficam em tom cheio.
                        isActive ? "text-ink" : "text-ink lg:text-ink/55 lg:group-hover:text-ink"
                      )}
                    >
                      {place.name}
                    </span>
                    <span className="label-caps mt-1 block text-[0.625rem] text-muted">
                      {place.city}
                      {place.count ? ` · ${place.count} ${place.count === 1 ? "imóvel" : "imóveis"}` : ""}
                    </span>
                  </span>
                  <ArrowRightIcon
                    className={cn(
                      "size-4 shrink-0 transition-[transform,opacity,color] duration-500",
                      isActive ? "text-primary opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                    )}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-8 text-pretty text-sm leading-relaxed text-ink-soft">{office}</p>
      </div>

      {/* Janela de foto — só no desktop, onde há hover para conduzi-la */}
      <div className="relative hidden lg:col-span-6 lg:block">
        <div className="sticky top-32 aspect-square overflow-hidden rounded-[var(--radius-xs)] bg-primary-deep">
          {withImage.map((place) => (
            <Image
              key={place.slug}
              src={place.image!}
              alt={`Imóvel em ${place.name}`}
              fill
              quality={80}
              sizes="(min-width: 1280px) 600px, 45vw"
              className={cn(
                "object-cover transition-[opacity,transform] duration-[1.1s] ease-[var(--ease-premium)]",
                place.slug === active ? "scale-100 opacity-100" : "scale-[1.04] opacity-0"
              )}
            />
          ))}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#04140b]/75 to-transparent" />
          <div className="absolute inset-x-6 bottom-6 flex items-end justify-between gap-6 text-white">
            <p className="font-display text-[2rem] leading-tight">
              {places.find((place) => place.slug === active)?.name}
            </p>
            <Link href={`/regioes/${active}`} className="link-line shrink-0 text-[0.625rem] text-white">
              Explorar região
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
