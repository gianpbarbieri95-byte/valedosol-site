/**
 * Transição entre páginas.
 *
 * `template.tsx` remonta a cada navegação — é o gancho certo para uma
 * entrada suave. A animação é CSS puro, com `backwards` (ver globals.css),
 * então nunca depende de JavaScript para o conteúdo aparecer, e o bloco de `prefers-reduced-motion`
 * em globals.css a reduz a zero para quem pediu menos movimento.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
