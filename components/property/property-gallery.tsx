"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, ExpandIcon } from "@/components/ui/icons";

export interface GalleryImage {
  url: string;
  alt: string;
}

/**
 * Galeria do imóvel.
 *
 * Desktop: mosaico editorial — uma foto grande sustentando duas menores.
 * Mobile: carrossel horizontal com swipe nativo (scroll-snap), sem lib.
 * Em ambos, clicar abre o visor em tela cheia, navegável pelo teclado.
 */
/** Contador no formato do visor: 01 / 36. */
function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function PropertyGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const total = images.length;

  const go = useCallback((next: number) => setIndex(((next % total) + total) % total), [total]);

  const open = useCallback((at: number) => {
    setIndex(at);
    setFullscreen(true);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
      if (event.key === "ArrowRight") go(index + 1);
      if (event.key === "ArrowLeft") go(index - 1);
      if (event.key === "Home") setIndex(0);
      if (event.key === "End") setIndex(total - 1);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen, index, go, total]);

  // Mantém a miniatura ativa sempre visível na tira inferior do visor.
  useEffect(() => {
    if (!fullscreen) return;
    thumbsRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [fullscreen, index]);

  if (!total) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-[var(--radius-md)] border border-dashed border-line-strong bg-surface-alt">
        <span className="text-xs uppercase tracking-[0.14em] text-muted">Fotos em breve</span>
      </div>
    );
  }

  const current = images[index];
  // Com cinco fotos ou mais, o mosaico é uma grande e quatro menores; com
  // menos, uma grande e até duas de apoio.
  const wide = total >= 5;
  const mosaic = images.slice(0, wide ? 5 : 3);
  const hidden = total - mosaic.length;

  return (
    <>
      {/* ---------------------------------------------- Mosaico (desktop) */}
      <div
        className={cn(
          "hidden overflow-hidden rounded-[var(--radius-xs)] md:grid md:gap-1.5",
          mosaic.length === 1 ? "md:grid-cols-1" : wide ? "md:grid-cols-[1.35fr_1fr]" : "md:grid-cols-[1.75fr_1fr]"
        )}
      >
        <GalleryTile
          image={mosaic[0]}
          onClick={() => open(0)}
          priority
          sizes={wide ? "(min-width: 1440px) 760px, 55vw" : "(min-width: 1280px) 800px, 60vw"}
          className={mosaic.length > 1 ? (wide ? "aspect-[4/3] lg:aspect-[3/2]" : "aspect-[4/3]") : "aspect-[16/9]"}
          label="Ampliar foto 1"
        />

        {mosaic.length > 1 ? (
          <div className={cn("grid gap-1.5", wide && "grid-cols-2 grid-rows-2")}>
            {mosaic.slice(1).map((image, i) => {
              const last = i === mosaic.length - 2 && hidden > 0;
              return (
                <GalleryTile
                  key={image.url}
                  image={image}
                  onClick={() => open(i + 1)}
                  sizes={wide ? "(min-width: 1440px) 280px, 20vw" : "(min-width: 1280px) 420px, 30vw"}
                  className="h-full min-h-0"
                  label={last ? `Ver todas as ${total} fotos` : `Ampliar foto ${i + 2}`}
                  overlay={last ? `+${hidden} fotos` : undefined}
                />
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Contagem real de fotos e acesso ao visor completo */}
      <div className="mt-3 hidden items-center justify-between md:flex">
        <p className="text-[0.8125rem] text-muted">
          {total === 1 ? "1 foto" : `${total} fotos`} deste imóvel
        </p>
        <button
          type="button"
          onClick={() => open(0)}
          className="link-line text-ink"
        >
          <ExpandIcon className="size-4" />
          Ver todas as fotos
        </button>
      </div>

      {/* ------------------------------------------------------- Mobile */}
      <div className="md:hidden">
        <div
          className="-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-2 scrollbar-none"
          onScroll={(event) => {
            const el = event.currentTarget;
            const width = el.clientWidth * 0.9;
            setIndex(Math.min(total - 1, Math.round(el.scrollLeft / width)));
          }}
        >
          {images.map((image, i) => (
            <button
              key={image.url}
              type="button"
              onClick={() => open(i)}
              className="relative aspect-[4/3] w-[90%] shrink-0 snap-center overflow-hidden rounded-[var(--radius-sm)] bg-surface-alt"
              aria-label={`Ampliar foto ${i + 1} de ${total}`}
            >
              <Image
                src={image.url}
                alt={image.alt}
                fill
                priority={i === 0}
                quality={80}
                sizes="90vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted tabular" aria-label={`Foto ${index + 1} de ${total}`}>
            {pad(index + 1)} / {pad(total)}
          </p>
          <button
            type="button"
            onClick={() => open(index)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary"
          >
            <ExpandIcon className="size-4" />
            Ver em tela cheia
          </button>
        </div>
      </div>

      {/* --------------------------------------------------- Tela cheia */}
      {fullscreen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Fotos — ${title}`}
          className="fade-in fixed inset-0 z-[70] flex flex-col bg-[#060f0b]"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0].clientX;
          }}
          onTouchEnd={(event) => {
            const start = touchStartX.current;
            if (start === null) return;
            const delta = event.changedTouches[0].clientX - start;
            if (Math.abs(delta) > 48) go(delta < 0 ? index + 1 : index - 1);
            touchStartX.current = null;
          }}
        >
          <div className="flex items-center justify-between gap-4 px-5 py-4 text-white">
            <div className="min-w-0">
              <p className="truncate text-sm text-white/85">{title}</p>
              <p className="mt-0.5 text-xs tracking-[0.12em] text-white/55 tabular" aria-label={`Foto ${index + 1} de ${total}`}>
                {pad(index + 1)} <span className="text-white/30">/</span> {pad(total)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              aria-label="Fechar"
              autoFocus
              className="grid size-10 shrink-0 place-items-center rounded-full border border-white/20 transition-colors hover:bg-white/10"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>

          <div className="relative flex-1">
            <Image
              key={current.url}
              src={current.url}
              alt={current.alt}
              fill
              quality={90}
              sizes="100vw"
              className="fade-in object-contain"
            />

            {total > 1 ? (
              <>
                <ViewerArrow side="left" onClick={() => go(index - 1)} />
                <ViewerArrow side="right" onClick={() => go(index + 1)} />
              </>
            ) : null}
          </div>

          {total > 1 ? (
            <div
              ref={thumbsRef}
              className="flex gap-2 overflow-x-auto px-5 py-4 scrollbar-none"
              aria-label="Miniaturas"
            >
              {images.map((image, i) => (
                <button
                  key={image.url}
                  type="button"
                  onClick={() => setIndex(i)}
                  data-active={i === index ? "true" : undefined}
                  aria-current={i === index ? "true" : undefined}
                  aria-label={`Foto ${i + 1}`}
                  className={cn(
                    "relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-[var(--radius-xs)]",
                    "transition-[opacity,box-shadow] duration-300",
                    i === index
                      ? "opacity-100 ring-2 ring-gold-bright"
                      : "opacity-45 hover:opacity-80"
                  )}
                >
                  <Image src={image.url} alt="" fill quality={70} sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------- Auxiliares */

function GalleryTile({
  image,
  onClick,
  label,
  sizes,
  className,
  priority = false,
  overlay,
}: {
  image: GalleryImage;
  onClick: () => void;
  label: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  /** Texto sobre a foto — "+12 fotos" na última miniatura do mosaico. */
  overlay?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn("group relative block w-full overflow-hidden bg-surface-alt", className)}
    >
      <Image
        src={image.url}
        alt={image.alt}
        fill
        priority={priority}
        quality={85}
        sizes={sizes}
        className="object-cover transition-transform duration-[1.2s] ease-[var(--ease-premium)] group-hover:scale-105"
      />
      <span
        aria-hidden
        className="absolute inset-0 bg-[#06180e]/0 transition-colors duration-500 group-hover:bg-[#06180e]/12"
      />
      {overlay ? (
        <span className="absolute inset-0 grid place-items-center bg-[#06180e]/45 transition-colors duration-500 group-hover:bg-[#06180e]/60">
          <span className="label-caps text-white">{overlay}</span>
        </span>
      ) : null}
    </button>
  );
}

function ViewerArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Foto anterior" : "Próxima foto"}
      className={cn(
        "absolute top-1/2 hidden -translate-y-1/2 place-items-center rounded-full sm:grid",
        "size-12 border border-white/20 text-white backdrop-blur-sm",
        "transition-[background-color,transform] duration-300 hover:bg-white/15",
        side === "left" ? "left-4 hover:-translate-x-0.5 hover:-translate-y-1/2" : "right-4 hover:translate-x-0.5 hover:-translate-y-1/2"
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}
