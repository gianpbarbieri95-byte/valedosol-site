import type { PriceBand } from "@/components/property/property-search";

/** "R$ 1,2 milhão", "R$ 800 mil" — leitura rápida, sem centavos. */
export function compactPrice(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const label = millions.toLocaleString("pt-BR", { maximumFractionDigits: millions < 10 ? 1 : 0 });
    return `R$ ${label} ${millions >= 2 ? "milhões" : "milhão"}`;
  }
  if (value >= 1_000) {
    return `R$ ${Math.round(value / 1_000).toLocaleString("pt-BR")} mil`;
  }
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

/** Arredonda para um degrau "redondo" (1, 2 ou 5 vezes uma potência de 10). */
function niceStep(value: number): number {
  if (value <= 0) return 100_000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

/**
 * Monta as faixas de preço a partir do acervo real.
 *
 * Faixas fixas escritas à mão envelhecem: se o acervo hoje vai de 250 mil a
 * 5 milhões, é isso que o filtro precisa oferecer — sem faixa vazia e sem
 * deixar imóvel fora de qualquer opção.
 */
export function buildPriceBands(range: { min: number; max: number } | null): PriceBand[] {
  if (!range || range.max <= 0) return [];

  const step = niceStep((range.max - range.min) / 4 || range.max / 4);
  const bands: PriceBand[] = [];

  const first = niceStep(range.min + step);
  bands.push({ value: `ate-${first}`, label: `Até ${compactPrice(first)}`, max: first });

  let cursor = first;
  while (cursor < range.max && bands.length < 5) {
    const next = cursor + step;
    if (next >= range.max) break;
    bands.push({
      value: `${cursor}-${next}`,
      label: `${compactPrice(cursor)} a ${compactPrice(next)}`,
      min: cursor,
      max: next,
    });
    cursor = next;
  }

  bands.push({ value: `acima-${cursor}`, label: `Acima de ${compactPrice(cursor)}`, min: cursor });

  return bands;
}
