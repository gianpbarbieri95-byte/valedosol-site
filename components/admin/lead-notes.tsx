"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/primitives";

/**
 * Anotações internas do contato. Ficam recolhidas para não poluir a lista,
 * e só aparecem quando alguém vai realmente escrever ou ler.
 */
export function LeadNotes({
  id,
  notes,
  action,
}: {
  id: string;
  notes: string | null;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(Boolean(notes));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-xs text-muted transition-colors hover:text-ink-soft"
      >
        + Anotação interna
      </button>
    );
  }

  return (
    <form action={action} className="mt-4 border-t border-line pt-4">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`notas-${id}`} className="mb-1.5 block text-xs font-medium text-ink-soft">
        Anotação interna — não aparece para o cliente
      </label>
      <Textarea
        id={`notas-${id}`}
        name="notes"
        rows={2}
        defaultValue={notes ?? ""}
        placeholder="Ligar na segunda, prefere imóvel térreo…"
      />
      <button
        type="submit"
        className="mt-2 h-9 rounded-[var(--radius-sm)] border border-line px-3 text-xs text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
      >
        Salvar anotação
      </button>
    </form>
  );
}
