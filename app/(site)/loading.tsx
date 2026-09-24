import { Skeleton } from "@/components/ui/primitives";

/** Esqueleto neutro: ocupa o espaço da página sem fingir um conteúdo. */
export default function SiteLoading() {
  return (
    <div className="container-site py-14">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-8 h-12 w-3/4 max-w-xl" />
      <Skeleton className="mt-4 h-5 w-2/3 max-w-lg" />

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
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
    </div>
  );
}
