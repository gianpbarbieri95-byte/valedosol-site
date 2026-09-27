/**
 * Portais imobiliários suportados e o vocabulário de cada um.
 *
 * - vrsync: formato VRSync do Grupo OLX — um único XML atende ZAP Imóveis,
 *   Viva Real e OLX. Estrutura e valores conforme o "Portal de integração
 *   Grupo OLX" (developers.grupozap.com/feeds/vrsync).
 * - chavesnamao: formato próprio do Chaves na Mão (raiz <Document>, 53 tags
 *   por imóvel), conforme a documentação oficial do portal
 *   (tecnologiacnm.github.io/cnm-xml-documentation).
 *
 * Arquivo neutro: usado pelo gerador do XML (servidor) e pela tela de
 * portais (navegador).
 */
import type { PortalId } from "@/types/database";

export interface PortalTypeOption {
  value: string;
  label: string;
}

export interface PortalDefinition {
  id: PortalId;
  name: string;
  /** Sites que recebem este XML. */
  sites: string[];
  /** Onde, na conta do portal, a imobiliária cadastra o link do XML. */
  setup: string;
  typeOptions: PortalTypeOption[];
  /** Correspondência padrão pelos tipos cadastrados no painel (slug). */
  defaultTypeBySlug: Record<string, string>;
  /** Tipos de foto que o portal processa (extensão na URL). */
  photoExtensions: string[] | null;
  maxPhotos: number | null;
  maxDescription: number | null;
}

/* VRSync — PropertyType. O prefixo (Residential/Commercial) é o UsageType. */
const VRSYNC_TYPES: PortalTypeOption[] = [
  { value: "Residential / Home", label: "Casa" },
  { value: "Residential / Condo", label: "Casa de condomínio" },
  { value: "Residential / Sobrado", label: "Sobrado" },
  { value: "Residential / Apartment", label: "Apartamento" },
  { value: "Residential / Penthouse", label: "Cobertura" },
  { value: "Residential / Flat", label: "Flat" },
  { value: "Residential / Kitnet", label: "Kitnet" },
  { value: "Residential / Studio", label: "Studio" },
  { value: "Residential / Land Lot", label: "Terreno / lote residencial" },
  { value: "Residential / Farm Ranch", label: "Chácara / sítio" },
  { value: "Commercial / Business", label: "Ponto / loja comercial" },
  { value: "Commercial / Building", label: "Casa ou prédio comercial" },
  { value: "Commercial / Edificio Comercial", label: "Edifício comercial" },
  { value: "Commercial / Consultorio", label: "Consultório" },
  { value: "Commercial / Industrial", label: "Galpão / depósito" },
  { value: "Commercial / Land Lot", label: "Terreno comercial / industrial" },
  { value: "Commercial / Agricultural", label: "Fazenda / área rural" },
];

/* Chaves na Mão — tipos por finalidade (RE residencial, CO comercial). */
export const CHAVES_NA_MAO_RESIDENTIAL = [
  "Apartamento",
  "Casa / Sobrado",
  "Casa / Sobrado em Condomínio",
  "Cobertura",
  "Flat",
  "Kitnet / Stúdio",
  "Loft",
  "Sítio / Chácara",
  "Terreno / Lote",
  "Terreno em Condomínio",
] as const;

export const CHAVES_NA_MAO_COMMERCIAL = [
  "Casa / Sobrado Comercial",
  "Conj. Comercial / Sala",
  "Fazenda",
  "Galpão / Depósito",
  "Garagem",
  "Ponto Comercial",
  "Prédio",
  "Terreno comercial",
] as const;

export const PORTALS: Record<PortalId, PortalDefinition> = {
  vrsync: {
    id: "vrsync",
    name: "ZAP Imóveis, Viva Real e OLX",
    sites: ["ZAP Imóveis", "Viva Real", "OLX"],
    setup:
      "Na conta da imobiliária no Canal Pro (Grupo OLX), cadastre o link abaixo na área de integração por XML. O portal lê o arquivo periodicamente e atualiza os anúncios sozinho.",
    typeOptions: VRSYNC_TYPES,
    defaultTypeBySlug: {
      "casa-bairro": "Residential / Home",
      "casa-condominio": "Residential / Condo",
      apartamento: "Residential / Apartment",
      "terreno-bairro": "Residential / Land Lot",
      "terreno-condominio": "Residential / Land Lot",
      "terreno-comercial": "Commercial / Land Lot",
      "chacara-sitio": "Residential / Farm Ranch",
      comercial: "Commercial / Business",
      "galpao-industrial": "Commercial / Industrial",
      "area-industrial": "Commercial / Land Lot",
    },
    photoExtensions: null,
    maxPhotos: null,
    maxDescription: null,
  },
  chavesnamao: {
    id: "chavesnamao",
    name: "Chaves na Mão",
    sites: ["Chaves na Mão"],
    setup:
      "Envie o link abaixo ao atendimento do Chaves na Mão (ou cadastre na área de integração da sua conta). O portal lê o arquivo uma vez por dia.",
    typeOptions: [
      ...CHAVES_NA_MAO_RESIDENTIAL.map((value) => ({ value, label: `${value} (residencial)` })),
      ...CHAVES_NA_MAO_COMMERCIAL.map((value) => ({ value, label: `${value} (comercial)` })),
    ],
    defaultTypeBySlug: {
      "casa-bairro": "Casa / Sobrado",
      "casa-condominio": "Casa / Sobrado em Condomínio",
      apartamento: "Apartamento",
      "terreno-bairro": "Terreno / Lote",
      "terreno-condominio": "Terreno em Condomínio",
      "terreno-comercial": "Terreno comercial",
      "chacara-sitio": "Sítio / Chácara",
      comercial: "Ponto Comercial",
      "galpao-industrial": "Galpão / Depósito",
      "area-industrial": "Terreno comercial",
    },
    photoExtensions: ["jpg", "jpeg", "webp"],
    maxPhotos: 30,
    maxDescription: 3000,
  },
};

export const PORTAL_IDS = Object.keys(PORTALS) as PortalId[];

export function isPortalId(value: string): value is PortalId {
  return value in PORTALS;
}

/** Tipo do imóvel no portal: o que o administrador escolheu, ou o padrão. */
export function portalTypeFor(
  portal: PortalId,
  typeMap: Record<string, string>,
  propertyType: { id: string; slug: string } | null
): string | null {
  if (!propertyType) return null;
  const chosen = typeMap[propertyType.id];
  const options = PORTALS[portal].typeOptions;
  if (chosen && options.some((option) => option.value === chosen)) return chosen;
  return PORTALS[portal].defaultTypeBySlug[propertyType.slug] ?? null;
}

/** Caminho público do XML (no host do painel). */
export function portalFeedPath(portal: PortalId, token: string): string {
  return `/xml/${portal}/${token}.xml`;
}

/** Extensão do arquivo numa URL/caminho de foto, em minúsculas. */
export function photoExtension(path: string): string {
  return (path.split("?")[0].match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();
}

export interface ReadinessInput {
  publication_state: string;
  status: string;
  price: number | null;
  price_on_request: boolean;
  description: string | null;
  neighborhood: string | null;
  city: string | null;
  property_type: { id: string; slug: string } | null;
  photos: string[];
}

/**
 * O que impede o imóvel de sair no XML deste portal. Lista vazia = pronto.
 * O gerador do XML usa a mesma regra: o que aparece aqui como problema não
 * vai para o arquivo, em vez de o portal recusar o anúncio.
 */
export function portalIssues(portal: PortalId, typeMap: Record<string, string>, input: ReadinessInput): string[] {
  const issues: string[] = [];
  if (input.publication_state !== "published") issues.push("não está publicado no site");
  if (input.status !== "disponivel") issues.push("situação diferente de Disponível");
  if (input.price_on_request || !input.price) issues.push("portais exigem o preço (está sob consulta ou vazio)");
  if (!input.description?.trim()) issues.push("sem descrição");
  if (!input.neighborhood?.trim()) issues.push("sem bairro");
  if (!input.city?.trim()) issues.push("sem cidade");
  if (!portalTypeFor(portal, typeMap, input.property_type)) issues.push("tipo do imóvel sem correspondência no portal");

  const accepted = PORTALS[portal].photoExtensions;
  const photos = accepted ? input.photos.filter((path) => accepted.includes(photoExtension(path))) : input.photos;
  if (photos.length === 0) issues.push(accepted ? `sem fotos em ${accepted.join("/").toUpperCase()}` : "sem fotos");

  return issues;
}
