"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import {
  contactSchema,
  fieldErrors,
  propertyInterestSchema,
  sellPropertySchema,
  validateUpload,
  MAX_UPLOAD_FILES,
  type FormState,
} from "@/lib/validations/lead";

/**
 * Gravação dos leads dos formulários públicos.
 *
 * Roda com service role porque o visitante anônimo não tem permissão de
 * escrita na tabela leads (ver 0002_rls.sql). A porta de entrada é esta
 * função, e ela valida, limita a frequência e descarta spam antes de gravar.
 */

const GENERIC_ERROR =
  "Não conseguimos enviar sua mensagem agora. Tente de novo em instantes ou fale com a gente pelo WhatsApp.";

function formToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

async function guard(scope: string): Promise<FormState | null> {
  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message: "O site ainda não está conectado ao banco de dados. Fale com a gente pelo WhatsApp.",
    };
  }

  const requestHeaders = await headers();
  const { allowed, retryAfterSeconds } = rateLimit(clientKey(requestHeaders, scope));

  if (!allowed) {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return {
      status: "error",
      message: `Você já enviou algumas mensagens. Tente novamente em ${minutes} minuto${minutes > 1 ? "s" : ""}.`,
    };
  }

  return null;
}

/** Spam preencheu o campo-armadilha: responde como sucesso e não grava nada. */
const SILENT_SUCCESS: FormState = {
  status: "success",
  message: "Mensagem enviada. Em breve entramos em contato.",
};

/* ------------------------------------------------ Interesse em um imóvel */

export async function submitPropertyInterest(
  _previous: FormState,
  formData: FormData
): Promise<FormState> {
  const blocked = await guard("imovel");
  if (blocked) return blocked;

  const parsed = propertyInterestSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", message: "Confira os campos destacados.", errors: fieldErrors(parsed.error) };
  }
  if (parsed.data.website) return SILENT_SUCCESS;

  const supabase = createAdminClient();
  const { error } = await supabase.from("leads").insert({
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone,
    message: parsed.data.message ?? null,
    property_id: parsed.data.property_id ?? null,
    property_code: parsed.data.property_code ?? null,
    source: "site_imovel",
    page_url: parsed.data.page_url ?? null,
  });

  if (error) {
    console.error("Falha ao gravar lead de imóvel:", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  return {
    status: "success",
    message: "Recebemos seu interesse. A Vale do Sol entra em contato em breve.",
  };
}

/* ------------------------------------------------------ Contato geral */

export async function submitContact(_previous: FormState, formData: FormData): Promise<FormState> {
  const blocked = await guard("contato");
  if (blocked) return blocked;

  const parsed = contactSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", message: "Confira os campos destacados.", errors: fieldErrors(parsed.error) };
  }
  if (parsed.data.website) return SILENT_SUCCESS;

  const supabase = createAdminClient();
  const { error } = await supabase.from("leads").insert({
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone,
    message: parsed.data.message,
    source: "site_contato",
    page_url: parsed.data.page_url ?? null,
    details: parsed.data.subject ? { assunto: parsed.data.subject } : {},
  });

  if (error) {
    console.error("Falha ao gravar contato:", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  return { status: "success", message: "Mensagem enviada. Respondemos assim que possível." };
}

/* -------------------------------------------------- Venda seu imóvel */

export async function submitSellProperty(_previous: FormState, formData: FormData): Promise<FormState> {
  const blocked = await guard("venda");
  if (blocked) return blocked;

  const parsed = sellPropertySchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", message: "Confira os campos destacados.", errors: fieldErrors(parsed.error) };
  }
  if (parsed.data.website) return SILENT_SUCCESS;

  const supabase = createAdminClient();

  // Fotos do imóvel vão para um bucket privado: arquivo enviado por visitante
  // não vira URL pública.
  const files = formData.getAll("fotos").filter((item): item is File => item instanceof File && item.size > 0);
  const attachments: { path: string; name: string; size: number }[] = [];

  if (files.length > MAX_UPLOAD_FILES) {
    return { status: "error", message: `Envie no máximo ${MAX_UPLOAD_FILES} arquivos.` };
  }

  for (const file of files) {
    const problem = validateUpload(file);
    if (problem) return { status: "error", message: problem };
  }

  const folder = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}`;
  for (const file of files) {
    const safeName = file.name.replace(/[^\w.-]+/g, "-").slice(-80);
    const path = `${folder}/${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("lead-uploads")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("Falha no upload do anexo:", uploadError.message);
      return { status: "error", message: "Não conseguimos receber as fotos. Tente enviar sem elas." };
    }

    attachments.push({ path, name: file.name, size: file.size });
  }

  const { error } = await supabase.from("leads").insert({
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone,
    message: parsed.data.message ?? null,
    source: "site_venda_imovel",
    page_url: parsed.data.page_url ?? null,
    attachments,
    details: {
      tipo_imovel: parsed.data.property_type ?? null,
      cidade: parsed.data.city ?? null,
      bairro: parsed.data.neighborhood ?? null,
      finalidade: parsed.data.purpose ?? null,
      valor_desejado: parsed.data.expected_price ?? null,
    },
  });

  if (error) {
    console.error("Falha ao gravar imóvel enviado:", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  return {
    status: "success",
    message: "Recebemos os dados do seu imóvel. A Vale do Sol entra em contato para conversar.",
  };
}
