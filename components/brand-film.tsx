"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  useHydrated,
  usePrefersReducedMotion,
} from "@/hooks/use-browser-state";
import {
  CloseIcon,
  ExpandIcon,
  PauseIcon,
  PlayIcon,
} from "@/components/ui/icons";

/**
 * O filme institucional ("O sol sobre Arujá"), mudo e em loop, em dois usos:
 *
 * - `BrandFilm`: a janela da hero. Abre com o pôster (quadro do título,
 *   servido pelo next/image para contar como LCP rápido) e só depois baixa a
 *   versão leve do vídeo, que entra por cima com um fade quando começa a
 *   tocar. Toca enquanto está na tela e pausa fora dela.
 * - `WatchFilmButton` / o botão "Assistir" da janela: abrem o filme inteiro,
 *   em 1080p e desde o início, num visor de tela cheia com controles.
 *
 * Quem pediu menos movimento no sistema ou economia de dados vê só o pôster,
 * com o botão de assistir. O botão de pausa é obrigatório: é movimento
 * automático com mais de 5s.
 */

export interface FilmSources {
  /** Versão leve, usada na janela em loop. */
  src: string;
  /** Versão completa, usada no visor de tela cheia. */
  fullSrc: string;
  poster: string;
  /** Tudo o que aparece escrito no vídeo, para leitores de tela. */
  transcript: string[];
  /** Duração, em segundos, mostrada no botão de assistir. */
  duration: number;
}

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

/** Economia de dados ligada no celular (Chrome/Android). */
function useSaveData(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => Boolean((navigator as NavigatorWithConnection).connection?.saveData),
    () => false,
  );
}

export function BrandFilm({
  film,
  className,
}: {
  film: FilmSources;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hydrated = useHydrated();
  const reducedMotion = usePrefersReducedMotion();
  const saveData = useSaveData();
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // O vídeo só existe depois de hidratar e fora dos modos econômicos: no
  // servidor e na primeira pintura a janela é só o pôster.
  const autoplay = hydrated && !reducedMotion && !saveData;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !autoplay || userPaused || dialogOpen) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // play() rejeita quando o navegador bloqueia; o pôster continua ali.
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.35 },
    );

    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [autoplay, userPaused, dialogOpen]);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setUserPaused(false);
      video.play().catch(() => {});
    } else {
      setUserPaused(true);
      video.pause();
    }
  }

  return (
    <figure
      className={cn(
        "group relative isolate overflow-hidden rounded-[var(--radius-sm)] bg-primary-deep",
        "shadow-[0_50px_100px_-40px_rgba(0,0,0,0.8)] ring-1 ring-white/10",
        className,
      )}
    >
      <div className="relative aspect-video">
        <Image
          src={film.poster}
          alt=""
          fill
          priority
          quality={85}
          sizes="(min-width: 1024px) 58vw, 100vw"
          className="object-cover"
        />

        {autoplay ? (
          <video
            ref={videoRef}
            src={film.src}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className={cn(
              "absolute inset-0 size-full object-cover transition-opacity duration-700",
              playing ? "opacity-100" : "opacity-0",
            )}
          />
        ) : null}

        {/* Fio dourado interno: a moldura lê como janela, não como card. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(211,163,63,0.14)]"
        />
      </div>

      <figcaption className="sr-only">
        Vídeo de apresentação da Vale do Sol Imóveis, sem som.{" "}
        {film.transcript.join(" ")}
      </figcaption>

      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 md:inset-x-4 md:bottom-4">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-pill bg-black/40 py-2 pl-2.5 pr-3.5 text-[0.8125rem] font-medium text-white backdrop-blur-md transition-colors duration-200 hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-bright"
        >
          <span className="grid size-6 place-items-center rounded-full bg-gold-bright text-primary-deep">
            <ExpandIcon className="size-3.5" />
          </span>
          Assistir · {film.duration}s
        </button>

        {autoplay ? (
          <button
            type="button"
            onClick={toggle}
            aria-label={
              playing
                ? "Pausar o vídeo de apresentação"
                : "Reproduzir o vídeo de apresentação"
            }
            className="grid size-9 shrink-0 place-items-center rounded-full bg-black/40 text-white/90 backdrop-blur-md transition-colors duration-200 hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-bright"
          >
            {playing ? (
              <PauseIcon className="size-4" />
            ) : (
              <PlayIcon className="size-4" />
            )}
          </button>
        ) : null}
      </div>

      {dialogOpen ? (
        <FilmDialog film={film} onClose={() => setDialogOpen(false)} />
      ) : null}
    </figure>
  );
}

/** Telas largas recebem a versão 1080p; o resto, a leve. */
function useWideScreen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(min-width: 1280px)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 1280px)").matches,
    () => false,
  );
}

/**
 * O filme como fundo da abertura. Mesmos arquivos, mesmo comportamento da
 * janela (pôster primeiro, vídeo por cima quando começa a tocar, pausa fora
 * da tela, nada em modo econômico) — só a moldura muda: ocupa a área toda.
 * A ordem das camadas: filme (com `overlay`, os degradês de leitura), o
 * conteúdo da abertura (`children`) e, por cima de tudo, os controles —
 * numa faixa que não captura cliques, para não cobrir os botões do texto.
 */
export function HeroFilm({
  film,
  className,
  overlay,
  controlsClassName,
  children,
}: {
  film: FilmSources;
  className?: string;
  overlay?: React.ReactNode;
  controlsClassName?: string;
  children?: React.ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hydrated = useHydrated();
  const reducedMotion = usePrefersReducedMotion();
  const saveData = useSaveData();
  const wide = useWideScreen();
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const autoplay = hydrated && !reducedMotion && !saveData;
  const src = wide ? film.fullSrc : film.src;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !autoplay || userPaused || dialogOpen) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.2 },
    );

    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [autoplay, userPaused, dialogOpen, src]);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setUserPaused(false);
      video.play().catch(() => {});
    } else {
      setUserPaused(true);
      video.pause();
    }
  }

  return (
    <>
      <figure
        className={cn(
          "relative isolate overflow-hidden bg-primary-deep",
          className,
        )}
      >
        <Image
          src={film.poster}
          alt=""
          fill
          priority
          quality={85}
          sizes="100vw"
          className="object-cover"
        />

        {autoplay ? (
          <video
            key={src}
            ref={videoRef}
            src={src}
            muted
            loop
            playsInline
            preload="none"
            aria-hidden="true"
            onPlaying={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className={cn(
              "absolute inset-0 size-full object-cover transition-opacity duration-1000",
              playing ? "opacity-100" : "opacity-0",
            )}
          />
        ) : null}

        {overlay}

        <figcaption className="sr-only">
          Vídeo de apresentação da Vale do Sol Imóveis, sem som.{" "}
          {film.transcript.join(" ")}
        </figcaption>
      </figure>

      {children}

      <div
        className={cn("pointer-events-none absolute z-20", controlsClassName)}
      >
        <div className="flex items-center justify-end gap-2 lg:mx-auto lg:max-w-[82.5rem] lg:px-10 xl:max-w-[90rem] xl:px-16 [&>*]:pointer-events-auto">
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-pill bg-black/30 pl-1.5 pr-3.5 text-[0.75rem] text-white/90 backdrop-blur-md transition-colors duration-300 hover:bg-black/55 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-bright"
          >
            <span className="grid size-6 place-items-center rounded-full bg-white/90 text-primary-deep">
              <PlayIcon className="size-3 translate-x-px" />
            </span>
            Assistir ao filme · {film.duration}s
          </button>

          {autoplay ? (
            <button
              type="button"
              onClick={toggle}
              aria-label={
                playing
                  ? "Pausar o vídeo de apresentação"
                  : "Reproduzir o vídeo de apresentação"
              }
              className="grid size-9 place-items-center rounded-full bg-black/30 text-white/90 backdrop-blur-md transition-colors duration-300 hover:bg-black/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-bright"
            >
              {playing ? (
                <PauseIcon className="size-3.5" />
              ) : (
                <PlayIcon className="size-3.5" />
              )}
            </button>
          ) : null}
        </div>
      </div>

      {dialogOpen ? (
        <FilmDialog film={film} onClose={() => setDialogOpen(false)} />
      ) : null}
    </>
  );
}

/** Botão de texto que abre o filme inteiro em tela cheia. */
export function WatchFilmButton({
  film,
  className,
}: {
  film: FilmSources;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <span className="grid size-11 place-items-center rounded-full border border-white/30 transition-colors duration-300 group-hover:border-gold-bright group-hover:text-gold-bright">
          <PlayIcon className="size-3.5 translate-x-px" />
        </span>
        Assistir à apresentação
        <span className="text-white/50 tabular">({film.duration}s)</span>
      </button>
      {open ? <FilmDialog film={film} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/**
 * Visor de tela cheia. Vai para o <body> por portal: qualquer ancestral com
 * transform ou filtro viraria a referência do position: fixed.
 */
function FilmDialog({
  film,
  onClose,
}: {
  film: FilmSources;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Quem abre passa uma função nova a cada renderização; a ref evita que o
  // efeito abaixo (trava de rolagem e foco) reinicie por causa disso.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Apresentação da Vale do Sol Imóveis"
      className="fade-in fixed inset-0 z-[80] flex items-center justify-center bg-[#030a06]/95 p-4 backdrop-blur-sm md:p-10"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Fechar a apresentação"
        className="absolute right-4 top-4 grid size-11 place-items-center rounded-full border border-white/20 text-white transition-colors hover:bg-white/10 md:right-6 md:top-6"
      >
        <CloseIcon className="size-5" />
      </button>

      <video
        src={film.fullSrc}
        poster={film.poster}
        autoPlay
        muted
        controls
        playsInline
        className="max-h-full w-full max-w-6xl rounded-[var(--radius-md)] bg-black shadow-2xl"
      />
    </div>,
    document.body,
  );
}
