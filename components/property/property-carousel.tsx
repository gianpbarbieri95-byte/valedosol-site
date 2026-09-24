"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { PropertyCard } from "@/components/property/property-card";
import type { PropertyCardData } from "@/types/database";

/**
 * Vitrine em trilho horizontal, como na referência aprovada.
 *
 * O trilho é um scroll nativo com scroll-snap: funciona no dedo sem
 * JavaScript nenhum, e as setas são um atalho a mais para quem usa mouse.
 * O próximo card fica meio à mostra de propósito — é o que avisa que a lista
 * continua.
 */
export function PropertyCarousel({
  properties,
  label,
}: {
  properties: PropertyCardData[];
  label: string;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  // Reação ao scroll do trilho, não efeito em cascata: só lê a posição.
  const syncEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    setEdges({ start: track.scrollLeft <= 8, end: track.scrollLeft >= max - 8 });
  }, []);

  const scrollByCard = useCallback((direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector("li");
    const step = card ? card.getBoundingClientRect().width + 24 : track.clientWidth * 0.8;
    track.scrollBy({ left: step * direction, behavior: "smooth" });
  }, []);

  if (!properties.length) return null;

  return (
    <div className="relative">
      <ul
        ref={trackRef}
        onScroll={syncEdges}
        aria-label={label}
        className={cn(
          "flex snap-x snap-mandatory gap-6 overflow-x-auto scrollbar-none",
          // O recuo negativo deixa o trilho sangrar até a borda da tela no
          // celular, sem quebrar o alinhamento do container no desktop.
          "-mx-5 px-5 pb-2 md:-mx-8 md:px-8 xl:mx-0 xl:px-0"
        )}
      >
        {properties.map((property, index) => (
          <li
            key={property.id}
            className="w-[85%] shrink-0 snap-start sm:w-[46%] lg:w-[calc((100%-3rem)/3)]"
          >
            <PropertyCard
              property={property}
              priority={index < 3}
              className="h-full"
              sizes="(min-width: 1280px) 420px, (min-width: 640px) 46vw, 85vw"
            />
          </li>
        ))}
      </ul>

      {properties.length > 3 ? (
        <div className="mt-6 flex items-center gap-2">
          <CarouselArrow
            direction="prev"
            disabled={edges.start}
            onClick={() => scrollByCard(-1)}
          />
          <CarouselArrow direction="next" disabled={edges.end} onClick={() => scrollByCard(1)} />
          <p className="ml-2 text-[0.8125rem] text-muted">
            Arraste para ver os {properties.length}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CarouselArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Imóveis anteriores" : "Próximos imóveis"}
      className={cn(
        "grid size-11 place-items-center rounded-full border border-line-strong bg-surface text-ink",
        "transition-[background-color,border-color,color,opacity] duration-300",
        "hover:border-primary hover:bg-primary hover:text-white",
        "disabled:pointer-events-none disabled:opacity-35"
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
