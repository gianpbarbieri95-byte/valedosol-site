"use client";

import { useSyncExternalStore } from "react";

/**
 * Leitores de estado do navegador.
 *
 * São coisas que não existem no servidor — rolagem, preferência de animação,
 * hidratação. useSyncExternalStore é a API do React para isso: assina a fonte
 * externa e devolve o valor já consistente entre servidor e cliente, sem
 * setState dentro de efeito (que causa renderização em cascata).
 */

function subscribeToEvent(target: Window | MediaQueryList, event: string) {
  return (onChange: () => void) => {
    target.addEventListener(event, onChange);
    return () => target.removeEventListener(event, onChange);
  };
}

const noopSubscribe = () => () => {};

/** false no servidor e na primeira renderização; true depois de hidratar. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/** true quando a página já saiu do topo — usado pelo cabeçalho fixo. */
export function useScrolled(threshold = 8): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("scroll", onChange, { passive: true });
      return () => window.removeEventListener("scroll", onChange);
    },
    () => window.scrollY > threshold,
    () => false
  );
}

/** Respeita quem pediu menos animação no sistema operacional. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      return subscribeToEvent(query, "change")(onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}
