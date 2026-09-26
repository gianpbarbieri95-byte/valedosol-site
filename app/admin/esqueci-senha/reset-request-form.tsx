"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { requestPasswordReset } from "@/actions/auth";
import { IDLE_STATE } from "@/lib/validations/lead";
import { Button } from "@/components/ui/button";
import { MailIcon } from "@/components/ui/icons";
import { FormMessage } from "@/components/forms/form-parts";
import { readRememberedEmail } from "@/app/admin/login/remembered-email";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full">
      {pending ? "Enviando…" : "Enviar link"}
    </Button>
  );
}

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, IDLE_STATE);
  // Controlado: o React 19 limparia o campo depois do envio.
  const [email, setEmail] = useState("");

  // Quem já entrou neste aparelho não precisa digitar o e-mail de novo.
  useEffect(() => {
    const remembered = readRememberedEmail();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- só existe no navegador, depois da hidratação
    if (remembered) setEmail((current) => current || remembered);
  }, []);

  if (state.status === "success") {
    return <FormMessage state={state} />;
  }

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="reset-email" className="mb-2 block text-[0.8125rem] font-medium text-ink-soft">
          E-mail
        </label>
        <div className="relative">
          <MailIcon className="pointer-events-none absolute left-4 top-1/2 size-[1.125rem] -translate-y-1/2 text-muted" />
          <input
            id="reset-email"
            name="email"
            type="email"
            inputMode="email"
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com.br"
            className="h-13 w-full rounded-[var(--radius-sm)] border border-line bg-surface pl-11 pr-4 text-base text-ink placeholder:text-muted/80 transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
        </div>
      </div>

      <FormMessage state={state} />
      <Submit />
    </form>
  );
}
