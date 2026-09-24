import Link from "next/link";
import { cn } from "@/lib/utils";

export interface Shortcut {
  href: string;
  label: string;
  count: number;
}

/**
 * Atalhos por tipo, na faixa logo abaixo da abertura: Casas · Terrenos · Chácaras · Condomínios ·
 * Comerciais · Alugar. A contagem é a real do acervo; atalho sem nenhum
 * imóvel não aparece (reaparece sozinho quando algo for publicado), para
 * ninguém cair numa listagem vazia logo no primeiro clique.
 */
export function Shortcuts({ items, className }: { items: Shortcut[]; className?: string }) {
  const visible = items.filter((item) => item.count > 0);
  if (!visible.length) return null;

  return (
    <nav aria-label="Atalhos por tipo de imóvel" className={cn("min-w-0", className)}>
      <p className="label-caps mb-3 text-[0.625rem] text-muted">Busca rápida</p>
      <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none md:mx-0 md:flex-wrap md:px-0">
        {visible.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              className="group inline-flex h-10 items-center gap-2 rounded-[var(--radius-xs)] border border-line-strong px-4 text-[0.8125rem] text-ink-soft transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-white"
            >
              {item.label}
              <span className="text-[0.6875rem] text-muted tabular transition-colors duration-300 group-hover:text-white/60">
                {item.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
