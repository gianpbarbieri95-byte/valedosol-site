"use client";

import { useEffect, useState } from "react";
import { useFavorites } from "@/hooks/use-favorites";
import { fetchPropertiesByIds } from "@/actions/properties";
import { PropertyCard } from "@/components/property/property-card";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import type { PropertyCardData } from "@/types/database";

/**
 * Os favoritos moram no navegador, então a lista só pode ser montada no
 * cliente. O servidor devolve apenas os imóveis publicados desses ids.
 */
export function FavoritesList() {
  const { ids, ready, isSignedIn } = useFavorites();
  const [properties, setProperties] = useState<PropertyCardData[] | null>(null);

  // O caso "nenhum favorito" é resolvido na renderização, logo abaixo: assim
  // o efeito só roda quando há realmente algo a buscar e nenhum setState
  // acontece de forma síncrona dentro dele.
  useEffect(() => {
    if (!ready || ids.length === 0) return;

    let active = true;
    fetchPropertiesByIds(ids)
      .then((data) => {
        if (!active) return;
        // Mantém a ordem em que o visitante salvou.
        const byId = new Map(data.map((property) => [property.id, property]));
        setProperties(ids.map((id) => byId.get(id)).filter(Boolean) as PropertyCardData[]);
      })
      .catch(() => active && setProperties([]));

    return () => {
      active = false;
    };
  }, [ids, ready]);

  if (ready && ids.length === 0) {
    return (
      <EmptyState
        title="Você ainda não salvou nenhum imóvel"
        description="Toque no coração de qualquer imóvel para guardá-lo aqui e comparar com calma depois."
        action={<ButtonLink href="/imoveis">Ver imóveis disponíveis</ButtonLink>}
      />
    );
  }

  if (!ready || properties === null) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="overflow-hidden rounded-[var(--radius-md)] border border-line">
            <Skeleton className="aspect-[4/3] rounded-none" />
            <div className="space-y-3 p-5">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <EmptyState
        title="Os imóveis que você salvou saíram do ar"
        description="Eles podem ter sido vendidos, alugados ou retirados do site. Temos outros disponíveis."
        action={<ButtonLink href="/imoveis">Ver imóveis disponíveis</ButtonLink>}
      />
    );
  }

  const missing = ids.length - properties.length;

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>

      {missing > 0 ? (
        <p className="mt-8 text-sm text-muted">
          {missing === 1
            ? "Um imóvel salvo saiu do ar e não aparece mais aqui."
            : `${missing} imóveis salvos saíram do ar e não aparecem mais aqui.`}
        </p>
      ) : null}

      {!isSignedIn ? (
        <p className="mt-8 rounded-[var(--radius-sm)] border border-line bg-surface px-5 py-4 text-sm text-ink-soft">
          Seus favoritos estão salvos apenas neste navegador. Se limpar os dados ou trocar de
          aparelho, a lista se perde.
        </p>
      ) : null}
    </>
  );
}
