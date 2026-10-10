"use client";

import { useActionState } from "react";
import { usePathname } from "next/navigation";
import { submitPropertyInterest } from "@/actions/leads";
import { IDLE_STATE } from "@/lib/validations/lead";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { FormMessage, HoneypotField, SubmitButton } from "@/components/forms/form-parts";

/**
 * "Tenho interesse neste imóvel".
 * Pede o mínimo: nome, telefone e, se quiser, e-mail e mensagem.
 */
export function PropertyInterestForm({
  propertyId,
  propertyCode,
  propertyTitle,
}: {
  propertyId: string;
  propertyCode: string;
  propertyTitle: string;
}) {
  const [state, action] = useActionState(submitPropertyInterest, IDLE_STATE);
  const pathname = usePathname();

  if (state.status === "success") {
    return <FormMessage state={state} event="property_interest_submit" />;
  }

  return (
    <form action={action} className="relative space-y-4">
      <HoneypotField />
      <input type="hidden" name="property_id" value={propertyId} />
      <input type="hidden" name="property_code" value={propertyCode} />
      <input type="hidden" name="page_url" value={pathname} />

      <Field label="Nome" htmlFor="interesse-nome" required error={state.errors?.name}>
        <Input
          id="interesse-nome"
          name="name"
          required
          autoComplete="name"
          aria-invalid={Boolean(state.errors?.name)}
          placeholder="Como podemos te chamar"
        />
      </Field>

      <Field label="Telefone / WhatsApp" htmlFor="interesse-telefone" required error={state.errors?.phone}>
        <Input
          id="interesse-telefone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          inputMode="tel"
          aria-invalid={Boolean(state.errors?.phone)}
          placeholder="(11) 99999-9999"
        />
      </Field>

      <Field label="E-mail" htmlFor="interesse-email" error={state.errors?.email}>
        <Input
          id="interesse-email"
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(state.errors?.email)}
          placeholder="seu@email.com.br"
        />
      </Field>

      <Field label="Mensagem" htmlFor="interesse-mensagem" error={state.errors?.message}>
        <Textarea
          id="interesse-mensagem"
          name="message"
          rows={3}
          defaultValue={`Olá, tenho interesse no imóvel ${propertyCode} — ${propertyTitle}.`}
        />
      </Field>

      <FormMessage state={state} />

      <SubmitButton className="w-full">Tenho interesse neste imóvel</SubmitButton>

      <p className="text-xs leading-relaxed text-muted">
        Seus dados são usados apenas para este atendimento.
      </p>
    </form>
  );
}
