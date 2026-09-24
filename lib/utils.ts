/** Junta classes condicionalmente, sem trazer uma dependência só para isso. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/** Lê o primeiro valor de um parâmetro de busca que pode vir repetido. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Converte parâmetro de URL em número, descartando lixo. */
export function paramToNumber(value: string | string[] | undefined): number | undefined {
  const raw = firstParam(value);
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Monta uma query string ignorando valores vazios. */
export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
