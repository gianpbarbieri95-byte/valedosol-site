import Image from "next/image";
import Link from "next/link";
import { storageUrl } from "@/lib/supabase/env";
import { STORAGE_BUCKETS } from "@/lib/site";
import { truncate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowRightIcon } from "@/components/ui/icons";
import type { Region } from "@/types/database";

/**
 * Cartão de região, usado na home e na página de regiões.
 *
 * Nem toda região tem foto cadastrada. Em vez de deixar um retângulo verde
 * chapado, o fundo vazio recebe o mesmo degradê quente do sol da marca — é
 * plano de fundo, não uma recriação do logo.
 */
export function RegionCard({
  region,
  count,
  fallbackImagePath,
  description = false,
  className,
  sizes = "(min-width: 1024px) 33vw, (min-width: 640px) 45vw, 100vw",
}: {
  region: Pick<Region, "id" | "name" | "slug" | "city" | "description" | "image_path">;
  count?: number;
  /** Foto de um imóvel da região, usada quando ela não tem foto própria. */
  fallbackImagePath?: string | null;
  description?: boolean;
  className?: string;
  sizes?: string;
}) {
  const image =
    storageUrl(STORAGE_BUCKETS.region, region.image_path) ||
    storageUrl(STORAGE_BUCKETS.property, fallbackImagePath);
  const variante = varianteDoSlug(region.slug);

  return (
    <Link
      href={`/regioes/${region.slug}`}
      className={cn(
        "group relative flex flex-col justify-end overflow-hidden rounded-[var(--radius-md)]",
        "border border-line bg-primary-deep p-6",
        "transition-[box-shadow,transform] duration-500 ease-[var(--ease-premium)]",
        "hover:-translate-y-1 hover:shadow-lift",
        className
      )}
    >
      {image ? (
        <Image
          src={image}
          alt=""
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-[1.2s] ease-[var(--ease-premium)] group-hover:scale-110"
        />
      ) : (
        <>
          <div aria-hidden className={cn("absolute inset-0", FUNDOS[variante])} />
          <div
            aria-hidden
            className={cn(
              "absolute inset-0 transition-opacity duration-700 group-hover:opacity-70",
              BRILHOS[variante]
            )}
          />
        </>
      )}

      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[#06180e]/92 via-[#06180e]/35 to-transparent"
      />

      <div className="relative">
        <p className="text-[0.625rem] uppercase tracking-[0.16em] text-white/65">{region.city}</p>
        <h3 className="mt-1.5 text-2xl text-white">{region.name}</h3>

        {description && region.description ? (
          <p className="mt-2 text-pretty text-sm leading-relaxed text-white/75">
            {truncate(region.description, 110)}
          </p>
        ) : null}

        <p className="mt-3 flex items-center gap-1.5 text-[0.8125rem] text-gold-bright">
          {typeof count === "number" && count > 0 ? (
            <span className="text-white/70 tabular">
              {count} {count === 1 ? "imóvel disponível" : "imóveis disponíveis"}
            </span>
          ) : (
            <span className="transition-[opacity,transform] duration-500 ease-[var(--ease-premium)] translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100">
              Ver imóveis
            </span>
          )}
          <ArrowRightIcon className="size-4 transition-transform duration-500 ease-[var(--ease-premium)] group-hover:translate-x-1" />
        </p>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------- Fundo sem foto */

/**
 * Quatro variações do mesmo degradê verde com o brilho quente do sol da
 * marca, em posições diferentes. Sem isso, duas regiões sem foto lado a lado
 * pareciam dois retângulos quebrados; assim cada cartão tem cara própria e o
 * vazio vira decisão de projeto. As classes são literais porque o Tailwind
 * lê o código-fonte, não valores montados em tempo de execução.
 */
const FUNDOS = [
  "bg-[radial-gradient(130%_105%_at_78%_-5%,#175b30_0%,#0b4423_46%,#062a15_100%)]",
  "bg-[radial-gradient(125%_100%_at_18%_-8%,#186034_0%,#0b4423_50%,#052613_100%)]",
  "bg-[radial-gradient(140%_110%_at_50%_112%,#14532a_0%,#0a3f20_45%,#062a15_100%)]",
  "bg-[radial-gradient(120%_95%_at_88%_58%,#1a6637_0%,#0b4423_48%,#052613_100%)]",
];

const BRILHOS = [
  "bg-[radial-gradient(58%_42%_at_80%_16%,rgba(211,163,63,0.32)_0%,transparent_72%)]",
  "bg-[radial-gradient(52%_40%_at_18%_12%,rgba(211,163,63,0.28)_0%,transparent_70%)]",
  "bg-[radial-gradient(60%_45%_at_50%_92%,rgba(211,163,63,0.26)_0%,transparent_74%)]",
  "bg-[radial-gradient(48%_38%_at_86%_58%,rgba(211,163,63,0.30)_0%,transparent_70%)]",
];

/** Mesma região, sempre o mesmo fundo — servidor e navegador não divergem. */
function varianteDoSlug(slug: string): number {
  let soma = 0;
  for (let i = 0; i < slug.length; i += 1) soma += slug.charCodeAt(i);
  return soma % FUNDOS.length;
}
