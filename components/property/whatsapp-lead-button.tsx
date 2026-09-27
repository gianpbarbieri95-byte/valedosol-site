"use client";

import { useId, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { propertyWhatsAppMessage, whatsappUrl } from "@/lib/format";
import { isValidPhone } from "@/lib/validations/phone";
import { track } from "@/lib/track";
import { ButtonExternal, Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { CloseIcon, WhatsAppIcon } from "@/components/ui/icons";

/**
 * Botão de WhatsApp da página do imóvel.
 *
 * Antes de abrir a conversa, pede nome e telefone. O contato vai para
 * "Contatos do site" no painel (source site_whatsapp) e o WhatsApp abre já
 * com o nome da pessoa na mensagem.
 *
 * Sem JavaScript, o botão continua sendo o link direto do WhatsApp.
 */

const ENDPOINT = "/api/contato-whatsapp";
/** Nome e telefone ficam no navegador para não pedir de novo no próximo imóvel. */
const STORAGE_KEY = "vds:contato";

type Errors = { name?: string; phone?: string };

function readSaved(): { name: string; phone: string } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { name?: unknown; phone?: unknown };
    return {
      name: typeof value.name === "string" ? value.name : "",
      phone: typeof value.phone === "string" ? value.phone : "",
    };
  } catch {
    return null;
  }
}

function save(name: string, phone: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, phone }));
  } catch {
    // Navegação privada ou armazenamento bloqueado: só não lembra da próxima vez.
  }
}

/** Envia sem segurar a pessoa: sendBeacon termina mesmo com a aba em segundo plano. */
function send(data: FormData) {
  try {
    if (navigator.sendBeacon?.(ENDPOINT, data)) return;
  } catch {
    // Cai para o fetch abaixo.
  }
  fetch(ENDPOINT, { method: "POST", body: data, keepalive: true }).catch(() => {});
}

/** Abre o WhatsApp numa aba nova, como o link fazia, dentro do mesmo clique. */
function openExternal(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function WhatsAppLeadButton({
  number,
  propertyId,
  propertyCode,
  propertyTitle,
  variant = "gold",
  size = "md",
  className,
  children,
}: {
  number: string | null | undefined;
  propertyId: string;
  propertyCode: string;
  propertyTitle: string;
  variant?: "gold" | "primary";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const pathname = usePathname();
  const id = useId();

  const href = whatsappUrl(number, propertyWhatsAppMessage({ code: propertyCode, title: propertyTitle }));
  if (!href) return null;

  function open(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const saved = readSaved();
    if (saved) {
      setName(saved.name);
      setPhone(saved.phone);
    }
    setErrors({});
    dialogRef.current?.showModal();
    track("whatsapp_click", { property_code: propertyCode });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    const next: Errors = {};
    if (cleanName.length < 2) next.name = "Informe seu nome";
    if (!cleanPhone) next.phone = "Informe seu telefone";
    else if (!isValidPhone(cleanPhone)) next.phone = "Telefone inválido. Use DDD + número.";
    setErrors(next);
    if (next.name || next.phone) {
      form.querySelector<HTMLInputElement>(next.name ? `#${CSS.escape(`${id}-nome`)}` : `#${CSS.escape(`${id}-telefone`)}`)?.focus();
      return;
    }

    save(cleanName, cleanPhone);
    send(new FormData(form));
    track("lead_submit", { source: "whatsapp", property_code: propertyCode });

    const url = whatsappUrl(number, propertyWhatsAppMessage({ code: propertyCode, title: propertyTitle, name: cleanName }));
    if (url) openExternal(url);
    dialogRef.current?.close();
  }

  return (
    <>
      <ButtonExternal href={href} variant={variant} size={size} className={className} onClick={open}>
        {children}
      </ButtonExternal>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-titulo`}
        onClick={(event) => {
          // Clique fora do cartão (no fundo escurecido) fecha.
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md border border-line bg-surface p-0 text-ink shadow-float backdrop:bg-ink/60 backdrop:backdrop-blur-[2px]"
      >
        <div className="relative p-7">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fechar"
            className="absolute right-3 top-3 grid size-10 place-items-center text-muted transition-colors hover:text-ink"
          >
            <CloseIcon className="size-5" />
          </button>

          <p className="eyebrow">WhatsApp</p>
          <h2 id={`${id}-titulo`} className="mt-3 pr-8 text-2xl">
            Antes de abrir a conversa
          </h2>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
            Deixe seu nome e telefone para a equipe da Vale do Sol identificar você e continuar o atendimento do
            imóvel {propertyCode}.
          </p>

          <form onSubmit={submit} noValidate className="relative mt-5 space-y-4">
            {/* Campo-armadilha, como nos formulários: gente não vê, robô preenche. */}
            <div aria-hidden className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
              <label htmlFor={`${id}-website`}>Não preencha este campo</label>
              <input id={`${id}-website`} type="text" name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <input type="hidden" name="property_id" value={propertyId} />
            <input type="hidden" name="page_url" value={pathname} />

            <Field label="Nome" htmlFor={`${id}-nome`} required error={errors.name}>
              <Input
                id={`${id}-nome`}
                name="name"
                required
                autoComplete="name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
                aria-invalid={Boolean(errors.name)}
                placeholder="Como podemos te chamar"
              />
            </Field>

            <Field label="Telefone / WhatsApp" htmlFor={`${id}-telefone`} required error={errors.phone}>
              <Input
                id={`${id}-telefone`}
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  if (errors.phone) setErrors({ ...errors, phone: undefined });
                }}
                aria-invalid={Boolean(errors.phone)}
                placeholder="(11) 99999-9999"
              />
            </Field>

            <Button type="submit" variant="gold" size="lg" className="w-full">
              <WhatsAppIcon />
              Abrir o WhatsApp
            </Button>

            <p className="text-xs leading-relaxed text-muted">Seus dados são usados apenas para este atendimento.</p>
          </form>
        </div>
      </dialog>
    </>
  );
}
