import { cache } from "react";
import { createPublicClient, isSupabaseConfigured } from "@/lib/supabase/public";
import type { PropertyType, Region } from "@/types/database";

/**
 * Tipos de imóvel e regiões alimentam os filtros de busca e o menu.
 * Se o banco ainda não estiver conectado, as listas voltam vazias e a
 * interface esconde o filtro em vez de mostrar opção que não funciona.
 */

export const getPropertyTypes = cache(async (): Promise<PropertyType[]> => {
  if (!isSupabaseConfigured()) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("property_types")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) return [];
  return data ?? [];
});

export const getRegions = cache(async (): Promise<Region[]> => {
  if (!isSupabaseConfigured()) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return [];
  return data ?? [];
});

export async function getRegionBySlug(slug: string): Promise<Region | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error) return null;
  return data;
}

/** Cidades distintas do acervo publicado, para o filtro de cidade. */
export const getCities = cache(async (): Promise<string[]> => {
  if (!isSupabaseConfigured()) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("properties")
    .select("city")
    .eq("publication_state", "published")
    .neq("status", "inativo");

  if (error) return [];
  return [...new Set((data ?? []).map((row) => row.city).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
});

/** Bairros de uma cidade (ou de todas), para o filtro dependente. */
export const getNeighborhoods = cache(async (city?: string): Promise<string[]> => {
  if (!isSupabaseConfigured()) return [];

  const supabase = createPublicClient();
  let query = supabase
    .from("properties")
    .select("neighborhood")
    .eq("publication_state", "published")
    .neq("status", "inativo")
    .not("neighborhood", "is", null);

  if (city) query = query.ilike("city", city);

  const { data, error } = await query;
  if (error) return [];

  return [...new Set((data ?? []).map((row) => row.neighborhood).filter(Boolean) as string[])].sort(
    (a, b) => a.localeCompare(b, "pt-BR")
  );
});
