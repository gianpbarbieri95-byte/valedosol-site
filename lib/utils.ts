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

/**
 * JSON para <script type="application/ld+json">. JSON.stringify não escapa
 * "<": um título de imóvel com "</script>" fecharia a tag e o resto viraria
 * HTML da página. Com \u003c o JSON continua idêntico para quem o lê.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** Só links http(s) viram href — "javascript:" e afins ficam de fora. */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
