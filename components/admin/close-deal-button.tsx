import { setPropertyStatus } from "@/actions/admin/properties";
import { cn } from "@/lib/utils";
import type { PropertyStatus } from "@/lib/site";

/** Venda → "Vendido", locação → "Alugado"; fechado → "Disponível de novo". */
export function CloseDealButton({
  id,
  status,
  purpose,
  className,
}: {
  id: string;
  status: PropertyStatus;
  purpose: string;
  className?: string;
}) {
  const closed = status === "vendido" || status === "alugado";
  const next = closed ? "disponivel" : purpose === "locacao" ? "alugado" : "vendido";

  return (
    <form action={setPropertyStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      <button
        type="submit"
        className={cn(
          "whitespace-nowrap rounded-[var(--radius-xs)] px-2.5 py-1.5 text-xs transition-colors",
          closed
            ? "text-ink-soft hover:bg-surface-alt"
            : "bg-danger/10 text-danger hover:bg-danger hover:text-white",
          className
        )}
      >
        {closed ? "Disponível de novo" : next === "alugado" ? "Marcar alugado" : "Marcar vendido"}
      </button>
    </form>
  );
}
