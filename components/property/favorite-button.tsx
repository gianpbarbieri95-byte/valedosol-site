"use client";

import { useFavorites } from "@/hooks/use-favorites";
import { HeartIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";

export function FavoriteButton({
  propertyId,
  title,
  variant = "overlay",
  className,
}: {
  propertyId: string;
  title: string;
  variant?: "overlay" | "inline";
  className?: string;
}) {
  const { ids, ready, toggle } = useFavorites();
  const isFavorite = ids.includes(propertyId);

  return (
    <button
      type="button"
      // z-10 tira o botão de baixo do link que cobre o card inteiro.
      className={cn(
        "relative z-10 grid place-items-center transition-[background-color,color,transform] duration-200",
        "active:scale-95",
        variant === "overlay"
          ? "size-9 rounded-full bg-surface/90 text-ink-soft shadow-subtle backdrop-blur-sm hover:bg-surface hover:text-danger"
          : "size-11 rounded-[var(--radius-sm)] border border-line bg-surface text-ink-soft hover:border-line-strong hover:text-danger",
        isFavorite && "text-danger",
        className
      )}
      aria-pressed={ready ? isFavorite : undefined}
      aria-label={isFavorite ? `Remover ${title} dos favoritos` : `Salvar ${title} nos favoritos`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggle(propertyId).then((saved) => {
          if (saved) track("favorite_property", { property_id: propertyId });
        });
      }}
    >
      <HeartIcon filled={ready && isFavorite} className="size-5" />
    </button>
  );
}
