"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * Exclusão em dois passos.
 *
 * O botão não apaga no primeiro clique: ele abre uma confirmação que exige
 * digitar EXCLUIR. Imóvel apagado leva junto as fotos e o histórico, e não
 * há como desfazer — arquivar costuma ser o que a pessoa realmente quer.
 */
export function DeletePropertyButton({ title }: { title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Excluir imóvel
      </Button>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-[var(--radius-sm)] border border-danger/30 bg-[#fbf0ef] p-4">
      <p className="text-sm font-medium text-danger">Excluir “{title}”?</p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
        As fotos e o histórico deste imóvel serão apagados e não há como recuperar. Se ele foi
        vendido ou alugado, prefira mudar a publicação para <strong>Arquivado</strong>.
      </p>

      <label htmlFor="confirmar-exclusao" className="mt-3 block text-xs text-ink-soft">
        Digite EXCLUIR para confirmar
      </label>
      <input
        id="confirmar-exclusao"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        autoComplete="off"
        className="mt-1 h-9 w-full rounded-[var(--radius-xs)] border border-line bg-surface px-3 text-sm"
      />

      <div className="mt-3 flex gap-2">
        <ConfirmButton disabled={typed.trim().toUpperCase() !== "EXCLUIR"} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setConfirming(false);
            setTyped("");
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function ConfirmButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="danger" size="sm" disabled={disabled || pending}>
      {pending ? "Excluindo…" : "Excluir definitivamente"}
    </Button>
  );
}
