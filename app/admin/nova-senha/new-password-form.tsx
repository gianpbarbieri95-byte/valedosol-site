"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updatePassword } from "@/actions/auth";
import { IDLE_STATE } from "@/lib/validations/lead";
import { Button } from "@/components/ui/button";
import { EyeIcon, EyeOffIcon, LockIcon } from "@/components/ui/icons";
import { FormMessage } from "@/components/forms/form-parts";
import { cn } from "@/lib/utils";

const inputClass =
  "h-13 w-full rounded-[var(--radius-sm)] border bg-surface pl-11 pr-14 text-base text-ink " +
  "placeholder:text-muted/80 transition-[border-color,box-shadow] duration-150 " +
  "hover:border-line-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full">
      {pending ? "Salvando…" : "Salvar senha nova"}
    </Button>
  );
}

export function NewPasswordForm({ email }: { email: string }) {
  const [state, action] = useActionState(updatePassword, IDLE_STATE);
  // Controlados: o React 19 limparia os campos depois de um erro.
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);

  const longEnough = password.length >= 8;
  const matches = confirm.length > 0 && confirm === password;

  return (
    <form action={action} className="space-y-5">
      {/* Para o gerenciador de senhas do celular salvar na conta certa. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />

      <div>
        <label htmlFor="nova-senha" className="mb-2 block text-[0.8125rem] font-medium text-ink-soft">
          Senha nova
        </label>
        <div className="relative">
          <LockIcon className="pointer-events-none absolute left-4 top-1/2 size-[1.125rem] -translate-y-1/2 text-muted" />
          <input
            id="nova-senha"
            name="password"
            type={visible ? "text" : "password"}
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="nova-senha-regra"
            aria-invalid={Boolean(state.errors?.password)}
            className={cn(inputClass, state.errors?.password ? "border-danger" : "border-line")}
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? "Ocultar senhas" : "Mostrar senhas"}
            aria-pressed={visible}
            className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-muted transition-colors hover:bg-surface-alt hover:text-ink"
          >
            {visible ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
          </button>
        </div>
        <p
          id="nova-senha-regra"
          className={cn("mt-2 text-[0.8125rem]", state.errors?.password ? "text-danger" : longEnough ? "text-primary" : "text-muted")}
        >
          {state.errors?.password ?? (longEnough ? "✓ Tamanho ok" : "Ao menos 8 caracteres")}
        </p>
      </div>

      <div>
        <label htmlFor="confirmar-senha" className="mb-2 block text-[0.8125rem] font-medium text-ink-soft">
          Repita a senha nova
        </label>
        <div className="relative">
          <LockIcon className="pointer-events-none absolute left-4 top-1/2 size-[1.125rem] -translate-y-1/2 text-muted" />
          <input
            id="confirmar-senha"
            name="confirm"
            type={visible ? "text" : "password"}
            required
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            aria-invalid={Boolean(state.errors?.confirm)}
            className={cn(inputClass, "pr-4", state.errors?.confirm ? "border-danger" : "border-line")}
          />
        </div>
        {confirm.length > 0 || state.errors?.confirm ? (
          <p className={cn("mt-2 text-[0.8125rem]", matches ? "text-primary" : "text-danger")}>
            {matches ? "✓ As senhas conferem" : (state.errors?.confirm ?? "As duas senhas ainda não são iguais")}
          </p>
        ) : null}
      </div>

      <FormMessage state={state} />
      <Submit />
    </form>
  );
}
