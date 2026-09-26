import type { DescriptionBlock } from "@/lib/description";
import { cn } from "@/lib/utils";

/**
 * Descrição já padronizada (ver lib/description.ts). A mesma marcação serve a
 * página do imóvel e a prévia do painel, para a equipe ver exatamente o que vai
 * ao ar.
 */
export function DescriptionBlocks({ blocks, className }: { blocks: DescriptionBlock[]; className?: string }) {
  return (
    <div className={cn("space-y-4 text-pretty text-[1.0625rem] leading-relaxed text-ink-soft", className)}>
      {blocks.map((block, index) =>
        block.type === "paragraph" ? (
          <p key={index}>{block.text}</p>
        ) : (
          <ul key={index} className="space-y-2">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="flex gap-3">
                <span aria-hidden className="mt-[0.8em] h-px w-3 shrink-0 bg-gold" />
                <span className="min-w-0 [overflow-wrap:anywhere]">{item}</span>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
