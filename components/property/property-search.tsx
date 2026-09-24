"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "@/components/ui/icons";
import { buildQuery, cn } from "@/lib/utils";
import { track } from "@/lib/track";

export interface SearchOption {
  value: string;
  label: string;
}

export interface PriceBand {
  value: string;
  label: string;
  min?: number;
  max?: number;
}

/**
 * Busca da abertura: quatro decisões e um botão, num painel claro que
 * assenta na borda entre a abertura e a primeira seção.
 * Tudo que o visitante escolhe vira parâmetro na URL, então o resultado pode
 * ser compartilhado e indexado.
 */
export function PropertySearch({
  types,
  locations,
  priceBands,
  className,
}: {
  types: SearchOption[];
  locations: SearchOption[];
  priceBands: PriceBand[];
  className?: string;
}) {
  const router = useRouter();
  const [purpose, setPurpose] = useState("venda");
  const [type, setType] = useState("");
  const [location, setLocation] = useState("");
  const [band, setBand] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const selected = priceBands.find((item) => item.value === band);

    track("search_property", { finalidade: purpose, tipo: type || null, local: location || null });

    router.push(
      `/imoveis${buildQuery({
        finalidade: purpose,
        tipo: type,
        bairro: location,
        preco_min: selected?.min,
        preco_max: selected?.max,
      })}`
    );
  }

  const fields = [
    {
      id: "busca-local",
      label: "Localização",
      value: location,
      onChange: setLocation,
      placeholder: "Toda a região",
      options: locations,
    },
    {
      id: "busca-tipo",
      label: "Tipo de imóvel",
      value: type,
      onChange: setType,
      placeholder: "Todos os tipos",
      options: types,
    },
    {
      id: "busca-preco",
      label: "Faixa de valor",
      value: band,
      onChange: setBand,
      placeholder: "Qualquer valor",
      options: priceBands,
    },
  ];

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Buscar imóveis"
      className={cn("bg-surface text-ink shadow-float", className)}
    >
      <div className="grid lg:grid-cols-[auto_1.15fr_1fr_1fr_auto]">
        {/* Finalidade como alternância, não como select: são só duas opções. */}
        <div
          role="radiogroup"
          aria-label="Finalidade"
          className="flex items-stretch border-b border-line lg:flex-col lg:justify-center lg:border-b-0 lg:border-r lg:px-2"
        >
          {[
            { value: "venda", label: "Comprar" },
            { value: "locacao", label: "Alugar" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={purpose === option.value}
              onClick={() => setPurpose(option.value)}
              className={cn(
                "label-caps relative flex-1 px-6 py-4 text-left transition-colors duration-300 lg:flex-none lg:py-2",
                "before:absolute before:left-6 before:right-6 before:bottom-0 before:h-px before:bg-gold lg:before:left-0 lg:before:right-auto lg:before:top-1/2 lg:before:h-3 lg:before:w-px lg:before:-translate-y-1/2",
                "before:origin-center before:transition-transform before:duration-300",
                purpose === option.value
                  ? "text-ink before:scale-100"
                  : "text-muted before:scale-0 hover:text-ink"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {fields.map((field) => (
          <div
            key={field.id}
            className="border-b border-line px-6 py-4 transition-colors duration-300 focus-within:bg-surface-alt/60 focus-within:shadow-[inset_0_-2px_0_var(--color-primary)] hover:bg-surface-alt/40 lg:border-b-0 lg:border-r lg:py-5"
          >
            <label htmlFor={field.id} className="label-caps block text-[0.625rem] text-muted">
              {field.label}
            </label>
            <PlainSelect
              id={field.id}
              value={field.value}
              onChange={(event) => field.onChange(event.target.value)}
            >
              <option value="">{field.placeholder}</option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </PlainSelect>
          </div>
        ))}

        <div className="p-3">
          <Button type="submit" size="lg" className="h-full min-h-14 w-full px-8">
            <SearchIcon />
            Encontrar imóvel
          </Button>
        </div>
      </div>
    </form>
  );
}

/**
 * Select sem moldura: o painel já desenha as divisões. A seta é um SVG fino
 * no tom do texto secundário.
 */
function PlainSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "mt-1 h-8 w-full cursor-pointer appearance-none truncate border-0 bg-transparent pr-7 text-[0.9375rem] text-ink",
        "focus:outline-none",
        "bg-[length:1rem] bg-[right_0_center] bg-no-repeat",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22%237d807b%22 stroke-width=%221.5%22%3E%3Cpath stroke-linecap=%22round%22 stroke-linejoin=%22round%22 d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E')]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
