"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { FormState } from "@/lib/validations/lead";

/** Botão que sabe sozinho quando o formulário está sendo enviado. */
export function SubmitButton({
  children,
  className,
  size = "lg",
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size={size} disabled={pending || disabled} className={className} aria-busy={pending}>
      {pending ? "Enviando…" : children}
    </Button>
  );
}

/** Retorno do envio, anunciado também para leitores de tela. */
export function FormMessage({ state, className }: { state: FormState; className?: string }) {
  if (state.status === "idle" || !state.message) return null;

  const isSuccess = state.status === "success";

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 rounded-[var(--radius-sm)] border px-4 py-3 text-sm",
        isSuccess
          ? "border-primary/20 bg-primary-soft text-primary"
          : "border-danger/20 bg-[#fbf0ef] text-danger",
        className
      )}
    >
      {isSuccess ? <CheckIcon className="mt-0.5 size-4 shrink-0" /> : null}
      <span>{state.message}</span>
    </p>
  );
}

/**
 * Campo-armadilha contra robôs de spam.
 * Fica fora da tela e fora da ordem de tabulação, e é ignorado por leitores
 * de tela — quem preenche não é gente.
 */
export function HoneypotField() {
  return (
    <div aria-hidden className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
      <label htmlFor="website">Não preencha este campo</label>
      <input id="website" type="text" name="website" tabIndex={-1} autoComplete="off" />
    </div>
  );
}
