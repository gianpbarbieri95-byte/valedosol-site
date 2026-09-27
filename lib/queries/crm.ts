import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { OPEN_STAGES } from "@/lib/crm";
import type {
  Activity,
  Client,
  Deal,
  DealStage,
  PortalListing,
  PortalSettings,
  Property,
  StaffMember,
} from "@/types/database";

/**
 * Consultas do CRM e dos portais.
 *
 * As tabelas vêm de supabase/migrations/0005_crm_portais.sql. Enquanto essa
 * migration não for aplicada no Supabase, as consultas não quebram o painel:
 * `CrmNotInstalledError` vira o aviso "instalação pendente" nas telas novas,
 * e o resto do painel (imóveis, contatos, configurações) segue funcionando.
 */

export class CrmNotInstalledError extends Error {
  constructor() {
    super("CRM não instalado: aplique supabase/migrations/0005_crm_portais.sql no Supabase.");
    this.name = "CrmNotInstalledError";
  }
}

/**
 * Tabela, função ou relação do CRM que ainda não existe no banco: PGRST205
 * (tabela), PGRST202 (função), PGRST200 (relação para embutir — acontece
 * quando a tabela embutida não existe) ou 42P01 direto do Postgres.
 */
export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    ["PGRST200", "PGRST202", "PGRST205", "42P01", "42883"].includes(error.code ?? "") ||
    /could not find (the (table|function)|a relationship)|does not exist/i.test(error.message ?? "")
  );
}

function fail(error: { code?: string; message: string }, what: string): never {
  if (isMissingTable(error)) throw new CrmNotInstalledError();
  throw new Error(`Falha ao ${what}: ${error.message}`);
}

/** true quando as tabelas do CRM já existem no banco. */
export const isCrmInstalled = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  // GET, e não HEAD: a resposta de HEAD vem sem corpo, e o erro de tabela
  // inexistente chegaria sem código — confundido com "instalado".
  const { error } = await supabase.from("clients").select("id").limit(1);
  return !isMissingTable(error);
});

/* ------------------------------------------------------------------ equipe */

export const getStaffDirectory = cache(async (): Promise<StaffMember[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_directory");
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`Falha ao listar a equipe: ${error.message}`);
  }
  return (data ?? []) as StaffMember[];
});

/* ---------------------------------------------------------------- clientes */

export interface ClientRow extends Client {
  deals: Pick<Deal, "id" | "stage">[];
}

export async function listClients(options: { search?: string; kind?: string; page?: number } = {}) {
  const supabase = await createClient();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = 25;
  const from = (page - 1) * pageSize;

  let query = supabase.from("clients").select("*, deals(id, stage)", { count: "exact" });

  if (options.search) {
    const term = options.search.replace(/[%,()]/g, " ").trim();
    if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,document.ilike.%${term}%`);
  }
  if (options.kind) query = query.contains("kinds", [options.kind]);

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  if (error) fail(error, "listar clientes");

  return {
    items: (data ?? []) as unknown as ClientRow[],
    total: count ?? 0,
    page,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

/** Opções para selects (proprietário, cliente do negócio). */
export async function listClientOptions(): Promise<Pick<Client, "id" | "name" | "phone" | "kinds">[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, name, phone, kinds").order("name").limit(2000);
  if (error) fail(error, "listar clientes");
  return data ?? [];
}

export interface ClientDetail extends Client {
  deals: (Deal & { property: Pick<Property, "id" | "code" | "title"> | null })[];
  activities: Activity[];
  owned: { property: Pick<Property, "id" | "code" | "title" | "status" | "publication_state"> | null }[];
}

export async function getClient(id: string): Promise<ClientDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "*, deals(*, property:properties(id, code, title)), activities(*), owned:property_owners(property:properties(id, code, title, status, publication_state))"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error, "carregar o cliente");
  if (!data) return null;

  const client = data as unknown as ClientDetail;
  client.deals.sort((a, b) => b.created_at.localeCompare(a.created_at));
  client.activities.sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return client;
}

/* ---------------------------------------------------------------- negócios */

export interface DealCard extends Deal {
  client: Pick<Client, "id" | "name" | "phone"> | null;
  property: Pick<Property, "id" | "code" | "title"> | null;
  activities: Pick<Activity, "id" | "starts_at" | "done">[];
}

export async function listDeals(options: { purpose?: string; assignedTo?: string; temperature?: string; closed?: boolean } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("deals")
    .select("*, client:clients(id, name, phone), property:properties(id, code, title), activities(id, starts_at, done)");

  query = options.closed ? query.in("stage", ["ganho", "perdido"]) : query.in("stage", [...OPEN_STAGES]);
  if (options.purpose) query = query.eq("purpose", options.purpose);
  if (options.assignedTo) query = query.eq("assigned_to", options.assignedTo);
  if (options.temperature) query = query.eq("temperature", options.temperature);

  const { data, error } = await query
    .order(options.closed ? "closed_at" : "position", { ascending: !options.closed })
    .order("created_at", { ascending: false })
    .limit(options.closed ? 100 : 1000);
  if (error) fail(error, "listar negócios");
  return (data ?? []) as unknown as DealCard[];
}

export interface DealDetail extends Deal {
  client: Client | null;
  property: Pick<Property, "id" | "code" | "title" | "slug" | "price" | "purpose"> | null;
  activities: Activity[];
}

export async function getDeal(id: string): Promise<DealDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select("*, client:clients(*), property:properties(id, code, title, slug, price, purpose), activities(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error, "carregar o negócio");
  if (!data) return null;
  const deal = data as unknown as DealDetail;
  deal.activities.sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return deal;
}

/** Opções de negócio abertos para vincular uma atividade. */
export async function listOpenDealOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select("id, title, client:clients(name)")
    .in("stage", [...OPEN_STAGES])
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) fail(error, "listar negócios");
  return (data ?? []) as unknown as { id: string; title: string; client: { name: string } | null }[];
}

/* -------------------------------------------------------------- atividades */

export interface ActivityRow extends Activity {
  client: Pick<Client, "id" | "name" | "phone"> | null;
  deal: Pick<Deal, "id" | "title"> | null;
  property: Pick<Property, "id" | "code" | "title"> | null;
}

const ACTIVITY_SELECT = "*, client:clients(id, name, phone), deal:deals(id, title), property:properties(id, code, title)";

export async function listActivitiesBetween(from: Date, to: Date, options: { assignedTo?: string } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("activities")
    .select(ACTIVITY_SELECT)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString());
  if (options.assignedTo) query = query.eq("assigned_to", options.assignedTo);
  const { data, error } = await query.order("starts_at");
  if (error) fail(error, "listar atividades");
  return (data ?? []) as unknown as ActivityRow[];
}

/** Pendentes até o fim do período — inclui as atrasadas. */
export async function listPendingActivities(until: Date, options: { assignedTo?: string; limit?: number } = {}) {
  const supabase = await createClient();
  let query = supabase.from("activities").select(ACTIVITY_SELECT).eq("done", false).lt("starts_at", until.toISOString());
  if (options.assignedTo) query = query.eq("assigned_to", options.assignedTo);
  const { data, error } = await query.order("starts_at").limit(options.limit ?? 200);
  if (error) fail(error, "listar atividades");
  return (data ?? []) as unknown as ActivityRow[];
}

export async function getActivity(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("activities").select(ACTIVITY_SELECT).eq("id", id).maybeSingle();
  if (error) fail(error, "carregar a atividade");
  return (data ?? null) as unknown as ActivityRow | null;
}

/* ------------------------------------------------------------------- início */

export interface CrmSummary {
  clients: number;
  openDeals: number;
  openValue: number;
  byStage: Record<DealStage, number>;
  wonThisMonth: number;
}

export async function getCrmSummary(monthStart: Date): Promise<CrmSummary> {
  const supabase = await createClient();
  const [clients, deals] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("deals").select("stage, value, closed_at"),
  ]);
  if (clients.error) fail(clients.error, "contar clientes");
  if (deals.error) fail(deals.error, "contar negócios");

  const byStage = { qualificando: 0, conhecendo: 0, agendando: 0, negociando: 0, ganho: 0, perdido: 0 } as Record<DealStage, number>;
  let openValue = 0;
  let wonThisMonth = 0;
  for (const deal of deals.data ?? []) {
    const stage = deal.stage as DealStage;
    byStage[stage] = (byStage[stage] ?? 0) + 1;
    if ((OPEN_STAGES as readonly string[]).includes(stage)) openValue += Number(deal.value ?? 0);
    if (stage === "ganho" && deal.closed_at && new Date(deal.closed_at) >= monthStart) wonThisMonth++;
  }

  return {
    clients: clients.count ?? 0,
    openDeals: OPEN_STAGES.reduce((sum, stage) => sum + byStage[stage], 0),
    openValue,
    byStage,
    wonThisMonth,
  };
}

/* ------------------------------------------------------------------ imóveis */

export async function getPropertyOwners(propertyId: string): Promise<Pick<Client, "id" | "name" | "phone">[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_owners")
    .select("client:clients(id, name, phone)")
    .eq("property_id", propertyId);
  if (error) fail(error, "carregar proprietários");
  return ((data ?? []) as unknown as { client: Pick<Client, "id" | "name" | "phone"> | null }[])
    .map((row) => row.client)
    .filter((client): client is Pick<Client, "id" | "name" | "phone"> => Boolean(client));
}

export async function getPropertyPortalListings(propertyId: string): Promise<PortalListing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("portal_listings").select("*").eq("property_id", propertyId);
  if (error) fail(error, "carregar portais do imóvel");
  return (data ?? []) as PortalListing[];
}

/* ------------------------------------------------------------------ portais */

export async function getPortalSettings(): Promise<PortalSettings[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("portal_settings").select("*").order("portal");
  if (error) fail(error, "carregar os portais");
  return (data ?? []) as PortalSettings[];
}

export async function listPortalListings(): Promise<PortalListing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("portal_listings").select("*");
  if (error) fail(error, "listar anúncios nos portais");
  return (data ?? []) as PortalListing[];
}

export interface PortalCandidate {
  id: string;
  code: string;
  title: string;
  publication_state: string;
  status: string;
  price: number | null;
  price_on_request: boolean;
  description: string | null;
  neighborhood: string | null;
  city: string;
  property_type: { id: string; slug: string; name: string } | null;
  images: { storage_path: string }[];
}

/** Imóveis que podem ir para os portais (todos, menos os inativos). */
export async function listPortalCandidates(): Promise<PortalCandidate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, code, title, publication_state, status, price, price_on_request, description, neighborhood, city, property_type:property_types(id, slug, name), images:property_images(storage_path)"
    )
    .neq("status", "inativo")
    .order("code");
  if (error) fail(error, "listar imóveis");
  return (data ?? []) as unknown as PortalCandidate[];
}
