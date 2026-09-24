import { z } from "zod";
import { PROPERTY_PURPOSES, PROPERTY_STATUSES, SORT_OPTIONS } from "@/lib/site";
import type { PropertyFilters } from "@/lib/queries/properties";
import { PROFILES } from "@/lib/profiles";

export type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Nomes dos parâmetros na URL. Em português e estáveis: a URL de uma busca
 * é compartilhada por WhatsApp e indexada pelo Google, então ela é parte do
 * produto — não um detalhe interno.
 */
export const PARAM = {
  purpose: "finalidade",
  type: "tipo",
  profile: "perfil",
  city: "cidade",
  neighborhood: "bairro",
  priceMin: "preco_min",
  priceMax: "preco_max",
  bedrooms: "quartos",
  bathrooms: "banheiros",
  parking: "vagas",
  areaMin: "area_min",
  areaMax: "area_max",
  code: "codigo",
  inCondo: "condominio",
  furnished: "mobiliado",
  status: "status",
  q: "q",
  sort: "ordem",
  page: "pagina",
} as const;

const positiveNumber = z.coerce.number().finite().nonnegative().optional().catch(undefined);
const smallCount = z.coerce.number().int().min(0).max(20).optional().catch(undefined);
const flag = z
  .string()
  .transform((value) => value === "1" || value === "true" || value === "sim")
  .optional()
  .catch(undefined);

const schema = z.object({
  [PARAM.purpose]: z.enum(PROPERTY_PURPOSES).optional().catch(undefined),
  [PARAM.type]: z.string().trim().min(1).max(60).optional().catch(undefined),
  [PARAM.profile]: z.enum(PROFILES).optional().catch(undefined),
  [PARAM.city]: z.string().trim().min(1).max(80).optional().catch(undefined),
  [PARAM.neighborhood]: z.string().trim().min(1).max(80).optional().catch(undefined),
  [PARAM.priceMin]: positiveNumber,
  [PARAM.priceMax]: positiveNumber,
  [PARAM.bedrooms]: smallCount,
  [PARAM.bathrooms]: smallCount,
  [PARAM.parking]: smallCount,
  [PARAM.areaMin]: positiveNumber,
  [PARAM.areaMax]: positiveNumber,
  [PARAM.code]: z.string().trim().min(1).max(30).optional().catch(undefined),
  [PARAM.inCondo]: flag,
  [PARAM.furnished]: flag,
  [PARAM.status]: z.enum(PROPERTY_STATUSES).optional().catch(undefined),
  [PARAM.q]: z.string().trim().min(1).max(120).optional().catch(undefined),
  [PARAM.sort]: z
    .enum(Object.keys(SORT_OPTIONS) as [keyof typeof SORT_OPTIONS])
    .optional()
    .catch(undefined),
  [PARAM.page]: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Converte os parâmetros da URL em filtros já validados.
 *
 * Nada aqui confia no que chega: cada campo tem tipo, limite e `catch`, então
 * uma URL adulterada gera uma busca vazia em vez de erro ou consulta estranha.
 */
export function parseFilters(searchParams: SearchParams): PropertyFilters {
  const raw: Record<string, string | undefined> = {};
  for (const key of Object.values(PARAM)) {
    raw[key] = firstValue(searchParams[key]);
  }

  const parsed = schema.parse(raw);

  const priceMin = parsed[PARAM.priceMin];
  const priceMax = parsed[PARAM.priceMax];
  const areaMin = parsed[PARAM.areaMin];
  const areaMax = parsed[PARAM.areaMax];

  return {
    purpose: parsed[PARAM.purpose],
    type: parsed[PARAM.type],
    profile: parsed[PARAM.profile],
    city: parsed[PARAM.city],
    neighborhood: parsed[PARAM.neighborhood],
    // Faixa invertida (mínimo maior que o máximo) é engano: troca em vez
    // de devolver lista vazia sem explicação.
    priceMin: priceMin !== undefined && priceMax !== undefined ? Math.min(priceMin, priceMax) : priceMin,
    priceMax: priceMin !== undefined && priceMax !== undefined ? Math.max(priceMin, priceMax) : priceMax,
    bedrooms: parsed[PARAM.bedrooms],
    bathrooms: parsed[PARAM.bathrooms],
    parking: parsed[PARAM.parking],
    areaMin: areaMin !== undefined && areaMax !== undefined ? Math.min(areaMin, areaMax) : areaMin,
    areaMax: areaMin !== undefined && areaMax !== undefined ? Math.max(areaMin, areaMax) : areaMax,
    code: parsed[PARAM.code],
    inCondo: parsed[PARAM.inCondo],
    furnished: parsed[PARAM.furnished],
    status: parsed[PARAM.status],
    q: parsed[PARAM.q],
    sort: parsed[PARAM.sort],
    page: parsed[PARAM.page] ?? 1,
  };
}

/** Quantos filtros o visitante aplicou — usado no rótulo do botão no mobile. */
export function countActiveFilters(filters: PropertyFilters): number {
  const ignored = new Set(["page", "sort", "pageSize"]);
  return Object.entries(filters).filter(
    ([key, value]) => !ignored.has(key) && value !== undefined && value !== false && value !== ""
  ).length;
}

/** Reconstrói a query string a partir dos filtros (para paginação e ordenação). */
export function filtersToQuery(
  filters: PropertyFilters,
  overrides: Partial<Record<keyof typeof PARAM, string | number | undefined>> = {}
): string {
  const search = new URLSearchParams();

  const pairs: [string, unknown][] = [
    [PARAM.purpose, filters.purpose],
    [PARAM.type, filters.type],
    [PARAM.profile, filters.profile],
    [PARAM.city, filters.city],
    [PARAM.neighborhood, filters.neighborhood],
    [PARAM.priceMin, filters.priceMin],
    [PARAM.priceMax, filters.priceMax],
    [PARAM.bedrooms, filters.bedrooms],
    [PARAM.bathrooms, filters.bathrooms],
    [PARAM.parking, filters.parking],
    [PARAM.areaMin, filters.areaMin],
    [PARAM.areaMax, filters.areaMax],
    [PARAM.code, filters.code],
    [PARAM.inCondo, filters.inCondo ? "1" : undefined],
    [PARAM.furnished, filters.furnished ? "1" : undefined],
    [PARAM.status, filters.status],
    [PARAM.q, filters.q],
    [PARAM.sort, filters.sort],
    [PARAM.page, filters.page && filters.page > 1 ? filters.page : undefined],
  ];

  for (const [key, value] of pairs) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }

  for (const [key, value] of Object.entries(overrides)) {
    const param = PARAM[key as keyof typeof PARAM];
    if (value === undefined || value === "") search.delete(param);
    else search.set(param, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}
