/**
 * Constantes da aplicação que não são editáveis pelo administrador.
 * Tudo que o cliente pode alterar (telefone, WhatsApp, endereço, textos)
 * mora na tabela `site_settings` e é lido por lib/queries/settings.ts.
 */

export const SITE = {
  name: "Vale do Sol Imóveis",
  legalName: "Vale do Sol Empreendimentos Imobiliários S/C Ltda",
  /** Registro da imobiliária e do corretor responsável — o site mostra os dois. */
  creciCompany: "J-14.578",
  creciBroker: "38.124-F",
  creci: "CRECI J-14.578 · CRECI 38.124-F",
  foundedYear: 1975,
  locale: "pt-BR",
  /** Sem barra no fim. Definido em produção por NEXT_PUBLIC_SITE_URL. */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://valedosolimoveis.com.br").replace(/\/$/, ""),
  /**
   * Versão de aprovação (link temporário enviado ao cliente). Com
   * NEXT_PUBLIC_NOINDEX=1 o site pede aos buscadores para não indexar nada,
   * para não competir com o site oficial antes da troca de domínio.
   */
  noindex: process.env.NEXT_PUBLIC_NOINDEX === "1",
} as const;

/** Cidade principal de atuação — dita o tom do conteúdo e o SEO local. */
export const PRIMARY_CITY = "Arujá";

export const PROPERTY_PURPOSES = ["venda", "locacao"] as const;
export type PropertyPurpose = (typeof PROPERTY_PURPOSES)[number];

export const PURPOSE_LABEL: Record<PropertyPurpose, string> = {
  venda: "Comprar",
  locacao: "Alugar",
};

export const PROPERTY_STATUSES = [
  "disponivel",
  "reservado",
  "vendido",
  "alugado",
  "inativo",
] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const STATUS_LABEL: Record<PropertyStatus, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
  alugado: "Alugado",
  inativo: "Inativo",
};

export const PUBLICATION_STATES = ["draft", "published", "archived"] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

export const LEAD_STATUSES = ["novo", "em_atendimento", "concluido", "arquivado"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  novo: "Novo",
  em_atendimento: "Em atendimento",
  concluido: "Concluído",
  arquivado: "Arquivado",
};

export const USER_ROLES = ["admin", "editor"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Ordenações da listagem pública. A chave vai para a URL. */
export const SORT_OPTIONS = {
  // A chave continua "recentes" para não quebrar links já compartilhados, mas
  // a ordem padrão é a da vitrine (disponíveis com foto primeiro), então o
  // rótulo diz isso.
  recentes: { label: "Destaques", column: "published_at", ascending: false },
  menor_preco: { label: "Menor preço", column: "price", ascending: true },
  maior_preco: { label: "Maior preço", column: "price", ascending: false },
  maior_area: { label: "Maior área", column: "area_total", ascending: false },
} as const;

export type SortKey = keyof typeof SORT_OPTIONS;

export const PAGE_SIZE = 12;

export const STORAGE_BUCKETS = {
  property: "property-images",
  site: "site-images",
  region: "region-images",
  video: "property-videos",
} as const;

/** Limites de mídia por imóvel — o banco confere de novo (migration 0006). */
export const MAX_PROPERTY_PHOTOS = 35;
export const MAX_PROPERTY_VIDEOS = 3;
/** 50 MB: teto do bucket property-videos (plano grátis do Supabase). */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** Tipos cadastrados que já nascem marcados como comerciais no formulário. */
export const COMMERCIAL_TYPE_SLUGS = ["comercial", "galpao-industrial"];
