/**
 * Vocabulário do CRM: estágios do funil, tipos de cliente e de atividade.
 * Os valores (chaves) são os mesmos das constraints em
 * supabase/migrations/0005_crm_portais.sql — mudar um exige mudar o outro.
 */
import type { ActivityKind, ClientKind, DealStage, DealTemperature } from "@/types/database";

export const CLIENT_KINDS = ["comprador", "locatario", "proprietario", "investidor"] as const satisfies readonly ClientKind[];

export const CLIENT_KIND_LABEL: Record<ClientKind, string> = {
  comprador: "Comprador",
  locatario: "Locatário",
  proprietario: "Proprietário",
  investidor: "Investidor",
};

/** Colunas do funil, na ordem em que o negócio avança. */
export const OPEN_STAGES = ["qualificando", "conhecendo", "agendando", "negociando"] as const satisfies readonly DealStage[];
export const CLOSED_STAGES = ["ganho", "perdido"] as const satisfies readonly DealStage[];
export const DEAL_STAGES = [...OPEN_STAGES, ...CLOSED_STAGES] as const;

export const DEAL_STAGE_LABEL: Record<DealStage, string> = {
  qualificando: "Qualificando",
  conhecendo: "Conhecendo",
  agendando: "Agendando",
  negociando: "Negociando",
  ganho: "Ganho",
  perdido: "Perdido",
};

export const DEAL_STAGE_HINT: Record<DealStage, string> = {
  qualificando: "Entendendo o que a pessoa procura",
  conhecendo: "Apresentando imóveis",
  agendando: "Visitas marcadas",
  negociando: "Proposta na mesa",
  ganho: "Negócio fechado",
  perdido: "Não avançou",
};

export const DEAL_TEMPERATURES = ["fria", "morna", "quente"] as const satisfies readonly DealTemperature[];

export const DEAL_TEMPERATURE_LABEL: Record<DealTemperature, string> = {
  fria: "Fria",
  morna: "Morna",
  quente: "Quente",
};

export const ACTIVITY_KINDS = ["ligacao", "whatsapp", "email", "visita", "reuniao", "tarefa"] as const satisfies readonly ActivityKind[];

export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  visita: "Visita",
  reuniao: "Reunião",
  tarefa: "Tarefa",
};

/** Imóvel sem atualização há mais que isso aparece como desatualizado. */
export const STALE_PROPERTY_DAYS = 30;

/** Fuso da imobiliária: a agenda e "hoje" são sempre no horário de Arujá. */
export const CRM_TIME_ZONE = "America/Sao_Paulo";

/**
 * "R$ 640 mil", "R$ 1,2 mi". Feito à mão, e não com Intl notation "compact":
 * o Node e cada navegador trazem versões diferentes do ICU e escreviam o
 * mesmo valor de jeitos diferentes ("R$ 640 mil" × "R$ 640,0 mil") — o
 * que quebra a hidratação de um componente renderizado nos dois lados.
 */
export function formatCompactBRL(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "").replace(".", ",");
  if (abs >= 1_000_000_000) return `R$ ${trim(value / 1_000_000_000)} bi`;
  if (abs >= 1_000_000) return `R$ ${trim(value / 1_000_000)} mi`;
  if (abs >= 1_000) return `R$ ${trim(value / 1_000)} mil`;
  return `R$ ${Math.round(value)}`;
}
