import "server-only";
import { highestBySeries } from "@/lib/property-code";

import { createClient } from "@/lib/supabase/server";
import type { Lead, Property, PropertyImage, PropertyStatus } from "@/types/database";

/**
 * Consultas do painel.
 *
 * Usam o cliente com sessão (cookies), então enxergam exatamente o que a RLS
 * permite ao usuário logado — inclusive rascunhos, que o site público não vê.
 */

export interface DashboardStats {
  total: number;
  published: number;
  drafts: number;
  featured: number;
  byStatus: Record<PropertyStatus, number>;
  leadsTotal: number;
  leadsNew: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const [{ data: properties }, { data: leads }] = await Promise.all([
    supabase.from("properties").select("status, publication_state, is_featured"),
    supabase.from("leads").select("status"),
  ]);

  const rows = properties ?? [];
  const byStatus = {
    disponivel: 0,
    reservado: 0,
    vendido: 0,
    alugado: 0,
    inativo: 0,
  } as Record<PropertyStatus, number>;

  for (const row of rows) {
    byStatus[row.status as PropertyStatus] = (byStatus[row.status as PropertyStatus] ?? 0) + 1;
  }

  return {
    total: rows.length,
    published: rows.filter((row) => row.publication_state === "published").length,
    drafts: rows.filter((row) => row.publication_state === "draft").length,
    featured: rows.filter((row) => row.is_featured).length,
    byStatus,
    leadsTotal: (leads ?? []).length,
    leadsNew: (leads ?? []).filter((lead) => lead.status === "novo").length,
  };
}

export interface AdminPropertyRow extends Property {
  property_type: { name: string } | null;
  images: Pick<PropertyImage, "storage_path" | "is_cover">[];
}

export async function listAdminProperties(options: {
  search?: string;
  state?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const supabase = await createClient();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = options.pageSize ?? 20;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("properties")
    .select("*, property_type:property_types(name), images:property_images(storage_path, is_cover)", {
      count: "exact",
    });

  if (options.search) {
    const term = options.search.replace(/[%,]/g, " ").trim();
    if (term) query = query.or(`title.ilike.%${term}%,code.ilike.%${term}%,neighborhood.ilike.%${term}%`);
  }
  if (options.state) query = query.eq("publication_state", options.state);
  if (options.status) query = query.eq("status", options.status);

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .order("is_cover", { referencedTable: "images", ascending: false })
    .limit(1, { referencedTable: "images" })
    .range(from, from + pageSize - 1);

  if (error) throw new Error(`Falha ao listar imóveis: ${error.message}`);

  return {
    items: (data ?? []) as unknown as AdminPropertyRow[],
    total: count ?? 0,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export async function getAdminProperty(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("properties")
    .select("*, images:property_images(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar o imóvel: ${error.message}`);
  if (!data) return null;

  const property = data as unknown as Property & { images: PropertyImage[] };
  property.images = [...(property.images ?? [])].sort(
    (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order
  );

  return property;
}

export interface AdminLeadRow extends Lead {
  property: { title: string; slug: string; code: string } | null;
}

export async function listLeads(options: { status?: string; source?: string; page?: number } = {}) {
  const supabase = await createClient();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = 25;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from("leads")
    .select("*, property:properties(title, slug, code)", { count: "exact" });

  if (options.status) query = query.eq("status", options.status);
  if (options.source) query = query.eq("source", options.source);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throw new Error(`Falha ao listar contatos: ${error.message}`);

  return {
    items: (data ?? []) as unknown as AdminLeadRow[],
    total: count ?? 0,
    page,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export async function listAdminRegions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .order("city", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Falha ao listar regiões: ${error.message}`);
  return data ?? [];
}

/** Maior número já usado em cada série de código (VRC, VRB, VCh...). */
export async function getCodeSeries(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("properties").select("code");
  if (error) throw new Error(`Falha ao ler os códigos: ${error.message}`);
  return Object.fromEntries(highestBySeries((data ?? []).map((row) => row.code)));
}

export async function listAdminPropertyTypes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_types")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Falha ao listar tipos: ${error.message}`);
  return data ?? [];
}

export async function getAllSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("site_settings").select("*").order("key");

  if (error) throw new Error(`Falha ao carregar configurações: ${error.message}`);
  return data ?? [];
}
