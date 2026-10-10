"use client";

import { useId, useMemo, useState } from "react";
import {
  FINANCING_DEFAULTS,
  FINANCING_LIMITS,
  INCOME_COMMITMENT,
  simulateFinancing,
} from "@/lib/financing";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Simulador da página do imóvel: entrada, prazo e taxa, e a parcela estimada.
 * É uma estimativa ilustrativa — o aviso fica sempre à vista.
 */
export function FinancingSimulator({ price, className }: { price: number; className?: string }) {
  const id = useId();
  const [entryPercent, setEntryPercent] = useState<number>(FINANCING_DEFAULTS.entryPercent);
  const [years, setYears] = useState<number>(FINANCING_DEFAULTS.years);
  const [rate, setRate] = useState<string>(String(FINANCING_DEFAULTS.yearlyRate).replace(".", ","));

  const yearlyRate = useMemo(() => {
    const parsed = Number(rate.replace(",", "."));
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 30) : FINANCING_DEFAULTS.yearlyRate;
  }, [rate]);

  const result = useMemo(
    () => simulateFinancing({ price, entryPercent, years, yearlyRate }),
    [price, entryPercent, years, yearlyRate]
  );

  const field = "mt-2 w-full border border-line bg-surface px-3 py-2.5 text-ink";

  return (
    <div className={cn("grid gap-8 border border-line bg-surface p-6 sm:p-8 lg:grid-cols-2 lg:gap-12", className)}>
      <div className="space-y-6">
        <div>
          <div className="flex items-baseline justify-between gap-4">
            <label htmlFor={`${id}-entrada`} className="label-caps text-[0.625rem] text-muted">
              Entrada
            </label>
            <p className="tabular text-sm text-ink">
              {entryPercent}% · {formatPrice(result.entry)}
            </p>
          </div>
          <input
            id={`${id}-entrada`}
            type="range"
            min={FINANCING_LIMITS.entryMin}
            max={FINANCING_LIMITS.entryMax}
            step={5}
            value={entryPercent}
            onChange={(event) => setEntryPercent(Number(event.target.value))}
            className="mt-3 w-full accent-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${id}-prazo`} className="label-caps text-[0.625rem] text-muted">
              Prazo
            </label>
            <select
              id={`${id}-prazo`}
              value={years}
              onChange={(event) => setYears(Number(event.target.value))}
              className={field}
            >
              {FINANCING_LIMITS.years.map((option) => (
                <option key={option} value={option}>
                  {option} anos
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-taxa`} className="label-caps text-[0.625rem] text-muted">
              Juros ao ano (%)
            </label>
            <input
              id={`${id}-taxa`}
              type="text"
              inputMode="decimal"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              className={cn(field, "tabular")}
            />
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted">
          Simulação ilustrativa, em parcelas fixas. Não inclui seguros nem tarifas; as condições reais dependem do
          banco e da aprovação de crédito.
        </p>
      </div>

      <div className="flex flex-col justify-between gap-6 border-t border-line pt-6 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
        <div aria-live="polite">
          <p className="label-caps text-[0.625rem] text-muted">Parcela estimada</p>
          <p className="mt-2 font-display text-[clamp(2.2rem,1.8rem+1.5vw,3rem)] leading-none text-primary tabular">
            {formatPrice(Math.round(result.installment))}
            <span className="ml-1 text-base text-muted">/mês</span>
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
          <div>
            <dt className="label-caps text-[0.5625rem] text-muted">Valor financiado</dt>
            <dd className="mt-1 font-display text-[1.3rem] text-ink tabular">{formatPrice(result.financed)}</dd>
          </div>
          <div>
            <dt className="label-caps text-[0.5625rem] text-muted">Total ao fim do prazo</dt>
            <dd className="mt-1 font-display text-[1.3rem] text-ink tabular">{formatPrice(result.total)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="label-caps text-[0.5625rem] text-muted">
              Renda familiar sugerida ({Math.round(INCOME_COMMITMENT * 100)}% na parcela)
            </dt>
            <dd className="mt-1 font-display text-[1.3rem] text-ink tabular">
              {formatPrice(Math.round(result.suggestedIncome))}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
