import Link from "next/link";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Trilha de navegação. O último item nunca é link — é a página atual.
 * O JSON-LD correspondente é emitido pelas páginas que usam este componente.
 */
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  const crumbs: Crumb[] = [{ label: "Início", href: "/" }, ...items];

  return (
    <nav aria-label="Você está em" className={cn("text-[0.8125rem]", className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {crumb.href && !isLast ? (
                <Link href={crumb.href} className="transition-colors hover:text-ink">
                  {crumb.label}
                </Link>
              ) : (
                <span className={isLast ? "text-ink-soft" : undefined} aria-current={isLast ? "page" : undefined}>
                  {crumb.label}
                </span>
              )}
              {!isLast ? <span aria-hidden>/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** JSON-LD da mesma trilha, para o Google exibir o caminho no resultado. */
export function breadcrumbJsonLd(items: Crumb[], siteUrl: string) {
  const crumbs: Crumb[] = [{ label: "Início", href: "/" }, ...items];

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      ...(crumb.href ? { item: `${siteUrl}${crumb.href}` } : {}),
    })),
  };
}
