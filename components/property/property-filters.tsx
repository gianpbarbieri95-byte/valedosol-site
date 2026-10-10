"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/primitives";
import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import { PARAM } from "@/lib/validations/filters";
import { cn } from "@/lib/utils";
import { track } from "@/lib/track";
import type { PropertyFilters as Filters } from "@/lib/queries/properties";

interface Option {
  value: string;
  label: string;
}

const COUNT_OPTIONS = [1, 2, 3, 4, 5];

/**
 * Filtros da listagem.
 *
 * É um formulário GET de verdade apontando para /imoveis: funciona sem
 * JavaScript, cada busca vira uma URL compartilhável e o resultado pode ser
 * indexado. O JavaScript aqui só cuida da gaveta no celular.
 */
export function PropertyFilters({
  filters,
  types,
  cities,
  neighborhoods,
  activeCount,
}: {
  filters: Filters;
  types: Option[];
  cities: Option[];
  neighborhoods: Option[];
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const form = (
    <form
      action="/imoveis"
      method="get"
      className="flex h-full flex-col"
      onSubmit={() => track("filter_apply")}
    >
      {/* O caminho escolhido na home (morar/investir/espaço) sobrevive aos filtros */}
      {filters.profile ? <input type="hidden" name={PARAM.profile} value={filters.profile} /> : null}
      <div className="flex-1 space-y-6 overflow-y-auto">
        <div>
          <Label htmlFor="f-q">Busca</Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              id="f-q"
              name={PARAM.q}
              defaultValue={filters.q ?? ""}
              placeholder="Bairro, condomínio, característica"
              className="pl-9"
            />
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-[0.8125rem] font-medium text-ink-soft">Finalidade</legend>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "", label: "Todas" },
              { value: "venda", label: "Comprar" },
              { value: "locacao", label: "Alugar" },
            ].map((option) => (
              <label
                key={option.value || "todas"}
                className={cn(
                  "cursor-pointer rounded-[var(--radius-sm)] border px-2 py-2 text-center text-[0.8125rem] transition-colors",
                  "has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary",
                  "border-line text-ink-soft hover:border-line-strong"
                )}
              >
                <input
                  type="radio"
                  name={PARAM.purpose}
                  value={option.value}
                  defaultChecked={(filters.purpose ?? "") === option.value}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="f-tipo">Tipo de imóvel</Label>
          <Select id="f-tipo" name={PARAM.type} defaultValue={filters.type ?? ""}>
            <option value="">Todos os tipos</option>
            {types.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {cities.length > 1 ? (
          <div>
            <Label htmlFor="f-cidade">Cidade</Label>
            <Select id="f-cidade" name={PARAM.city} defaultValue={filters.city ?? ""}>
              <option value="">Todas as cidades</option>
              {cities.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        {neighborhoods.length ? (
          <div>
            <Label htmlFor="f-bairro">Bairro ou condomínio</Label>
            <Select id="f-bairro" name={PARAM.neighborhood} defaultValue={filters.neighborhood ?? ""}>
              <option value="">Todos</option>
              {neighborhoods.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <fieldset>
          <legend className="mb-2 text-[0.8125rem] font-medium text-ink-soft">Preço (R$)</legend>
          <div className="grid grid-cols-2 gap-2">
            <Input
              name={PARAM.priceMin}
              type="number"
              min={0}
              step={10000}
              inputMode="numeric"
              defaultValue={filters.priceMin ?? ""}
              placeholder="Mínimo"
              aria-label="Preço mínimo"
            />
            <Input
              name={PARAM.priceMax}
              type="number"
              min={0}
              step={10000}
              inputMode="numeric"
              defaultValue={filters.priceMax ?? ""}
              placeholder="Máximo"
              aria-label="Preço máximo"
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[0.8125rem] font-medium text-ink-soft">Área (m²)</legend>
          <div className="grid grid-cols-2 gap-2">
            <Input
              name={PARAM.areaMin}
              type="number"
              min={0}
              step={10}
              inputMode="numeric"
              defaultValue={filters.areaMin ?? ""}
              placeholder="Mínima"
              aria-label="Área mínima"
            />
            <Input
              name={PARAM.areaMax}
              type="number"
              min={0}
              step={10}
              inputMode="numeric"
              defaultValue={filters.areaMax ?? ""}
              placeholder="Máxima"
              aria-label="Área máxima"
            />
          </div>
        </fieldset>

        <div className="grid grid-cols-3 gap-2">
          {[
            { name: PARAM.bedrooms, label: "Quartos", value: filters.bedrooms },
            { name: PARAM.bathrooms, label: "Banheiros", value: filters.bathrooms },
            { name: PARAM.parking, label: "Vagas", value: filters.parking },
          ].map((field) => (
            <div key={field.name}>
              <Label htmlFor={`f-${field.name}`}>{field.label}</Label>
              <Select
                id={`f-${field.name}`}
                name={field.name}
                defaultValue={field.value ?? ""}
                // Três campos lado a lado: a seta e o recuo encolhem para o
                // "Todos" caber inteiro. O "!" vence o recuo padrão do Select,
                // já que o cn() do projeto só concatena classes.
                className="bg-[length:0.85rem]! bg-[right_0.4rem_center]! pl-2.5! pr-5!"
              >
                <option value="">Todos</option>
                {COUNT_OPTIONS.map((count) => (
                  <option key={count} value={count}>
                    {count}+
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>

        <div>
          <Label htmlFor="f-codigo">Código do imóvel</Label>
          <Input
            id="f-codigo"
            name={PARAM.code}
            defaultValue={filters.code ?? ""}
            placeholder="Ex.: VRC029"
          />
        </div>

        <fieldset className="space-y-2.5">
          <legend className="mb-2 text-[0.8125rem] font-medium text-ink-soft">Características</legend>
          {[
            { name: PARAM.inCondo, label: "Em condomínio", checked: filters.inCondo },
            { name: PARAM.furnished, label: "Mobiliado", checked: filters.furnished },
          ].map((option) => (
            <label key={option.name} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                name={option.name}
                value="1"
                defaultChecked={option.checked}
                className="size-4 rounded-[2px] border-line-strong accent-[var(--color-primary)]"
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="mt-6 flex gap-2 border-t border-line pt-5">
        <Button type="submit" className="flex-1">
          Aplicar filtros
        </Button>
        {activeCount > 0 ? (
          <Link
            href="/imoveis"
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] px-4 text-sm text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink"
          >
            Limpar
          </Link>
        ) : null}
      </div>
    </form>
  );

  return (
    <>
      {/* Desktop: coluna fixa ao lado dos resultados */}
      <aside className="hidden lg:block">
        <div className="sticky top-32 rounded-[var(--radius-md)] border border-line bg-surface p-5 shadow-subtle">
          <h2 className="mb-5 text-[0.8125rem] font-medium uppercase tracking-[0.12em] text-ink">
            Filtrar
          </h2>
          {form}
        </div>
      </aside>

      {/* Mobile: gaveta */}
      <div className="lg:hidden">
        <Button type="button" variant="outline" onClick={() => setOpen(true)} className="w-full">
          Filtros
          {activeCount > 0 ? (
            <span className="ml-1 grid size-5 place-items-center rounded-full bg-primary text-[0.6875rem] text-white">
              {activeCount}
            </span>
          ) : null}
        </Button>

        {open ? (
          <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-lg">Filtrar imóveis</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar filtros"
                className="grid size-10 place-items-center rounded-[var(--radius-sm)] text-ink hover:bg-surface-alt"
              >
                <CloseIcon className="size-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6">{form}</div>
          </div>
        ) : null}
      </div>
    </>
  );
}
