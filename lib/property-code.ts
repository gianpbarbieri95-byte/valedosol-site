/**
 * Código do imóvel — gerado pelo sistema, nunca digitado.
 *
 * Desde 05/10/2026 é só número; desde 08/10/2026 sem zeros à esquerda: 1, 2… 39, 40 (pedido do Gian).
 * O acervo foi renumerado pela ordem de cadastro (1 a 39); os códigos
 * antigos com letras (VRC029, VCh005…) estão em data/codigos-antigos-2026-10-05.csv.
 */

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
  return String(highest + 1 + skip);
}
