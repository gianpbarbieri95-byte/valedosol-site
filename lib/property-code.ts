/**
 * Código do imóvel — gerado pelo sistema, nunca digitado.
 *
 * Segue o padrão que a Vale do Sol já usava no site antigo:
 *
 *   finalidade + sigla do tipo + número de 3 dígitos
 *   V RC 029  →  VRC029  (venda · casa em condomínio · nº 29)
 *
 * A numeração é por série (finalidade + tipo) e continua de onde o acervo
 * parou: a próxima casa em condomínio à venda depois de VRC029 é VRC030.
 * As siglas das séries que já existiam mantêm a grafia antiga (VCh, VAp,
 * VICl) para os códigos novos ficarem ao lado dos antigos na mesma série.
 */

import type { PropertyPurpose } from "@/lib/site";

const PURPOSE_LETTER: Record<PropertyPurpose, string> = {
  venda: "V",
  locacao: "L",
};

/** Sigla por tipo de imóvel (slug da tabela property_types). */
export const TYPE_CODE: Record<string, string> = {
  "casa-bairro": "RB",
  "casa-condominio": "RC",
  apartamento: "Ap",
  "terreno-bairro": "TB",
  "terreno-condominio": "TC",
  "terreno-comercial": "TCl",
  "chacara-sitio": "Ch",
  comercial: "ICl",
  "galpao-industrial": "GI",
  "area-industrial": "AI",
  "imovel-litoral": "Li",
};

/** Sem tipo definido: série genérica "Im" (imóvel). */
const FALLBACK_TYPE_CODE = "Im";

export function codePrefix(purpose: PropertyPurpose, typeSlug?: string | null): string {
  return PURPOSE_LETTER[purpose] + (typeSlug ? TYPE_CODE[typeSlug] ?? FALLBACK_TYPE_CODE : FALLBACK_TYPE_CODE);
}

/**
 * Maior número já usado em cada série. Aceita os códigos antigos do jeito
 * que vieram do WordPress: com espaço ("VRC 028"), caixa trocada ("VIcl 002")
 * e dois códigos no mesmo imóvel ("VRB011, VICl001").
 */
export function highestBySeries(codes: string[]): Map<string, number> {
  const highest = new Map<string, number>();
  for (const raw of codes) {
    for (const token of raw.split(/[,;/]+/)) {
      const match = token.replace(/\s+/g, "").match(/^([A-Za-z]+)(\d+)$/);
      if (!match) continue;
      const series = match[1].toUpperCase();
      const number = Number(match[2]);
      if (number > (highest.get(series) ?? 0)) highest.set(series, number);
    }
  }
  return highest;
}

/** Próximo código livre da série. */
export function nextPropertyCode(prefix: string, highest: Map<string, number>, skip = 0): string {
  const next = (highest.get(prefix.toUpperCase()) ?? 0) + 1 + skip;
  return `${prefix}${String(next).padStart(3, "0")}`;
}
