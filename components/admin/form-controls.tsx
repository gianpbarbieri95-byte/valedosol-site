"use client";

import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/primitives";

/* ------------------------------------------------------------ valores */

/**
 * Formata enquanto a pessoa digita: 1190000 vira 1.190.000 e, com
 * centavos, 1234,5 vira 1.234,5. O servidor (optionalNumber em
 * lib/validations/property.ts) já tira os pontos e troca a vírgula por
 * ponto, então o que aparece na tela é exatamente o que será salvo.
 */
export function formatDecimalTyping(raw: string, decimals: boolean): string {
  let value = raw;
  // Teclado numérico do Android tem ponto e não vírgula: um ponto digitado
  // no fim, antes de haver vírgula, é a pessoa querendo centavos.
  if (decimals && value.endsWith(".") && !value.includes(",")) value = `${value.slice(0, -1)},`;

  const cleaned = value.replace(decimals ? /[^\d,]/g : /\D/g, "");
  const [integerRaw, ...rest] = cleaned.split(",");
  const integer = integerRaw.replace(/^0+(?=\d)/, "");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (!decimals || !cleaned.includes(",")) return grouped;
  return `${grouped || "0"},${rest.join("").slice(0, 2)}`;
}

/** Valor salvo no banco no formato da tela: 1190000 → "1.190.000". */
export function formatDecimalValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Campo numérico com separador de milhar. Mantém o cursor no lugar certo
 * quando a pessoa corrige um dígito no meio do número.
 */
export function DecimalInput({
  defaultValue,
  decimals = false,
  prefix,
  suffix,
  className,
  ...props
}: Omit<ComponentProps<"input">, "defaultValue" | "value" | "onChange" | "type"> & {
  defaultValue?: number | null;
  /** Aceita vírgula e até duas casas decimais. */
  decimals?: boolean;
  prefix?: string;
  suffix?: string;
}) {
  const [value, setValue] = useState(() => formatDecimalValue(defaultValue));

  return (
    <div className="relative">
      {prefix ? (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
          {prefix}
        </span>
      ) : null}
      <Input
        {...props}
        type="text"
        inputMode={decimals ? "decimal" : "numeric"}
        autoComplete="off"
        value={value}
        onChange={(event) => {
          const input = event.target;
          const caret = input.selectionStart ?? input.value.length;
          const atEnd = caret >= input.value.length;
          // Quantos dígitos (e vírgula) havia antes do cursor: é essa a
          // posição que precisa sobreviver à reformatação.
          const significantBefore = input.value.slice(0, caret).replace(/[^\d,.]/g, "").replace(/\./g, "").length;
          const next = formatDecimalTyping(input.value, decimals);
          setValue(next);

          requestAnimationFrame(() => {
            if (document.activeElement !== input || atEnd) return;
            let seen = 0;
            let position = next.length;
            for (let index = 0; index < next.length; index++) {
              if (seen === significantBefore) {
                position = index;
                break;
              }
              if (next[index] !== ".") seen++;
            }
            input.setSelectionRange(position, position);
          });
        }}
        className={cn(prefix && "pl-10", suffix && "pr-12", "tabular-nums", className)}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ contador */

/**
 * Número pequeno (dormitórios, vagas…) com botões de − e +. No celular,
 * dois toques resolvem o que antes pedia abrir o teclado numérico.
 * Vazio continua sendo "não informado", diferente de zero.
 */
export function NumberStepper({
  id,
  name,
  defaultValue,
  max = 99,
  invalid,
}: {
  id: string;
  name: string;
  defaultValue?: number | null;
  max?: number;
  invalid?: boolean;
}) {
  const [value, setValue] = useState(defaultValue === null || defaultValue === undefined ? "" : String(defaultValue));
  const current = value === "" ? null : Number(value);

  const step = (delta: number) => {
    const next = Math.min(max, Math.max(0, (current ?? 0) + delta));
    setValue(current === null && delta < 0 ? "" : String(next));
  };

  const buttonClass =
    "grid w-11 shrink-0 place-items-center text-lg text-ink-soft transition-colors " +
    "hover:bg-surface-alt hover:text-ink active:bg-surface-alt disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div
      className={cn(
        "flex h-11 overflow-hidden rounded-[var(--radius-sm)] border bg-surface transition-colors focus-within:border-primary",
        invalid ? "border-danger" : "border-line hover:border-line-strong"
      )}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={current === null}
        aria-label="Diminuir"
        aria-controls={id}
        className={buttonClass}
      >
        −
      </button>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, String(max).length);
          setValue(digits === "" ? "" : String(Math.min(max, Number(digits))));
        }}
        className="w-full min-w-0 border-x border-line bg-transparent text-center text-base tabular-nums text-ink placeholder:text-muted focus:outline-none sm:text-sm"
      />
      <button
        type="button"
        onClick={() => step(1)}
        disabled={current !== null && current >= max}
        aria-label="Aumentar"
        aria-controls={id}
        className={buttonClass}
      >
        +
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ CEP */

export function formatCep(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export interface CepAddress {
  street: string;
  neighborhood: string;
  city: string;
}

/** Consulta o ViaCEP. Qualquer falha devolve null: o preenchimento é só ajuda. */
export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
    };
    if (data.erro) return null;
    return {
      street: data.logradouro ?? "",
      neighborhood: data.bairro ?? "",
      city: data.localidade ?? "",
    };
  } catch {
    return null;
  }
}
