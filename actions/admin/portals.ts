"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { isMissingTable } from "@/lib/queries/crm";
import { PORTALS, isPortalId } from "@/lib/portals/definitions";
import type { FormState } from "@/lib/validations/lead";

/**
 * Configuração dos portais. Ligar/desligar, trocar o link e mapear tipos é
 * de administrador; escolher quais imóveis vão para cada portal, da equipe.
 */

function friendly(error: { code?: string; message: string }): string {
  if (isMissingTable(error)) return "O CRM ainda não foi instalado no banco (migration 0005).";
  if (error.message.includes("row-level security")) return "Sua conta não tem permissão para esta ação.";
  console.error("[portais]", error.message);
  return "Não foi possível salvar agora. Tente de novo em instantes.";
}

export async function savePortalSettings(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdmin("/portais");
  const portal = String(formData.get("portal") ?? "");
  if (!isPortalId(portal)) return { status: "error", message: "Portal inválido." };

  const allowed = new Set(PORTALS[portal].typeOptions.map((option) => option.value));
  const typeMap: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("type_") || typeof value !== "string" || !value) continue;
    const typeId = key.slice(5);
    if (z.string().uuid().safeParse(typeId).success && allowed.has(value)) typeMap[typeId] = value;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("portal_settings")
    .update({ enabled: formData.get("enabled") === "on", type_map: typeMap, updated_by: session.userId })
    .eq("portal", portal);
  if (error) return { status: "error", message: friendly(error) };

  revalidatePath("/admin", "layout");
  return { status: "success", message: "Configuração salva." };
}

export async function regeneratePortalToken(formData: FormData): Promise<void> {
  const session = await requireAdmin("/portais");
  const portal = String(formData.get("portal") ?? "");
  if (!isPortalId(portal)) return;

  const supabase = await createClient();
  await supabase
    .from("portal_settings")
    .update({ feed_token: randomBytes(18).toString("hex"), updated_by: session.userId })
    .eq("portal", portal);
  revalidatePath("/admin", "layout");
}

/**
 * Grava de uma vez a coluna de um portal na lista de imóveis: marcados
 * entram (ou atualizam o destaque), desmarcados saem.
 */
export async function savePortalListings(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireStaff("/portais");
  const portal = String(formData.get("portal") ?? "");
  if (!isPortalId(portal)) return { status: "error", message: "Portal inválido." };

  const uuid = z.string().uuid();
  const ids = formData.getAll("ids").filter((value): value is string => typeof value === "string" && uuid.safeParse(value).success);
  const listed = ids.filter((id) => formData.get(`on_${id}`) === "on");
  const removed = ids.filter((id) => !listed.includes(id));

  const supabase = await createClient();
  if (listed.length) {
    const { error } = await supabase.from("portal_listings").upsert(
      listed.map((id) => ({ property_id: id, portal, highlight: formData.get(`hl_${id}`) === "on" })),
      { onConflict: "property_id,portal" }
    );
    if (error) return { status: "error", message: friendly(error) };
  }
  if (removed.length) {
    const { error } = await supabase.from("portal_listings").delete().eq("portal", portal).in("property_id", removed);
    if (error) return { status: "error", message: friendly(error) };
  }

  revalidatePath("/admin", "layout");
  return {
    status: "success",
    message: `${listed.length} ${listed.length === 1 ? "imóvel marcado" : "imóveis marcados"} para ${PORTALS[portal].name}.`,
  };
}
