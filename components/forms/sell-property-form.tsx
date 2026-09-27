"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { usePathname } from "next/navigation";
import { submitSellProperty } from "@/actions/leads";
import { IDLE_STATE, MAX_UPLOAD_FILES } from "@/lib/validations/lead";
import { compressImage } from "@/lib/image-compress";

/**
 * O envio passa por server action, com corpo limitado a 4 MB (next.config.ts
 * e limite da Vercel). Foto de celular tem 5 a 12 MB: aqui cada uma é
 * reduzida no próprio aparelho antes de ir, e o total é conferido.
 */
const MAX_TOTAL_BYTES = 3.8 * 1024 * 1024;
const UPLOAD_COMPRESSION = { maxSide: 1600, quality: 0.8, keepBelowBytes: 400 * 1024 };
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { FormMessage, HoneypotField, SubmitButton } from "@/components/forms/form-parts";

export function SellPropertyForm({
  types,
  cities,
}: {
  types: { value: string; label: string }[];
  cities: string[];
}) {
  const [state, action] = useActionState(submitSellProperty, IDLE_STATE);
  const [fileCount, setFileCount] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const pathname = usePathname();

  async function prepareFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    setFileCount(files.length);
    setTotalBytes(files.reduce((sum, file) => sum + file.size, 0));
    if (!files.length || files.length > MAX_UPLOAD_FILES || typeof DataTransfer === "undefined") return;

    setPreparing(true);
    const prepared: File[] = [];
    for (const file of files) {
      try {
        prepared.push(file.type.startsWith("image/") ? await compressImage(file, UPLOAD_COMPRESSION) : file);
      } catch {
        prepared.push(file);
      }
    }
    const transfer = new DataTransfer();
    for (const file of prepared) transfer.items.add(file);
    input.files = transfer.files;
    setTotalBytes(prepared.reduce((sum, file) => sum + file.size, 0));
    setPreparing(false);
  }

  const tooLarge = totalBytes > MAX_TOTAL_BYTES;

  if (state.status === "success") {
    return <FormMessage state={state} />;
  }

  return (
    <form action={action} className="relative space-y-5">
      <HoneypotField />
      <input type="hidden" name="page_url" value={pathname} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome" htmlFor="venda-nome" required error={state.errors?.name}>
          <Input id="venda-nome" name="name" required autoComplete="name" aria-invalid={Boolean(state.errors?.name)} />
        </Field>

        <Field label="Telefone / WhatsApp" htmlFor="venda-telefone" required error={state.errors?.phone}>
          <Input
            id="venda-telefone"
            name="phone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={Boolean(state.errors?.phone)}
            placeholder="(11) 99999-9999"
          />
        </Field>

        <Field label="E-mail" htmlFor="venda-email" error={state.errors?.email} className="sm:col-span-2">
          <Input id="venda-email" name="email" type="email" autoComplete="email" aria-invalid={Boolean(state.errors?.email)} />
        </Field>

        <Field label="Tipo de imóvel" htmlFor="venda-tipo">
          <Select id="venda-tipo" name="property_type" defaultValue="">
            <option value="">Selecione</option>
            {types.map((type) => (
              <option key={type.value} value={type.label}>
                {type.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="O que você quer fazer" htmlFor="venda-finalidade">
          <Select id="venda-finalidade" name="purpose" defaultValue="venda">
            <option value="venda">Vender</option>
            <option value="locacao">Alugar</option>
            <option value="ambos">Tanto faz</option>
          </Select>
        </Field>

        <Field label="Cidade" htmlFor="venda-cidade">
          {cities.length ? (
            <Select id="venda-cidade" name="city" defaultValue="Arujá">
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
              <option value="Outra">Outra</option>
            </Select>
          ) : (
            <Input id="venda-cidade" name="city" defaultValue="Arujá" />
          )}
        </Field>

        <Field label="Bairro ou condomínio" htmlFor="venda-bairro">
          <Input id="venda-bairro" name="neighborhood" />
        </Field>

        <Field
          label="Valor desejado"
          htmlFor="venda-valor"
          hint="Se ainda não tem um valor em mente, deixe em branco."
          className="sm:col-span-2"
        >
          <Input id="venda-valor" name="expected_price" inputMode="numeric" placeholder="R$" />
        </Field>
      </div>

      <Field label="Sobre o imóvel" htmlFor="venda-mensagem" error={state.errors?.message}>
        <Textarea
          id="venda-mensagem"
          name="message"
          rows={5}
          placeholder="Número de quartos, área, estado de conservação, o que for importante."
        />
      </Field>

      <Field
        label="Fotos do imóvel"
        htmlFor="venda-fotos"
        hint={`Opcional. Até ${MAX_UPLOAD_FILES} arquivos JPG, PNG, WEBP ou PDF. As fotos são reduzidas automaticamente.`}
      >
        <input
          id="venda-fotos"
          name="fotos"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
          onChange={prepareFiles}
          className="w-full rounded-[var(--radius-sm)] border border-line bg-surface px-3.5 py-2.5 text-sm text-ink-soft file:mr-3 file:rounded-[var(--radius-xs)] file:border-0 file:bg-surface-alt file:px-3 file:py-1.5 file:text-sm file:text-ink hover:border-line-strong"
        />
      </Field>

      {fileCount > MAX_UPLOAD_FILES ? (
        <p role="alert" className="text-xs text-danger">
          Você selecionou {fileCount} arquivos. O limite é {MAX_UPLOAD_FILES}.
        </p>
      ) : null}

      {preparing ? (
        <p role="status" className="text-xs text-ink-soft">
          Preparando as fotos…
        </p>
      ) : tooLarge ? (
        <p role="alert" className="text-xs text-danger">
          Os arquivos somam mais de 3,8 MB. Envie menos fotos ou um PDF menor — o restante a gente pede pelo WhatsApp.
        </p>
      ) : null}

      <FormMessage state={state} />

      <SubmitButton disabled={preparing || tooLarge || fileCount > MAX_UPLOAD_FILES}>Enviar meu imóvel</SubmitButton>

      <p className="text-xs leading-relaxed text-muted">
        Não fazemos avaliação automática. Depois de receber os dados, a Vale do Sol entra em contato
        para conversar sobre o imóvel.
      </p>
    </form>
  );
}
