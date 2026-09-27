"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { fieldErrors, type FormState } from "@/lib/validations/lead";
import { activitySchema, clientSchema, dealSchema } from "@/lib/validations/crm";
import { isMissingTable } from "@/lib/queries/crm";
import { startOfLocalDay } from "@/lib/datetime";
import { DEAL_STAGES, OPEN_STAGES } from "@/lib/crm";
import type { ClientKind } from "@/types/database";

/**
 * Ações do CRM: clientes, negócios, atividades.
 *
 * Toda ação confere a sessão (requireStaff/requireAdmin) antes de tocar no
 * banco, e a RLS confere de novo. revalidatePath usa o caminho do arquivo
 * (/admin/...), não o endereço que aparece na barra.
 */

function formToObject(formData: FormData, arrays: string[] = []): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (arrays.includes(key)) continue;
    const value = formData.get(key);
    if (typeof value === "string") result[key] = value;
  }
  for (const key of arrays) result[key] = formData.getAll(key).filter((value) => typeof value === "string");
  return result;
}

function friendlyError(error: { code?: string; message: string }): string {
  if (isMissingTable(error)) return "O CRM ainda não foi instalado no banco (migration 0005). Fale com quem administra o painel.";
  if (error.message.includes("row-level security")) return "Sua conta não tem permissão para esta ação.";
  if (error.message.includes("violates foreign key")) return "Um dos itens vinculados não existe mais. Recarregue a página.";
  console.error("[crm]", error.message);
  return "Não foi possível salvar agora. Tente de novo em instantes.";
}

/** Volta para uma tela do próprio painel (com filtros), nunca para fora. */
function safeReturn(value: FormDataEntryValue | null, fallback: string): string {
  const raw = typeof value === "string" ? value : "";
  return /^\/[\w\-/]*(\?[\w=&%.\-]*)?$/.test(raw) && !raw.startsWith("//") ? raw : fallback;
}

function refreshPanel() {
  revalidatePath("/admin", "layout");
}

/* ---------------------------------------------------------------- clientes */

export async function saveClient(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await requireStaff("/clientes");

  const parsed = clientSchema.safeParse(formToObject(formData, ["kinds"]));
  if (!parsed.success) {
    return { status: "error", message: "Confira os campos destacados.", errors: fieldErrors(parsed.error) };
  }

  const { id, ...values } = parsed.data;
  const supabase = await createClient();

  if (id) {
    const { error } = await supabase.from("clients").update(values).eq("id", id);
    if (error) return { status: "error", message: friendlyError(error) };
    refreshPanel();
    return { status: "success", message: "Cliente salvo." };
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...values, assigned_to: values.assigned_to ?? session.userId, created_by: session.userId })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: friendlyError(error ?? { message: "sem resposta" }) };

  refreshPanel();
  redirect(`/clientes/${data.id}?ok=criado`);
}

export async function deleteClient(formData: FormData): Promise<void> {
  await requireAdmin("/clientes");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", id.data);
  if (error) redirect(`/clientes/${id.data}?erro=excluir`);

  refreshPanel();
  redirect("/clientes?ok=excluido");
}

/* ---------------------------------------------------------------- negócios */

export async function saveDeal(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await requireStaff("/negocios");

  const parsed = dealSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", message: "Confira os campos destacados.", errors: fieldErrors(parsed.error) };
  }

  const { id, ...values } = parsed.data;
  const supabase = await createClient();

  if (id) {
    const { error } = await supabase.from("deals").update(values).eq("id", id);
    if (error) return { status: "error", message: friendlyError(error) };
    refreshPanel();
    return { status: "success", message: "Negócio salvo." };
  }

  // Novo negócio entra no topo da coluna.
  const { data: first } = await supabase
    .from("deals")
    .select("position")
    .eq("stage", values.stage)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("deals")
    .insert({
      ...values,
      position: (first?.position ?? 1) - 1,
      assigned_to: values.assigned_to ?? session.userId,
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: friendlyError(error ?? { message: "sem resposta" }) };

  refreshPanel();
  redirect(`/negocios/${data.id}?ok=criado`);
}

/**
 * Arrastar um cartão no funil. `position` é calculada no navegador entre os
 * vizinhos (média), então mover um cartão grava uma linha só.
 */
export async function moveDeal(input: { id: string; stage: string; position: number }): Promise<{ ok: boolean; message?: string }> {
  await requireStaff("/negocios");

  const parsed = z
    .object({ id: z.string().uuid(), stage: z.enum(DEAL_STAGES), position: z.number().finite() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Movimento inválido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update({ stage: parsed.data.stage, position: parsed.data.position })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, message: friendlyError(error) };

  refreshPanel();
  return { ok: true };
}

export async function closeDeal(formData: FormData): Promise<void> {
  await requireStaff("/negocios");
  const parsed = z
    .object({
      id: z.string().uuid(),
      outcome: z.enum(["ganho", "perdido", "reabrir"]),
      lost_reason: z.string().trim().max(500).optional(),
    })
    .safeParse({
      id: formData.get("id"),
      outcome: formData.get("outcome"),
      lost_reason: formData.get("lost_reason") ?? undefined,
    });
  if (!parsed.success) return;

  const { id, outcome, lost_reason } = parsed.data;
  const supabase = await createClient();
  await supabase
    .from("deals")
    .update(
      outcome === "reabrir"
        ? { stage: "negociando", lost_reason: null }
        : { stage: outcome, lost_reason: outcome === "perdido" ? lost_reason || null : null }
    )
    .eq("id", id);

  refreshPanel();
  redirect(`/negocios/${id}?ok=${outcome}`);
}

export async function deleteDeal(formData: FormData): Promise<void> {
  await requireAdmin("/negocios");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  const { error } = await supabase.from("deals").delete().eq("id", id.data);
  if (error) redirect(`/negocios/${id.data}?erro=excluir`);

  refreshPanel();
  redirect("/negocios?ok=excluido");
}

/* -------------------------------------------------------------- atividades */

export async function saveActivity(_previous: FormState, formData: FormData): Promise<FormState> {
  const session = await requireStaff("/atividades");

  const parsed = activitySchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", message: "Confira os campos destacados.", errors: fieldErrors(parsed.error) };
  }

  const { id, starts_at, ends_at, all_day, ...values } = parsed.data;
  const payload = {
    ...values,
    all_day,
    // Dia inteiro: guarda o começo do dia em Arujá, sem horário de término.
    starts_at: (all_day ? startOfLocalDay(starts_at) : starts_at).toISOString(),
    ends_at: all_day || !ends_at ? null : ends_at.toISOString(),
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("activities").update(payload).eq("id", id)
    : await supabase
        .from("activities")
        .insert({ ...payload, assigned_to: payload.assigned_to ?? session.userId, created_by: session.userId });

  if (error) return { status: "error", message: friendlyError(error) };

  refreshPanel();
  const back = formData.get("returnTo");
  if (back) redirect(safeReturn(back, "/atividades"));
  return { status: "success", message: id ? "Atividade salva." : "Atividade criada." };
}

export async function toggleActivityDone(formData: FormData): Promise<void> {
  await requireStaff("/atividades");
  const parsed = z
    .object({ id: z.string().uuid(), done: z.enum(["1", "0"]) })
    .safeParse({ id: formData.get("id"), done: formData.get("done") });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.from("activities").update({ done: parsed.data.done === "1" }).eq("id", parsed.data.id);
  refreshPanel();
}

export async function deleteActivity(formData: FormData): Promise<void> {
  await requireStaff("/atividades");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  await supabase.from("activities").delete().eq("id", id.data);
  refreshPanel();
  redirect(safeReturn(formData.get("returnTo"), "/atividades"));
}

/* ------------------------------------------- contato do site → negócio */

/**
 * Transforma um contato do site em cliente + negócio. Se já existe cliente
 * com o mesmo telefone (ou e-mail), usa o existente em vez de duplicar.
 */
export async function convertLeadToDeal(formData: FormData): Promise<void> {
  const session = await requireStaff("/leads");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, email, phone, message, source, property_id, property_code, property:properties(title, purpose, price)")
    .eq("id", id.data)
    .maybeSingle();
  if (!lead) redirect("/leads?erro=contato");

  // Contato que já virou negócio (ainda aberto): abre o existente em vez de duplicar.
  const { data: previous, error: previousError } = await supabase
    .from("deals")
    .select("id")
    .eq("lead_id", lead.id)
    .in("stage", [...OPEN_STAGES])
    .limit(1)
    .maybeSingle();
  if (previousError) redirect(isMissingTable(previousError) ? "/leads?erro=crm" : "/leads?erro=converter");
  if (previous) redirect(`/negocios/${previous.id}?ok=existente`);

  const property = lead.property as unknown as { title: string; purpose: "venda" | "locacao"; price: number | null } | null;
  const digits = (lead.phone ?? "").replace(/\D/g, "");

  // Mesmo telefone (só dígitos, os últimos 10/11) ou mesmo e-mail = mesma pessoa.
  const { data: candidates, error: searchError } = await supabase
    .from("clients")
    .select("id, phone, phone_secondary, email, kinds")
    .limit(2000);
  if (searchError) {
    redirect(isMissingTable(searchError) ? "/leads?erro=crm" : "/leads?erro=converter");
  }

  const tail = digits.slice(-10);
  const existing = (candidates ?? []).find(
    (client) =>
      (tail.length >= 10 &&
        [client.phone, client.phone_secondary].some((value) => (value ?? "").replace(/\D/g, "").endsWith(tail))) ||
      (lead.email && client.email && client.email.toLowerCase() === lead.email.toLowerCase())
  );

  const isSeller = lead.source === "site_venda_imovel";
  const kind: ClientKind = isSeller ? "proprietario" : property?.purpose === "locacao" ? "locatario" : "comprador";

  let clientId = existing?.id;
  if (existing) {
    const kinds = existing.kinds as ClientKind[];
    if (!kinds.includes(kind)) await supabase.from("clients").update({ kinds: [...kinds, kind] }).eq("id", existing.id);
  } else {
    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        kinds: [kind],
        source: lead.source === "site_whatsapp" ? "WhatsApp (site)" : "Site",
        lead_id: lead.id,
        assigned_to: session.userId,
        created_by: session.userId,
      })
      .select("id")
      .single();
    if (error || !created) redirect("/leads?erro=converter");
    clientId = created.id;
  }

  const title = isSeller
    ? `Captação — ${lead.name}`
    : property
      ? `${lead.property_code ?? ""} ${property.title}`.trim()
      : `Atendimento — ${lead.name}`;

  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .insert({
      title: title.slice(0, 200),
      client_id: clientId,
      property_id: lead.property_id,
      lead_id: lead.id,
      purpose: property?.purpose ?? "venda",
      stage: "qualificando",
      value: property?.price ?? null,
      notes: lead.message,
      assigned_to: session.userId,
      created_by: session.userId,
      position: -Date.now() / 1000,
    })
    .select("id")
    .single();
  if (dealError || !deal) redirect("/leads?erro=converter");

  await supabase.from("leads").update({ status: "em_atendimento", handled_by: session.userId }).eq("id", lead.id);

  refreshPanel();
  redirect(`/negocios/${deal.id}?ok=convertido`);
}
