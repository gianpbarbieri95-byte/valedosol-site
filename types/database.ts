/**
 * Tipos do banco, espelhando supabase/migrations.
 * Mantidos à mão para não depender de geração num projeto que ainda está
 * sendo provisionado — a fonte da verdade continua sendo o SQL.
 */

export type UserRole = "admin" | "editor";
export type PropertyPurpose = "venda" | "locacao";
export type PropertyStatus = "disponivel" | "reservado" | "vendido" | "alugado" | "inativo";
export type PublicationState = "draft" | "published" | "archived";
export type LeadStatus = "novo" | "em_atendimento" | "concluido" | "arquivado";

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface PropertyType {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Region {
  id: string;
  name: string;
  slug: string;
  city: string;
  description: string | null;
  image_path: string | null;
  sort_order: number;
  active: boolean;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyImage {
  id: string;
  property_id: string;
  storage_path: string;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  is_cover: boolean;
  created_at: string;
}

export interface PropertyVideo {
  id: string;
  property_id: string;
  storage_path: string;
  poster_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  created_at: string;
}

export interface Property {
  id: string;
  title: string;
  slug: string;
  code: string;
  purpose: PropertyPurpose;
  property_type_id: string | null;
  status: PropertyStatus;
  publication_state: PublicationState;

  price: number | null;
  price_on_request: boolean;
  condo_fee: number | null;
  iptu: number | null;

  city: string;
  neighborhood: string | null;
  address: string | null;
  zip_code: string | null;
  region_id: string | null;
  latitude: number | null;
  longitude: number | null;

  area_total: number | null;
  area_built: number | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;

  description: string | null;
  highlights: string[];

  is_featured: boolean;
  is_furnished: boolean;
  in_condo: boolean;
  condo_name: string | null;

  seo_title: string | null;
  seo_description: string | null;

  legacy_source: string | null;
  legacy_id: string | null;

  published_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/** Imóvel com os relacionamentos que as telas públicas consomem. */
export interface PropertyWithRelations extends Property {
  property_type: Pick<PropertyType, "id" | "name" | "slug"> | null;
  region: Pick<Region, "id" | "name" | "slug" | "city"> | null;
  images: PropertyImage[];
}

/** Versão enxuta usada nos cards de listagem. */
export interface PropertyCardData {
  id: string;
  title: string;
  slug: string;
  code: string;
  purpose: PropertyPurpose;
  status: PropertyStatus;
  price: number | null;
  price_on_request: boolean;
  city: string;
  neighborhood: string | null;
  area_total: number | null;
  area_built: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  is_featured: boolean;
  property_type: Pick<PropertyType, "name" | "slug"> | null;
  images: Pick<PropertyImage, "storage_path" | "alt_text" | "is_cover" | "sort_order">[];
}

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  message: string | null;
  property_id: string | null;
  property_code: string | null;
  source: string;
  status: LeadStatus;
  details: Record<string, unknown>;
  attachments: { path: string; name: string; size: number }[];
  page_url: string | null;
  notes: string | null;
  handled_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
}

export interface SiteSetting<T = Record<string, unknown>> {
  key: string;
  value: T;
  is_public: boolean;
  updated_at: string;
  updated_by: string | null;
}

/* -------------------------------------------------------------------------
   Formato das configurações editáveis (site_settings)
   ------------------------------------------------------------------------- */

export interface ContactSettings {
  phone: string;
  phone_secondary: string;
  whatsapp: string;
  email: string;
  email_secondary: string;
  address: string;
  district: string;
  city: string;
  state: string;
  zip: string;
  hours: string;
  /** Vazios até a imobiliária confirmar. Sem eles, o mapa não é exibido. */
  latitude: string;
  longitude: string;
}

export interface SocialSettings {
  facebook: string;
  instagram: string;
}

export interface HeroSettings {
  title: string;
  subtitle: string;
  image_path: string;
}

export interface AboutSettings {
  /** Linha de abertura da página institucional. */
  tagline: string;
  intro: string;
  /** Parágrafos seguintes da história, separados por linha em branco. */
  history: string;
  specialties: string;
  /** Um segmento por linha, no formato `Título | descrição`. */
  segments: string;
  /** Fechamento da página, em parágrafos separados por linha em branco. */
  closing: string;
  communication: string;
  mission: string;
  vision: string;
  values: string;
}

export interface SeoSettings {
  title: string;
  description: string;
}

export interface AnalyticsSettings {
  ga_measurement_id: string;
  gsc_verification: string;
}

export interface SiteSettingsMap {
  contact: ContactSettings;
  social: SocialSettings;
  hero: HeroSettings;
  about: AboutSettings;
  seo: SeoSettings;
  analytics: AnalyticsSettings;
}

/* -------------------------------------------------------------------------
   CRM e portais (supabase/migrations/0005_crm_portais.sql)
   ------------------------------------------------------------------------- */

export type ClientKind = "comprador" | "locatario" | "proprietario" | "investidor";
export type DealStage = "qualificando" | "conhecendo" | "agendando" | "negociando" | "ganho" | "perdido";
export type DealTemperature = "fria" | "morna" | "quente";
export type ActivityKind = "ligacao" | "whatsapp" | "email" | "visita" | "reuniao" | "tarefa";
export type PortalId = "vrsync" | "chavesnamao";

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phone_secondary: string | null;
  document: string | null;
  kinds: ClientKind[];
  source: string | null;
  notes: string | null;
  lead_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  title: string;
  client_id: string;
  property_id: string | null;
  lead_id: string | null;
  purpose: PropertyPurpose;
  stage: DealStage;
  position: number;
  value: number | null;
  temperature: DealTemperature | null;
  lost_reason: string | null;
  notes: string | null;
  assigned_to: string | null;
  created_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  title: string;
  kind: ActivityKind;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  done: boolean;
  done_at: string | null;
  client_id: string | null;
  deal_id: string | null;
  property_id: string | null;
  notes: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyOwner {
  property_id: string;
  client_id: string;
  created_at: string;
}

export interface PortalListing {
  property_id: string;
  portal: PortalId;
  highlight: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortalSettings {
  portal: PortalId;
  enabled: boolean;
  feed_token: string;
  /** property_types.id → tipo no portal. */
  type_map: Record<string, string>;
  updated_at: string;
  updated_by: string | null;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
}
