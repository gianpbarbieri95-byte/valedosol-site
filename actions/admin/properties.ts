"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { propertySchema, coordinatesAreConsistent } from "@/lib/validations/property";
import { fieldErrors, type FormState } from "@/lib/validations/lead";
import { STORAGE_BUCKETS } from "@/lib/site";
import { codePrefix, highestBySeries, nextPropertyCode } from "@/lib/property-code";
import { PORTAL_IDS } from "@/lib/portals/definitions";

/**
 * CRUD de imóveis.
 *
 * Toda ação confere a sessão antes de tocar no banco e, mesmo assim, a RLS
 * confere de novo — o cliente com cookies nunca usa service role.
 */

function formToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

/** Republica as páginas afetadas para o site sair do ar desatualizado. */
function revalidateProperty(slug?: string | null) {
  revalidatePath("/");
  revalidatePath("/imoveis");
  revalidatePath("/regioes", "layout");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/imoveis/${slug}`);
}

export async function saveProperty(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await requireStaff();

  const parsed = propertySchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", message: "Confira os campos destacados.", errors: fieldErrors(parsed.error) };
  }

  const input = parsed.data;

  if (!coordinatesAreConsistent(input)) {
    return {
      status: "error",
      message: "Latitude e longitude precisam ser preenchidas juntas — ou nenhuma das duas.",
      errors: { latitude: "Preencha as duas coordenadas ou deixe ambas em branco." },
    };
  }

  if (!input.price && !input.price_on_request) {
    return {
      status: "error",
      message: "Informe o preço ou marque 'valor sob consulta'.",
      errors: { price: "Informe um valor ou marque sob consulta." },
    };
  }

  const supabase = await createClient();
  const { id, code, ...values } = input;

  const payload = {
    ...values,
    // O preço some quando é sob consulta, para não vazar um número antigo.
    price: values.price_on_request ? null : values.price,
  };

  if (id) {
    // Na edição o código só muda se alguém corrigir de propósito.
    const changes = code ? { ...payload, code } : payload;
    const { data, error } = await supabase
      .from("properties")
      .update(changes)
      .eq("id", id)
      .select("slug")
      .maybeSingle();

    if (error) return { status: "error", message: friendlyError(error.message) };
    if (!data) return { status: "error", message: "Imóvel não encontrado ou sem permissão para editar." };

    const crmProblem = await syncCrmFields(supabase, id, formData);

    revalidateProperty(data.slug);
    revalidatePath("/admin/imoveis");
    revalidatePath(`/admin/imoveis/${id}`);

    if (crmProblem) {
      return { status: "error", message: `Imóvel salvo, mas não foi possível atualizar ${crmProblem}. Confira e salve de novo.` };
    }
    return { status: "success", message: "Imóvel salvo." };
  }

  // Cadastro: o código é sempre do sistema, nunca do formulário.
  let typeSlug: string | null = null;
  if (values.property_type_id) {
    const { data: type } = await supabase
      .from("property_types")
      .select("slug")
      .eq("id", values.property_type_id)
      .maybeSingle();
    typeSlug = type?.slug ?? null;
  }

  const { data: existing, error: codesError } = await supabase.from("properties").select("code");
  if (codesError) return { status: "error", message: friendlyError(codesError.message) };

  const prefix = codePrefix(values.purpose, typeSlug);
  const highest = highestBySeries((existing ?? []).map((row) => row.code));

  // Dois cadastros ao mesmo tempo podem disputar o mesmo número: a coluna é
  // única, então quem perder tenta o número seguinte.
  let data: { id: string; slug: string } | null = null;
  let error: { message: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    ({ data, error } = await supabase
      .from("properties")
      .insert({ ...payload, code: nextPropertyCode(prefix, highest, attempt), created_by: session.userId })
      .select("id, slug")
      .single());
    if (!error || !error.message.includes("properties_code_key")) break;
  }

  if (error || !data) return { status: "error", message: friendlyError(error?.message ?? "sem resposta") };

  const crmProblem = await syncCrmFields(supabase, data.id, formData);

  revalidateProperty(data.slug);
  revalidatePath("/admin/imoveis");
  redirect(`/imoveis/${data.id}?criado=1${crmProblem ? `&aviso=${crmProblem}` : ""}`);
}

/**
 * Proprietários e portais do imóvel (etapas que só existem com o CRM
 * instalado — o formulário manda crm_fields=1). Falha aqui não desfaz o
 * imóvel salvo: devolve um aviso para a pessoa conferir essas etapas.
 */
async function syncCrmFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  formData: FormData
): Promise<string | null> {
  if (formData.get("crm_fields") !== "1") return null;

  const uuid = z.string().uuid();
  const ownerIds = [...new Set(formData.getAll("owner_ids").filter((value) => uuid.safeParse(value).success) as string[])];

  const { data: currentOwners, error: ownersError } = await supabase
    .from("property_owners")
    .select("client_id")
    .eq("property_id", propertyId);
  if (ownersError) return "proprietários";

  const current = new Set((currentOwners ?? []).map((row) => row.client_id as string));
  const toRemove = [...current].filter((id) => !ownerIds.includes(id));
  const toAdd = ownerIds.filter((id) => !current.has(id));

  if (toRemove.length) {
    const { error } = await supabase.from("property_owners").delete().eq("property_id", propertyId).in("client_id", toRemove);
    if (error) return "proprietários";
  }
  if (toAdd.length) {
    const { error } = await supabase
      .from("property_owners")
      .insert(toAdd.map((client_id) => ({ property_id: propertyId, client_id })));
    if (error) return "proprietários";
  }

  for (const portal of PORTAL_IDS) {
    const listed = formData.get(`portal_${portal}`) === "on";
    const highlight = formData.get(`portal_${portal}_highlight`) === "on";
    const { error } = listed
      ? await supabase
          .from("portal_listings")
          .upsert({ property_id: propertyId, portal, highlight }, { onConflict: "property_id,portal" })
      : await supabase.from("portal_listings").delete().eq("property_id", propertyId).eq("portal", portal);
    if (error) return "portais";
  }

  return null;
}

/** Traduz erro do Postgres em frase que o corretor entende. */
function friendlyError(message: string): string {
  if (message.includes("properties_code_key")) {
    return "Já existe um imóvel com esse código. Use outro.";
  }
  if (message.includes("properties_slug_key")) {
    return "Já existe um imóvel com esse endereço de página. Mude o campo 'endereço da página'.";
  }
  if (message.includes("row-level security")) {
    return "Sua conta não tem permissão para esta ação.";
  }
  return `Não foi possível salvar: ${message}`;
}

export async function setPublicationState(formData: FormData): Promise<void> {
  await requireStaff();

  const parsed = z
    .object({
      id: z.string().uuid(),
      state: z.enum(["draft", "published", "archived"]),
    })
    .safeParse({ id: formData.get("id"), state: formData.get("state") });

  if (!parsed.success) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .update({ publication_state: parsed.data.state })
    .eq("id", parsed.data.id)
    .select("slug")
    .maybeSingle();

  revalidateProperty(data?.slug);
  revalidatePath("/admin/imoveis");
  revalidatePath(`/admin/imoveis/${parsed.data.id}`);
}

/**
 * Exclusão é ação de administrador e existe para casos de cadastro errado.
 * Imóvel vendido ou alugado se arquiva — o histórico tem valor.
 */
export async function deleteProperty(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();

  // Remove as fotos do Storage antes da linha: o cascade apaga os registros,
  // mas não os arquivos.
  const { data: images } = await supabase
    .from("property_images")
    .select("storage_path")
    .eq("property_id", id.data);

  if (images?.length) {
    await supabase.storage.from(STORAGE_BUCKETS.property).remove(images.map((image) => image.storage_path));
  }

  const { data } = await supabase.from("properties").delete().eq("id", id.data).select("slug").maybeSingle();

  revalidateProperty(data?.slug);
  revalidatePath("/admin/imoveis");
  redirect("/imoveis?excluido=1");
}

/* --------------------------------------------------------------- imagens */

const imageListSchema = z.object({
  property_id: z.string().uuid(),
  paths: z.array(z.string().min(1).max(400)).max(60),
});

/**
 * Registra no banco as fotos que o navegador acabou de enviar ao Storage.
 * O upload em si vai direto do navegador para o Supabase (autenticado, sob
 * as mesmas policies), o que evita empurrar dezenas de MB por server action.
 */
export async function registerPropertyImages(propertyId: string, paths: string[]): Promise<FormState> {
  await requireStaff();

  const parsed = imageListSchema.safeParse({ property_id: propertyId, paths });
  if (!parsed.success) return { status: "error", message: "Arquivos inválidos." };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("property_images")
    .select("id, sort_order")
    .eq("property_id", propertyId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const hasImages = Boolean(existing?.length);
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("property_images").insert(
    parsed.data.paths.map((path, index) => ({
      property_id: propertyId,
      storage_path: path,
      sort_order: nextOrder + index,
      // A primeira foto do primeiro envio vira capa automaticamente.
      is_cover: !hasImages && index === 0,
    }))
  );

  if (error) return { status: "error", message: `Falha ao salvar as fotos: ${error.message}` };

  revalidatePath(`/admin/imoveis/${propertyId}`);
  return { status: "success", message: "Fotos enviadas." };
}

export async function setCoverImage(formData: FormData): Promise<void> {
  await requireStaff();

  const parsed = z
    .object({ id: z.string().uuid(), property_id: z.string().uuid() })
    .safeParse({ id: formData.get("id"), property_id: formData.get("property_id") });

  if (!parsed.success) return;

  const supabase = await createClient();

  // Há índice único de uma capa por imóvel: limpa antes de marcar a nova.
  await supabase
    .from("property_images")
    .update({ is_cover: false })
    .eq("property_id", parsed.data.property_id)
    .eq("is_cover", true);

  await supabase.from("property_images").update({ is_cover: true }).eq("id", parsed.data.id);

  const { data } = await supabase
    .from("properties")
    .select("slug")
    .eq("id", parsed.data.property_id)
    .maybeSingle();

  revalidateProperty(data?.slug);
  revalidatePath(`/admin/imoveis/${parsed.data.property_id}`);
}

export async function deletePropertyImage(formData: FormData): Promise<void> {
  await requireStaff();

  const parsed = z
    .object({ id: z.string().uuid(), property_id: z.string().uuid() })
    .safeParse({ id: formData.get("id"), property_id: formData.get("property_id") });

  if (!parsed.success) return;

  const supabase = await createClient();

  const { data: image } = await supabase
    .from("property_images")
    .select("storage_path, is_cover")
    .eq("id", parsed.data.id)
    .maybeSingle();

  await supabase.from("property_images").delete().eq("id", parsed.data.id);

  if (image?.storage_path) {
    await supabase.storage.from(STORAGE_BUCKETS.property).remove([image.storage_path]);
  }

  // Apagou a capa: a próxima foto assume, para o card não ficar sem imagem.
  if (image?.is_cover) {
    const { data: next } = await supabase
      .from("property_images")
      .select("id")
      .eq("property_id", parsed.data.property_id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (next) await supabase.from("property_images").update({ is_cover: true }).eq("id", next.id);
  }

  const { data } = await supabase
    .from("properties")
    .select("slug")
    .eq("id", parsed.data.property_id)
    .maybeSingle();

  revalidateProperty(data?.slug);
  revalidatePath(`/admin/imoveis/${parsed.data.property_id}`);
}

export async function reorderPropertyImages(propertyId: string, orderedIds: string[]): Promise<FormState> {
  await requireStaff();

  const parsed = z.array(z.string().uuid()).max(60).safeParse(orderedIds);
  if (!parsed.success) return { status: "error", message: "Ordem inválida." };

  const supabase = await createClient();

  for (const [index, id] of parsed.data.entries()) {
    const { error } = await supabase
      .from("property_images")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("property_id", propertyId);

    if (error) return { status: "error", message: `Falha ao reordenar: ${error.message}` };
  }

  const { data } = await supabase.from("properties").select("slug").eq("id", propertyId).maybeSingle();

  revalidateProperty(data?.slug);
  revalidatePath(`/admin/imoveis/${propertyId}`);
  return { status: "success", message: "Ordem salva." };
}
