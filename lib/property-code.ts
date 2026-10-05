/**
 * Código do imóvel — gerado pelo sistema, nunca digitado.
 *
 * Desde 05/10/2026 é só número, com 4 dígitos: 0001, 0002… (pedido do Gian).
 * O acervo foi renumerado pela ordem de cadastro (0001 a 0039); os códigos
 * antigos com letras (VRC029, VCh005…) estão em data/codigos-antigos-2026-10-05.csv.
 */

const DIGITS = 4;

/** Maior código numérico já usado. Ignora qualquer código que não seja só número. */
export function highestCode(codes: string[]): number {
  let highest = 0;
  for (const code of codes) {
    const trimmed = code.trim();
    if (/^\d+$/.test(trimmed)) highest = Math.max(highest, Number(trimmed));
  }
  return highest;
}

/** Próximo código livre. `skip` pula números quando dois cadastros disputam o mesmo. */
export function nextPropertyCode(highest: number, skip = 0): string {
  return String(highest + 1 + skip).padStart(DIGITS, "0");
}
