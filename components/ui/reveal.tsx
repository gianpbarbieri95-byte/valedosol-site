"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useHydrated, usePrefersReducedMotion } from "@/hooks/use-browser-state";

/**
 * Revelação suave quando o bloco entra na tela.
 *
 * A decisão de animar é tomada na renderização, não dentro de um efeito: no
 * servidor e antes de hidratar o conteúdo já nasce visível, então sem
 * JavaScript ou com prefers-reduced-motion nada fica invisível para sempre.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const hydrated = useHydrated();
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);

  const armed = hydrated && !reducedMotion;

  useEffect(() => {
    const node = ref.current;
    if (!armed || !node || visible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // setState aqui é reação a um sistema externo, não efeito em cascata.
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        // A margem superior gigante faz o que já passou da tela contar como
        // visível. Sem ela, um salto de rolagem (âncora, posição restaurada,
        // fim da página pelo teclado) pula o bloco sem nenhum cruzamento de
        // limiar, e ele fica invisível para sempre.
        // Dispara assim que o bloco encosta na borda de baixo: quem rola
        // rápido não encontra um vão em branco esperando a animação.
        rootMargin: "100000px 0px 0px 0px",
        threshold: 0,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [armed, visible]);

  return (
    <Tag
      ref={ref}
      className={cn(armed && "reveal", className)}
      data-visible={!armed || visible ? "true" : "false"}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
