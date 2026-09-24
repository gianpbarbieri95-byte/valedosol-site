import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

/**
 * Paginação com links de verdade (<a href>), não carregamento infinito:
 * cada página de resultado precisa existir numa URL para ser rastreada.
 */
export function Pagination({
  page,
  pageCount,
  buildHref,
  className,
}: {
  page: number;
  pageCount: number;
  buildHref: (page: number) => string;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  const pages = pageRange(page, pageCount);

  const itemClass =
    "grid h-10 min-w-10 place-items-center rounded-[var(--radius-sm)] px-3 text-sm transition-colors";

  return (
    <nav aria-label="Paginação" className={cn("flex items-center justify-center gap-1.5", className)}>
      {page > 1 ? (
        <Link href={buildHref(page - 1)} rel="prev" aria-label="Página anterior" className={cn(itemClass, "border border-line text-ink-soft hover:border-line-strong hover:text-ink")}>
          <ChevronLeftIcon className="size-4" />
        </Link>
      ) : null}

      {pages.map((item, index) =>
        item === "…" ? (
          <span key={`gap-${index}`} className="px-1 text-sm text-muted" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={item}
            href={buildHref(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              itemClass,
              item === page
                ? "bg-primary text-white"
                : "border border-line text-ink-soft hover:border-line-strong hover:text-ink"
            )}
          >
            {item}
          </Link>
        )
      )}

      {page < pageCount ? (
        <Link href={buildHref(page + 1)} rel="next" aria-label="Próxima página" className={cn(itemClass, "border border-line text-ink-soft hover:border-line-strong hover:text-ink")}>
          <ChevronRightIcon className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}

/** 1 … 4 5 6 … 20 — sempre com a primeira, a última e as vizinhas. */
function pageRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((n) => pages.add(n));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((n) => pages.add(n));

  const sorted = [...pages].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);

  const result: (number | "…")[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push("…");
    result.push(page);
    previous = page;
  }
  return result;
}
