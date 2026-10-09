/**
 * Código do imóvel — gerado pelo sistema, nunca digitado.
 *
 * Desde 05/10/2026 é só número; desde 09/10/2026 na casa da centena: 101, 102… 140, e os novos
 * seguem 141, 142… (pedido do Gian). O acervo foi renumerado pela ordem de cadastro; o de-para
 * 1–40 → 101–140 está em data/codigos-antes-da-centena-2026-10-09.csv e os códigos antigos com
 * letras (VRC029, VCh005…) em data/codigos-antigos-2026-10-05.csv.
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
