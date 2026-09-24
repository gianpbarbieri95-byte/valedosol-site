"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { LEAD_STATUSES } from "@/lib/site";

export async function updateLeadStatus(formData: FormData): Promise<void> {
  await requireStaff("/admin/leads");

  const parsed = z
    .object({ id: z.string().uuid(), status: z.enum(LEAD_STATUSES) })
    .safeParse({ id: formData.get("id"), status: formData.get("status") });

  if (!parsed.success) return;

  const session = await requireStaff("/admin/leads");
  const supabase = await createClient();

  await supabase
    .from("leads")
    .update({
      status: parsed.data.status,
      // Registra quem assumiu o atendimento — some se voltar para "novo".
      handled_by: parsed.data.status === "novo" ? null : session.userId,
    })
    .eq("id", parsed.data.id);

  revalidatePath("/admin/leads");
  revalidatePath("/admin/dashboard");
}

export async function saveLeadNotes(formData: FormData): Promise<void> {
  await requireStaff("/admin/leads");

  const parsed = z
    .object({ id: z.string().uuid(), notes: z.string().max(4000) })
    .safeParse({ id: formData.get("id"), notes: formData.get("notes") ?? "" });

  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.from("leads").update({ notes: parsed.data.notes.trim() || null }).eq("id", parsed.data.id);

  revalidatePath("/admin/leads");
}

export async function deleteLead(formData: FormData): Promise<void> {
  await requireAdmin("/admin/leads");

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();

  // Anexos enviados pelo visitante saem do bucket junto com o registro.
  const { data: lead } = await supabase.from("leads").select("attachments").eq("id", id.data).maybeSingle();
  const attachments = (lead?.attachments ?? []) as { path?: string }[];
  const paths = attachments.map((item) => item.path).filter(Boolean) as string[];

  if (paths.length) await supabase.storage.from("lead-uploads").remove(paths);

  await supabase.from("leads").delete().eq("id", id.data);

  revalidatePath("/admin/leads");
  revalidatePath("/admin/dashboard");
}

/**
 * Link temporário para abrir um anexo do bucket privado.
 * Vale uma hora e só é gerado para quem já está autenticado como equipe.
 */
export async function getAttachmentUrl(path: string): Promise<string | null> {
  await requireStaff("/admin/leads");

  const parsed = z.string().min(1).max(400).safeParse(path);
  if (!parsed.success) return null;

  const supabase = await createClient();
  const { data } = await supabase.storage.from("lead-uploads").createSignedUrl(parsed.data, 3600);

  return data?.signedUrl ?? null;
}
