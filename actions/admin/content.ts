"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { propertyTypeSchema, regionSchema } from "@/lib/validations/property";
import { fieldErrors, type FormState } from "@/lib/validations/lead";
import { STORAGE_BUCKETS } from "@/lib/site";

function formToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

/* ------------------------------------------------------------- regiões */

export async function saveRegion(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireStaff("/regioes");

  const parsed = regionSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", message: "Confira os campos.", errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { id, ...values } = parsed.data;

  const { error } = id
    ? await supabase.from("regions").update(values).eq("id", id)
    : await supabase.from("regions").insert(values);

  if (error) {
    return {
      status: "error",
      message: error.message.includes("regions_slug_key")
        ? "Já existe uma região com esse endereço de página."
        : `Não foi possível salvar: ${error.message}`,
    };
  }

  revalidatePath("/admin/regioes");
  revalidatePath("/regioes", "layout");
  revalidatePath("/");

  return { status: "success", message: id ? "Região atualizada." : "Região criada." };
}

export async function deleteRegion(formData: FormData): Promise<void> {
  await requireAdmin("/regioes");

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();

  const { data: region } = await supabase.from("regions").select("image_path").eq("id", id.data).maybeSingle();

  // Os imóveis não somem junto: region_id é ON DELETE SET NULL.
  await supabase.from("regions").delete().eq("id", id.data);

  if (region?.image_path) {
    await supabase.storage.from(STORAGE_BUCKETS.region).remove([region.image_path]);
  }

  revalidatePath("/admin/regioes");
  revalidatePath("/regioes", "layout");
}

/* ------------------------------------------------------ tipos de imóvel */

export async function savePropertyType(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireStaff("/tipos-imovel");

  const parsed = propertyTypeSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", message: "Confira os campos.", errors: fieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { id, ...values } = parsed.data;

  const { error } = id
    ? await supabase.from("property_types").update(values).eq("id", id)
    : await supabase.from("property_types").insert(values);

  if (error) {
    return {
      status: "error",
      message: error.message.includes("property_types_slug_key")
        ? "Já existe um tipo com esse identificador."
        : `Não foi possível salvar: ${error.message}`,
    };
  }

  revalidatePath("/admin/tipos-imovel");
  revalidatePath("/imoveis");
  revalidatePath("/");

  return { status: "success", message: id ? "Tipo atualizado." : "Tipo criado." };
}

/**
 * Tipo em uso não é excluído: a chave estrangeira é ON DELETE RESTRICT, de
 * propósito. A saída é desativar, e aí ele some dos filtros sem que nenhum
 * imóvel perca a classificação.
 */
export async function deletePropertyType(formData: FormData): Promise<void> {
  await requireAdmin("/tipos-imovel");

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  const { error } = await supabase.from("property_types").delete().eq("id", id.data);

  if (error) {
    await supabase.from("property_types").update({ active: false }).eq("id", id.data);
  }

  revalidatePath("/admin/tipos-imovel");
  revalidatePath("/imoveis");
}

/* -------------------------------------------------------- configurações */

const SETTING_KEYS = ["contact", "social", "hero", "about", "seo", "analytics"] as const;

/**
 * Configurações do site.
 *
 * Só administrador salva (a RLS de site_settings exige isso). Os campos
 * chegam como `contact.phone`, `about.mission` e assim por diante, e são
 * remontados em jsonb por chave.
 */
export async function saveSettings(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdmin("/configuracoes");

  const grouped: Record<string, Record<string, string>> = {};

  for (const [field, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const [group, key] = field.split(".");
    if (!group || !key) continue;
    if (!(SETTING_KEYS as readonly string[]).includes(group)) continue;
    grouped[group] ??= {};
    grouped[group][key] = value.trim();
  }

  if (Object.keys(grouped).length === 0) {
    return { status: "error", message: "Nada para salvar." };
  }

  const supabase = await createClient();

  for (const [key, value] of Object.entries(grouped)) {
    // Mescla com o que já existe: um formulário parcial não apaga o resto.
    const { data: current } = await supabase.from("site_settings").select("value").eq("key", key).maybeSingle();
    const merged = { ...((current?.value as Record<string, unknown>) ?? {}), ...value };

    const { error } = await supabase
      .from("site_settings")
      .upsert({ key, value: merged, is_public: true, updated_by: session.userId }, { onConflict: "key" });

    if (error) return { status: "error", message: `Não foi possível salvar: ${error.message}` };
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/configuracoes");

  return { status: "success", message: "Configurações salvas." };
}
