"use client";

import { useActionState } from "react";
import { signIn } from "@/actions/auth";
import { IDLE_STATE } from "@/lib/validations/lead";
import { Field, Input } from "@/components/ui/primitives";
import { FormMessage, SubmitButton } from "@/components/forms/form-parts";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, IDLE_STATE);

  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="E-mail" htmlFor="login-email" required>
        <Input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          placeholder="voce@valedosolimoveis.com.br"
        />
      </Field>

      <Field label="Senha" htmlFor="login-senha" required>
        <Input
          id="login-senha"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          minLength={6}
        />
      </Field>

      <FormMessage state={state} />

      <SubmitButton className="w-full">Entrar</SubmitButton>
    </form>
  );
}
