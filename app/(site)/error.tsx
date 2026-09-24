"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Erro inesperado numa página pública.
 *
 * O visitante lê uma frase em português e recebe um caminho de saída.
 * O detalhe técnico vai para o console do servidor — nunca para a tela.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro na página pública:", error);
  }, [error]);

  return (
    <div className="container-site flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow">Algo saiu do lugar</p>
      <h1 className="mt-4 max-w-xl text-balance text-3xl leading-tight md:text-[2.5rem]">
        Não conseguimos carregar esta página agora.
      </h1>
      <p className="mt-4 max-w-md text-pretty leading-relaxed text-ink-soft">
        Pode ter sido uma falha momentânea. Tente de novo — se continuar, fale com a gente pelo
        telefone ou pelo WhatsApp.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Tentar novamente</Button>
        <ButtonLink href="/imoveis" variant="outline">
          Ver imóveis
        </ButtonLink>
        <ButtonLink href="/contato" variant="ghost">
          Falar com a Vale do Sol
        </ButtonLink>
      </div>

      {error.digest ? (
        <p className="mt-10 text-xs text-muted">
          Código do erro: <Link href="/contato" className="underline-offset-4 hover:underline">{error.digest}</Link>
        </p>
      ) : null}
    </div>
  );
}
