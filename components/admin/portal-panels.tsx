"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import { savePortalListings, savePortalSettings } from "@/actions/admin/portals";
import { IDLE_STATE } from "@/lib/validations/lead";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/primitives";
import { FormMessage } from "@/components/forms/form-parts";
import { CopyIcon } from "@/components/admin/icons";
import type { PortalTypeOption } from "@/lib/portals/definitions";
import type { PortalId } from "@/types/database";

/** Link do XML com botão de copiar. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        readOnly
        aria-label={label}
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        className="h-11 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-line bg-canvas px-3 font-mono text-xs text-ink-soft"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] border border-line bg-surface px-3 text-[0.8125rem] text-ink hover:border-line-strong"
      >
        <CopyIcon className="size-4" />
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

export interface TypeRow {
  id: string;
  name: string;
  /** Escolha salva pelo administrador, se houver. */
  chosen: string;
  /** Correspondência padrão pelo slug, se houver. */
  fallback: string | null;
}

/** Liga/desliga o portal e ajusta o tipo de cada categoria no portal. */
export function PortalSettingsForm({
  portal,
  enabled,
  types,
  options,
}: {
  portal: PortalId;
  enabled: boolean;
  types: TypeRow[];
  options: PortalTypeOption[];
}) {
  const [state, action, pending] = useActionState(savePortalSettings, IDLE_STATE);
  const labelOf = (value: string | null) => options.find((option) => option.value === value)?.label ?? value;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
      className="space-y-4"
    >
      <input type="hidden" name="portal" value={portal} />
      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="size-5 accent-[var(--color-primary)]" />
        <span>
          <span className="font-medium text-ink">Enviar imóveis para este portal</span>
          <span className="block text-xs text-muted">Desligado, o link do XML responde “não encontrado”.</span>
        </span>
      </label>

      <details className="rounded-[var(--radius-sm)] border border-line">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink">Tipo de imóvel no portal</summary>
        <div className="space-y-3 border-t border-line px-4 py-4">
          <p className="text-xs leading-relaxed text-muted">
            Cada portal tem a sua lista de tipos. Deixe em “Padrão” para usar a correspondência sugerida; tipos sem
            correspondência não saem no XML.
          </p>
          {types.map((type) => (
            <div key={type.id} className="grid gap-1.5 sm:grid-cols-[12rem_1fr] sm:items-center">
              <label htmlFor={`${portal}-type-${type.id}`} className="text-sm text-ink-soft">
                {type.name}
              </label>
              <Select id={`${portal}-type-${type.id}`} name={`type_${type.id}`} defaultValue={type.chosen} className="h-10">
                <option value="">{type.fallback ? `Padrão: ${labelOf(type.fallback)}` : "Sem correspondência — não enviar"}</option>
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      </details>

      <FormMessage state={state} />
      <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
        {pending ? "Salvando…" : "Salvar configuração"}
      </Button>
    </form>
  );
}

export interface ListingRow {
  id: string;
  code: string;
  title: string;
  typeName: string | null;
  listed: boolean;
  highlight: boolean;
  issues: string[];
}

/** Quais imóveis vão para o portal, com o motivo quando não podem ir. */
export function PortalListingsForm({ portal, rows }: { portal: PortalId; rows: ListingRow[] }) {
  const [state, action, pending] = useActionState(savePortalListings, IDLE_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const [filter, setFilter] = useState<"todos" | "marcados" | "prontos">("todos");

  const visible = rows.filter((row) =>
    filter === "marcados" ? row.listed : filter === "prontos" ? row.issues.length === 0 : true
  );
  const ready = rows.filter((row) => row.issues.length === 0).length;

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <input type="hidden" name="portal" value={portal} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["todos", `Todos (${rows.length})`],
              ["marcados", `Marcados (${rows.filter((row) => row.listed).length})`],
              ["prontos", `Prontos para enviar (${ready})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-[var(--radius-sm)] border px-3 py-1.5 text-[0.8125rem]",
                filter === value ? "border-primary bg-primary-soft text-primary" : "border-line text-ink-soft hover:border-line-strong"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            for (const row of rows) {
              if (row.issues.length) continue;
              const box = formRef.current?.elements.namedItem(`on_${row.id}`);
              if (box instanceof HTMLInputElement) box.checked = true;
            }
          }}
          className="text-[0.8125rem] font-medium text-primary hover:underline"
        >
          Marcar todos os prontos
        </button>
      </div>

      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <li
            key={row.id}
            className={cn("grid gap-2 px-4 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4 sm:px-5", !visible.includes(row) && "hidden")}
          >
            <input type="hidden" name="ids" value={row.id} />
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name={`on_${row.id}`}
                defaultChecked={row.listed}
                aria-label={`Anunciar ${row.code}`}
                className="size-5 accent-[var(--color-primary)]"
              />
              <span className="font-mono text-xs text-ink-soft sm:w-16">{row.code}</span>
            </label>
            <div className="min-w-0">
              <Link href={`/imoveis/${row.id}`} className="block truncate text-sm text-ink hover:text-primary">
                {row.title}
              </Link>
              {row.issues.length ? (
                <p className="text-xs text-danger">Não sai no XML: {row.issues.join(", ")}.</p>
              ) : (
                <p className="text-xs text-primary">Pronto para o portal{row.typeName ? ` · ${row.typeName}` : ""}</p>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-soft">
              <input type="checkbox" name={`hl_${row.id}`} defaultChecked={row.highlight} className="size-4 accent-[var(--color-primary)]" />
              Destaque
            </label>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-4 sm:px-5">
        <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
          {pending ? "Salvando…" : "Salvar seleção"}
        </Button>
        <FormMessage state={state} className="flex-1" />
      </div>
    </form>
  );
}
