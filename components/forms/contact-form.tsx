"use client";

import { useActionState } from "react";
import { usePathname } from "next/navigation";
import { submitContact } from "@/actions/leads";
import { IDLE_STATE } from "@/lib/validations/lead";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { FormMessage, HoneypotField, SubmitButton } from "@/components/forms/form-parts";

/** Assuntos herdados do formulário do site atual da Vale do Sol. */
const SUBJECTS = [
  "Avaliação de imóvel",
  "Vender imóvel",
  "Alugar imóvel",
  "Comprar imóvel",
  "Dúvidas",
  "Outros",
];

export function ContactForm() {
  const [state, action] = useActionState(submitContact, IDLE_STATE);
  const pathname = usePathname();

  if (state.status === "success") {
    return <FormMessage state={state} />;
  }

  return (
    <form action={action} className="relative space-y-5">
      <HoneypotField />
      <input type="hidden" name="page_url" value={pathname} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome" htmlFor="contato-nome" required error={state.errors?.name}>
          <Input id="contato-nome" name="name" required autoComplete="name" aria-invalid={Boolean(state.errors?.name)} />
        </Field>

        <Field label="Telefone / WhatsApp" htmlFor="contato-telefone" required error={state.errors?.phone}>
          <Input
            id="contato-telefone"
            name="phone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={Boolean(state.errors?.phone)}
            placeholder="(11) 99999-9999"
          />
        </Field>

        <Field label="E-mail" htmlFor="contato-email" error={state.errors?.email}>
          <Input id="contato-email" name="email" type="email" autoComplete="email" aria-invalid={Boolean(state.errors?.email)} />
        </Field>

        <Field label="Assunto" htmlFor="contato-assunto">
          <Select id="contato-assunto" name="subject" defaultValue="">
            <option value="">Selecione</option>
            {SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Mensagem" htmlFor="contato-mensagem" required error={state.errors?.message}>
        <Textarea
          id="contato-mensagem"
          name="message"
          rows={5}
          required
          aria-invalid={Boolean(state.errors?.message)}
          placeholder="Conte o que você procura ou como podemos ajudar."
        />
      </Field>

      <FormMessage state={state} />

      <SubmitButton>Enviar mensagem</SubmitButton>
    </form>
  );
}
