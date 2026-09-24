"use server";

import { z } from "zod";
import { getPropertiesByIds } from "@/lib/queries/properties";
import type { PropertyCardData } from "@/types/database";

const idsSchema = z.array(z.string().uuid()).max(100);

/**
 * Carrega os imóveis favoritados a partir dos ids guardados no navegador.
 * Leitura pública: passa pela RLS como qualquer visitante e só devolve o
 * que está publicado — um id inventado à mão não revela rascunho nenhum.
 */
export async function fetchPropertiesByIds(ids: string[]): Promise<PropertyCardData[]> {
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return [];
  return getPropertiesByIds(parsed.data);
}
