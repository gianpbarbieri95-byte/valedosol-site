import { createPublicClient, isSupabaseConfigured } from "@/lib/supabase/public";
import { PAGE_SIZE, SORT_OPTIONS, type SortKey } from "@/lib/site";
import { PROFILE_DEFINITIONS, type Profile } from "@/lib/profiles";
import { getPropertyTypes } from "@/lib/queries/taxonomies";
import type {
  PropertyCardData,
  PropertyPurpose,
  PropertyStatus,
  PropertyWithRelations,
} from "@/types/database";

/** Colunas que os cards de listagem precisam — nada além disso. */
const CARD_COLUMNS = `
  id, title, slug, code, purpose, status, price, price_on_request,
  city, neighborhood, area_total, area_built,
  bedrooms, bathrooms, parking_spaces, is_featured,
  property_type:property_types(name, slug),
  images:property_images(storage_path, alt_text, is_cover, sort_order)
`;

const DETAIL_COLUMNS = `
  *,
  property_type:property_types(id, name, slug),
  region:regions(id, name, slug, city),
  images:property_images(*)
`;

export interface PropertyFilters {
  purpose?: PropertyPurpose;
  type?: string;
  /** Caminho de busca da home (morar, investir, espaço). */
  profile?: Profile;
  city?: string;
  neighborhood?: string;
  region?: string;
  priceMin?: number;
  priceMax?: number;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  areaMin?: number;
  areaMax?: number;
  code?: string;
  inCondo?: boolean;
  furnished?: boolean;
  featured?: boolean;
  status?: PropertyStatus;
  q?: string;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
}

export interface PropertySearchResult {
  items: PropertyCardData[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * Quem pode ser negociado vem antes de quem já foi; dentro disso, quem tem
 * foto vem antes de quem ainda não tem, e os destaques da imobiliária lideram.
 * A ordenação é estável: empates mantêm a ordem que veio do banco.
 */
const CLOSED_STATUSES: PropertyStatus[] = ["vendido", "alugado"];

export function rankForShowcase<T extends PropertyCardData>(items: T[]): T[] {
  const score = (p: T) =>
    (CLOSED_STATUSES.includes(p.status) ? 0 : 4) +
    (p.images?.length ? 2 : 0) +
    (p.is_featured ? 1 : 0);
  return items
    .map((item, index) => ({ item, index, score: score(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}

/**
 * Busca pública de imóveis.
 *
 * A RLS já esconde rascunhos e inativos; ainda assim a consulta é explícita
 * sobre o que quer, para que o mesmo código rode com segurança se um dia for
 * chamado por um usuário autenticado da equipe.
 */
export async function searchProperties(filters: PropertyFilters = {}): Promise<PropertySearchResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? PAGE_SIZE;

  // Antes de o Supabase ser conectado, a listagem volta vazia e a interface
  // mostra o estado vazio — em vez de derrubar a página inteira.
  if (!isSupabaseConfigured()) {
    return { items: [], total: 0, page, pageSize, pageCount: 1 };
  }

  const supabase = createPublicClient();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // !inner no tipo só quando há filtro por tipo: fora isso, imóvel sem tipo
  // cadastrado continuaria aparecendo na listagem.
  const columns = filters.type ? CARD_COLUMNS.replace("property_types(", "property_types!inner(") : CARD_COLUMNS;

  let query = supabase
    .from("properties")
    .select(columns, { count: "exact" })
    .eq("publication_state", "published")
    .neq("status", "inativo");

  if (filters.purpose) query = query.eq("purpose", filters.purpose);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.type) query = query.eq("property_type.slug", filters.type);
  if (filters.profile) {
    const definition = PROFILE_DEFINITIONS[filters.profile];
    const typeIds = (await getPropertyTypes())
      .filter((type) => definition.typeSlugs.includes(type.slug))
      .map((type) => type.id);
    // Tipo cadastrado OU palavra do título: o acervo antigo não tem tipo.
    const conditions = [
      ...(typeIds.length ? [`property_type_id.in.(${typeIds.join(",")})`] : []),
      ...definition.titleWords.map((word) => `title.ilike."*${word}*"`),
      ...(definition.extra ?? []),
    ];
    query = query.or(conditions.join(","));
  }
  if (filters.city) query = query.ilike("city", filters.city);
  if (filters.neighborhood) query = query.ilike("neighborhood", `%${filters.neighborhood}%`);
  if (filters.region) query = query.eq("region_id", filters.region);
  if (filters.priceMin !== undefined) query = query.gte("price", filters.priceMin);
  if (filters.priceMax !== undefined) query = query.lte("price", filters.priceMax);
  if (filters.bedrooms !== undefined) query = query.gte("bedrooms", filters.bedrooms);
  if (filters.bathrooms !== undefined) query = query.gte("bathrooms", filters.bathrooms);
  if (filters.parking !== undefined) query = query.gte("parking_spaces", filters.parking);
  if (filters.areaMin !== undefined) query = query.gte("area_total", filters.areaMin);
  if (filters.areaMax !== undefined) query = query.lte("area_total", filters.areaMax);
  if (filters.code) query = query.ilike("code", `%${filters.code}%`);
  if (filters.inCondo) query = query.eq("in_condo", true);
  if (filters.furnished) query = query.eq("is_furnished", true);
  if (filters.featured) query = query.eq("is_featured", true);

  // Busca livre: usa o índice de texto em português criado na migration.
  if (filters.q) {
    const terms = filters.q.trim().split(/\s+/).filter(Boolean).join(" & ");
    if (terms) query = query.textSearch("search_tsv", terms, { config: "portuguese" });
  }

  const sortKey = filters.sort ?? "recentes";
  const sort = SORT_OPTIONS[sortKey] ?? SORT_OPTIONS.recentes;

  // Ordem padrão: a vitrine não pode abrir com imóvel vendido ou sem foto.
  // O ranking precisa saber se o imóvel tem capa, e isso não é coluna da
  // tabela; com um acervo de dezenas de imóveis, trazer todos os que batem
  // com o filtro e paginar aqui custa uma consulta só. Se o acervo passar de
  // algumas centenas, trocar por uma coluna mantida por trigger.
  if (sortKey === "recentes") {
    const { data, error, count } = await query
      .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
      .order("id", { ascending: true })
      .order("is_cover", { referencedTable: "images", ascending: false })
      .order("sort_order", { referencedTable: "images", ascending: true })
      .limit(1, { referencedTable: "images" });

    if (error) throw new Error(`Falha ao buscar imóveis: ${error.message}`);

    const ranked = rankForShowcase((data ?? []) as unknown as PropertyCardData[]);
    const total = count ?? ranked.length;

    return {
      items: ranked.slice(from, to + 1),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  query = query
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    // Desempate estável: sem isso a paginação pode repetir ou pular itens.
    .order("id", { ascending: true })
    .order("is_cover", { referencedTable: "images", ascending: false })
    .order("sort_order", { referencedTable: "images", ascending: true })
    .limit(1, { referencedTable: "images" })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(`Falha ao buscar imóveis: ${error.message}`);

  const total = count ?? 0;

  return {
    items: (data ?? []) as unknown as PropertyCardData[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getFeaturedProperties(limit = 6): Promise<PropertyCardData[]> {
  const { items } = await searchProperties({ featured: true, pageSize: limit, sort: "recentes" });
  return items;
}

/**
 * A vitrine da home: os destaques primeiro e, se forem poucos, os publicados
 * mais recentes completam a grade — um card sozinho numa fileira de três
 * parece defeito. O selo "Destaque" continua só em quem a imobiliária marcou:
 * nada é promovido por conta própria.
 */
export async function getShowcaseProperties(limit = 6): Promise<PropertyCardData[]> {
  // A vitrine é a primeira impressão: imóvel vendido ou sem foto não entra,
  // nem se estiver marcado como destaque. O ranking já põe os destaques com
  // foto na frente e completa com os demais publicados.
  const { items } = await searchProperties({ pageSize: 1000, sort: "recentes" });
  const presentable = items.filter(
    (property) => property.images?.length && !CLOSED_STATUSES.includes(property.status)
  );
  return presentable.slice(0, limit);
}

export async function getPropertyBySlug(slug: string): Promise<PropertyWithRelations | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("properties")
    .select(DETAIL_COLUMNS)
    .eq("slug", slug)
    .eq("publication_state", "published")
    .neq("status", "inativo")
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar o imóvel: ${error.message}`);
  if (!data) return null;

  const property = data as unknown as PropertyWithRelations;
  property.images = [...(property.images ?? [])].sort(
    (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order
  );

  return property;
}

/** Imóveis parecidos: mesma cidade, mesma finalidade, exceto ele mesmo. */
export async function getRelatedProperties(
  property: Pick<PropertyWithRelations, "id" | "city" | "purpose" | "property_type_id">,
  limit = 3
): Promise<PropertyCardData[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("properties")
    .select(CARD_COLUMNS)
    .eq("publication_state", "published")
    .neq("status", "inativo")
    .neq("id", property.id)
    .eq("purpose", property.purpose)
    .ilike("city", property.city)
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("is_cover", { referencedTable: "images", ascending: false })
    .limit(1, { referencedTable: "images" })
    .limit(limit * 6);

  if (error) throw new Error(`Falha ao carregar imóveis relacionados: ${error.message}`);
  // Sugestão só faz sentido se ainda dá para negociar.
  const open = ((data ?? []) as unknown as PropertyCardData[]).filter(
    (property) => !CLOSED_STATUSES.includes(property.status)
  );
  return rankForShowcase(open).slice(0, limit);
}

/** Usado por generateStaticParams e pelo sitemap. */
export async function getPublishedPropertyRefs(): Promise<
  { slug: string; updated_at: string; published_at: string | null }[]
> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("properties")
    .select("slug, updated_at, published_at")
    .eq("publication_state", "published")
    .neq("status", "inativo")
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) throw new Error(`Falha ao listar imóveis: ${error.message}`);
  return data ?? [];
}

/** Números do acervo, para a Home e o painel. */
export async function getPropertyCounts() {
  if (!isSupabaseConfigured()) return { total: 0, cities: 0 };

  const supabase = createPublicClient();

  const { count: total } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("publication_state", "published")
    .neq("status", "inativo");

  const { data: cities } = await supabase
    .from("properties")
    .select("city")
    .eq("publication_state", "published")
    .neq("status", "inativo");

  return {
    total: total ?? 0,
    cities: new Set((cities ?? []).map((row) => row.city)).size,
  };
}

/** Faixa de preço real do acervo — alimenta o filtro sem valores inventados. */
export async function getPriceRange(): Promise<{ min: number; max: number } | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createPublicClient();

  const [{ data: lowest }, { data: highest }] = await Promise.all([
    supabase
      .from("properties")
      .select("price")
      .eq("publication_state", "published")
      .neq("status", "inativo")
      .not("price", "is", null)
      .gt("price", 0)
      .order("price", { ascending: true })
      .limit(1),
    supabase
      .from("properties")
      .select("price")
      .eq("publication_state", "published")
      .neq("status", "inativo")
      .not("price", "is", null)
      .order("price", { ascending: false })
      .limit(1),
  ]);

  const min = lowest?.[0]?.price;
  const max = highest?.[0]?.price;
  if (min === undefined || max === undefined || min === null || max === null) return null;

  return { min: Number(min), max: Number(max) };
}

/** Busca por lista de ids — usado pela página de favoritos. */
export async function getPropertiesByIds(ids: string[]): Promise<PropertyCardData[]> {
  if (!isSupabaseConfigured() || ids.length === 0) return [];

  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("properties")
    .select(CARD_COLUMNS)
    // Limite defensivo: a lista vem do navegador do visitante.
    .in("id", ids.slice(0, 100))
    .eq("publication_state", "published")
    .neq("status", "inativo")
    .order("is_cover", { referencedTable: "images", ascending: false })
    .limit(1, { referencedTable: "images" });

  if (error) throw new Error(`Falha ao carregar favoritos: ${error.message}`);
  return (data ?? []) as unknown as PropertyCardData[];
}

/**
 * Capa de reserva para cada região sem foto própria: a foto do melhor imóvel
 * publicado nela (disponível, com destaque na frente). É uma foto real da
 * região, e o cartão deixa de ser um retângulo verde vazio. Uma consulta só
 * para todas as regiões.
 */
export async function getRegionCovers(): Promise<Map<string, string>> {
  if (!isSupabaseConfigured()) return new Map();

  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("properties")
    .select(`region_id, ${CARD_COLUMNS}`)
    .eq("publication_state", "published")
    .neq("status", "inativo")
    .not("region_id", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("is_cover", { referencedTable: "images", ascending: false })
    .order("sort_order", { referencedTable: "images", ascending: true })
    .limit(1, { referencedTable: "images" });

  if (error) throw new Error(`Falha ao carregar capas das regiões: ${error.message}`);

  const covers = new Map<string, string>();
  const ranked = rankForShowcase((data ?? []) as unknown as (PropertyCardData & { region_id: string })[]);
  for (const property of ranked) {
    const path = property.images?.[0]?.storage_path;
    if (path && !covers.has(property.region_id)) covers.set(property.region_id, path);
  }
  return covers;
}
