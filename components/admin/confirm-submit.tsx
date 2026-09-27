"use client";

import { useFormStatus } from "react-dom";

/**
 * Botão de envio que pede confirmação antes (excluir cliente, negócio…).
 * Sem JavaScript o formulário ainda envia; a confirmação é conveniência.
 */
export function ConfirmSubmit({
  message,
  className,
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending ? "Aguarde…" : children}
    </button>
  );
}
