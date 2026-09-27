"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { STORAGE_BUCKETS } from "@/lib/site";
import type { FormState } from "@/lib/validations/lead";

/**
 * Vídeos do imóvel.
 *
 * O arquivo sobe direto do navegador para o Storage (lib/resumable-upload.ts);
 * aqui só se registra o que subiu, se reordena e se apaga. Mesmo modelo das
 * fotos em actions/admin/properties.ts.
 */

const MAX_VIDEOS = 20;

/** Caminho dentro do bucket: pasta do imóvel + arquivo, sem "..", sem barra inicial. */
const storagePath = z
  .string()
  .min(3)
  .max(300)
  .regex(/^[\w-]+\/[\w.-]+$/, "Caminho inválido")
  .refine((value) => !value.includes(".."), "Caminho inválido");

const videoSchema = z.object({
  property_id: z.string().uuid(),
  storage_path: storagePath,
  poster_path: storagePath.nullable(),
  mime_type: z.enum(["video/mp4", "video/quicktime", "video/webm"]),
  size_bytes: z.number().int().nonnegative().max(5 * 1024 * 1024 * 1024),
  duration_seconds: z.number().nonnegative().max(24 * 3600).nullable(),
  width: z.number().int().positive().max(10000).nullable(),
  height: z.number().int().positive().max(10000).nullable(),
});

export type RegisterVideoInput = z.infer<typeof videoSchema>;

async function revalidate(propertyId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("properties").select("slug").eq("id", propertyId).maybeSingle();
  if (data?.slug) revalidatePath(`/imoveis/${data.slug}`);
  revalidatePath(`/admin/imoveis/${propertyId}`);
}

export async function registerPropertyVideo(input: RegisterVideoInput): Promise<FormState> {
  await requireStaff();

  const parsed = videoSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Dados do vídeo inválidos." };

  const supabase = await createClient();

  const { data: existing, error: countError } = await supabase
    .from("property_videos")
    .select("sort_order")
    .eq("property_id", parsed.data.property_id)
    .order("sort_order", { ascending: false });

  if (countError) return { status: "error", message: `Falha ao salvar o vídeo: ${countError.message}` };
  if ((existing?.length ?? 0) >= MAX_VIDEOS) {
    return { status: "error", message: `Cada imóvel aceita até ${MAX_VIDEOS} vídeos.` };
  }

  const { error } = await supabase.from("property_videos").insert({
    ...parsed.data,
    duration_seconds: parsed.data.duration_seconds === null ? null : Math.round(parsed.data.duration_seconds * 100) / 100,
    sort_order: (existing?.[0]?.sort_order ?? -1) + 1,
  });

  if (error) return { status: "error", message: `Falha ao salvar o vídeo: ${error.message}` };

  await revalidate(parsed.data.property_id);
  return { status: "success", message: "Vídeo enviado." };
}

export async function deletePropertyVideo(formData: FormData): Promise<void> {
  await requireStaff();

  const parsed = z
    .object({ id: z.string().uuid(), property_id: z.string().uuid() })
    .safeParse({ id: formData.get("id"), property_id: formData.get("property_id") });
  if (!parsed.success) return;

  const supabase = await createClient();

  const { data: video } = await supabase
    .from("property_videos")
    .select("storage_path, poster_path")
    .eq("id", parsed.data.id)
    .eq("property_id", parsed.data.property_id)
    .maybeSingle();
  if (!video) return;

  await supabase.from("property_videos").delete().eq("id", parsed.data.id);
  await supabase.storage
    .from(STORAGE_BUCKETS.video)
    .remove([video.storage_path, video.poster_path].filter((path): path is string => Boolean(path)));

  await revalidate(parsed.data.property_id);
}

export async function reorderPropertyVideos(propertyId: string, orderedIds: string[]): Promise<FormState> {
  await requireStaff();

  const parsed = z
    .object({ property_id: z.string().uuid(), ids: z.array(z.string().uuid()).max(MAX_VIDEOS) })
    .safeParse({ property_id: propertyId, ids: orderedIds });
  if (!parsed.success) return { status: "error", message: "Ordem inválida." };

  const supabase = await createClient();
  for (const [index, id] of parsed.data.ids.entries()) {
    const { error } = await supabase
      .from("property_videos")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("property_id", parsed.data.property_id);
    if (error) return { status: "error", message: `Falha ao reordenar: ${error.message}` };
  }

  await revalidate(parsed.data.property_id);
  return { status: "success", message: "Ordem salva." };
}
