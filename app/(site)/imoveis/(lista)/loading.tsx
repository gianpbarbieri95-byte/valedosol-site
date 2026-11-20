import { Skeleton } from "@/components/ui/primitives";

/**
 * Esqueleto da listagem.
 *
 * Reproduz o formato real da página — cabeçalho, coluna de filtros e grade de
 * cards — para que trocar um filtro não pareça a página sumindo. Não desenha
 * conteúdo falso: são só blocos vazios com o peso certo.
 */
export default function PropertiesLoading() {
  return (
    <div className="container-site py-10 md:py-14">
      <Skeleton className="h-3 w-40" />

      <div className="mt-6 flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-4 h-10 w-56" />
          <Skeleton className="mt-4 h-4 w-40" />
        </div>
        <Skeleton className="h-11 w-full rounded-[var(--radius-sm)] md:w-96" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[19rem_1fr] lg:gap-10">
        <Skeleton className="hidden h-[32rem] rounded-[var(--radius-md)] lg:block" />

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface"
            >
              <Skeleton className="aspect-[4/3] rounded-none" />
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
