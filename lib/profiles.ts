/**
 * Perfis de busca: os três caminhos da home (morar, investir, espaço) e os
 * atalhos por tipo da abertura (casas, terrenos, chácaras...).
 *
 * Cada perfil junta tipos de imóvel cadastrados. Como parte do acervo veio do
 * WordPress sem tipo, o perfil também reconhece o imóvel pelo próprio título
 * ("Chácara…", "Terreno…") — é o nome que a imobiliária deu, não uma
 * classificação inventada aqui.
 */

export const PROFILES = [
  "morar",
  "investir",
  "espaco",
  "casas",
  "terrenos",
  "chacaras",
  "condominios",
  "comerciais",
] as const;
export type Profile = (typeof PROFILES)[number];

/** Os três caminhos da seção "Qual imóvel você procura?". */
export const PATH_PROFILES = ["morar", "investir", "espaco"] as const satisfies readonly Profile[];

/** Atalhos por tipo, na abertura da home. */
export const SHORTCUT_PROFILES = [
  "casas",
  "terrenos",
  "chacaras",
  "condominios",
  "comerciais",
] as const satisfies readonly Profile[];

export interface ProfileDefinition {
  label: string;
  heading: string;
  description: string;
  typeSlugs: string[];
  titleWords: string[];
  /** Condições extras do PostgREST, somadas ao "ou" (ex.: condomínio cadastrado). */
  extra?: string[];
}

export const PROFILE_DEFINITIONS: Record<Profile, ProfileDefinition> = {
  morar: {
    label: "Morar",
    heading: "Imóveis para morar",
    description: "Casas, apartamentos e condomínios.",
    typeSlugs: ["casa-bairro", "casa-condominio", "apartamento"],
    titleWords: ["casa", "sobrado", "apartamento", "residência", "mansão", "térrea"],
  },
  investir: {
    label: "Investir",
    heading: "Imóveis para investir",
    description: "Terrenos, áreas comerciais e oportunidades.",
    typeSlugs: ["terreno-bairro", "terreno-condominio", "terreno-comercial", "comercial"],
    titleWords: ["terreno", "comercial", "prédio"],
  },
  espaco: {
    label: "Mais espaço",
    heading: "Chácaras e grandes espaços",
    description: "Chácaras, sítios, galpões e grandes propriedades.",
    typeSlugs: ["chacara-sitio", "galpao-industrial", "area-industrial"],
    titleWords: ["chácara", "sítio", "galpão", "área industrial"],
  },
  casas: {
    label: "Casas",
    heading: "Casas",
    description: "Casas, sobrados e residências em bairro ou condomínio.",
    typeSlugs: ["casa-bairro", "casa-condominio"],
    titleWords: ["casa", "sobrado", "residência", "mansão", "térrea"],
  },
  terrenos: {
    label: "Terrenos",
    heading: "Terrenos",
    description: "Terrenos em bairro, em condomínio e comerciais.",
    typeSlugs: ["terreno-bairro", "terreno-condominio", "terreno-comercial"],
    titleWords: ["terreno"],
  },
  chacaras: {
    label: "Chácaras",
    heading: "Chácaras e sítios",
    description: "Chácaras e sítios em Arujá e região.",
    typeSlugs: ["chacara-sitio"],
    titleWords: ["chácara", "sítio"],
  },
  condominios: {
    label: "Condomínios",
    heading: "Imóveis em condomínio",
    description: "Casas e terrenos em condomínios fechados.",
    typeSlugs: ["casa-condominio", "terreno-condominio"],
    titleWords: ["condomínio"],
    extra: ["condo_name.not.is.null", "in_condo.is.true"],
  },
  comerciais: {
    label: "Comerciais",
    heading: "Imóveis comerciais",
    description: "Prédios, salas, terrenos comerciais e galpões.",
    typeSlugs: ["comercial", "terreno-comercial", "galpao-industrial", "area-industrial"],
    titleWords: ["comercial", "prédio", "galpão"],
  },
};
