/**
 * Simulação de financiamento (tabela Price: parcela fixa).
 * Ilustrativa: não inclui seguros, taxas nem tarifas, e as condições reais
 * dependem do banco e da análise de crédito. Os padrões abaixo só abrem o
 * simulador; o visitante ajusta entrada, prazo e taxa.
 */
export const FINANCING_DEFAULTS = {
  entryPercent: 20,
  years: 30,
  /** Juros efetivos ao ano, em %. Editável pelo visitante. */
  yearlyRate: 11.5,
} as const;

export const FINANCING_LIMITS = {
  entryMin: 20,
  entryMax: 80,
  years: [10, 15, 20, 25, 30, 35],
} as const;

/** Parcela de renda familiar que os bancos costumam aceitar comprometer. */
export const INCOME_COMMITMENT = 0.3;

export interface FinancingResult {
  entry: number;
  financed: number;
  installment: number;
  total: number;
  suggestedIncome: number;
}

export function simulateFinancing(input: {
  price: number;
  entryPercent: number;
  years: number;
  yearlyRate: number;
}): FinancingResult {
  const { price, entryPercent, years, yearlyRate } = input;
  const entry = (price * entryPercent) / 100;
  const financed = price - entry;
  const months = years * 12;
  const monthlyRate = Math.pow(1 + yearlyRate / 100, 1 / 12) - 1;

  const installment =
    monthlyRate > 0
      ? (financed * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months))
      : financed / months;

  return {
    entry,
    financed,
    installment,
    total: entry + installment * months,
    suggestedIncome: installment / INCOME_COMMITMENT,
  };
}
