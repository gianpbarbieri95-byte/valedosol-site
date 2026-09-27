"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { signIn } from "@/actions/auth";
import { IDLE_STATE } from "@/lib/validations/lead";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon } from "@/components/ui/icons";
import { FormMessage } from "@/components/forms/form-parts";
import { cn } from "@/lib/utils";
import { readRememberedEmail, rememberEmail } from "./remembered-email";

/* 16px de fonte no campo: abaixo disso o Safari do iPhone dá zoom na tela
   ao tocar no campo. Altura de 3.25rem = alvo de toque confortável. */
const inputClass =
  "h-13 w-full rounded-[var(--radius-sm)] border border-line bg-surface pl-11 text-base text-ink " +
  "placeholder:text-muted/80 transition-[border-color,box-shadow] duration-150 " +
  "hover:border-line-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10";

function SubmitLogin() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full">
      {pending ? (
        <>
          <span
            aria-hidden
            className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
          />
          Entrando…
        </>
      ) : (
        <>
          Entrar
          <ArrowRightIcon className="size-4" />
        </>
      )}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, IDLE_STATE);
  // Controlado de propósito: o React 19 limpa o formulário depois de cada
  // envio, e redigitar o e-mail no celular a cada senha errada cansa.
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // O e-mail de quem já entrou neste aparelho vem preenchido: no celular,
  // só falta a senha. Foco automático só com mouse — no celular ele abriria
  // o teclado por cima da tela antes de a pessoa ver onde está.
  useEffect(() => {
    const remembered = readRememberedEmail();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage só existe no navegador, depois da hidratação
    if (remembered) setEmail((current) => current || remembered);
    if (window.matchMedia("(pointer: fine)").matches) {
      (remembered ? passwordRef : emailRef).current?.focus();
    }
  }, []);

  // Depois de um erro, o cursor volta para a senha (o e-mail continua lá).
  useEffect(() => {
    if (state.status === "error" && email) passwordRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const detectCaps = (event: React.KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(event.getModifierState?.("CapsLock") ?? false);

  return (
    <form action={action} onSubmit={() => rememberEmail(email)} className="space-y-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div>
        <label htmlFor="login-email" className="mb-2 block text-[0.8125rem] font-medium text-ink-soft">
          E-mail
        </label>
        <div className="relative">
          <MailIcon className="pointer-events-none absolute left-4 top-1/2 size-[1.125rem] -translate-y-1/2 text-muted" />
          <input
            ref={emailRef}
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com.br"
            className={cn(inputClass, "pr-4")}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor="login-senha" className="block text-[0.8125rem] font-medium text-ink-soft">
            Senha
          </label>
          <Link
            href="/esqueci-senha"
            className="-my-2 py-2 text-[0.8125rem] text-primary underline-offset-4 hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>
        <div className="relative">
          <LockIcon className="pointer-events-none absolute left-4 top-1/2 size-[1.125rem] -translate-y-1/2 text-muted" />
          <input
            ref={passwordRef}
            id="login-senha"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            onKeyDown={detectCaps}
            onKeyUp={detectCaps}
            onBlur={() => setCapsLock(false)}
            aria-describedby={capsLock ? "login-caps" : undefined}
            className={cn(inputClass, "pr-14")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPassword}
            aria-controls="login-senha"
            className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-muted transition-colors hover:bg-surface-alt hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
          >
            {showPassword ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
          </button>
        </div>
        {capsLock ? (
          <p id="login-caps" className="mt-2 text-[0.8125rem] text-warning">
            O Caps Lock está ligado.
          </p>
        ) : null}
      </div>

      <FormMessage state={state} />

      <div className="pt-1">
        <SubmitLogin />
      </div>
    </form>
  );
}
