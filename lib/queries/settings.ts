import { cache } from "react";
import { createPublicClient, isSupabaseConfigured } from "@/lib/supabase/public";
import { safeExternalUrl } from "@/lib/utils";
import type { SiteSettingsMap } from "@/types/database";

/**
 * Valores de partida das configurações.
 *
 * Espelham o seed em supabase/migrations/0004_seed.sql e vêm do conteúdo
 * oficial publicado pela própria imobiliária. Servem para o site não quebrar
 * antes do banco existir; assim que site_settings tem a chave, ela manda.
 *
 * Campos que a imobiliária ainda não informou ficam vazios de propósito —
 * a interface trata vazio como "configuração pendente" e não inventa nada.
 */
export const DEFAULT_SETTINGS: SiteSettingsMap = {
  contact: {
    phone: "(11) 4655-3399",
    phone_secondary: "(11) 99987-6642",
    whatsapp: "5511999876642",
    email: "contato@valedosolimoveis.com.br",
    email_secondary: "franco@valedosolimoveis.com.br",
    address: "Avenida Antônio Afonso de Lima, 704",
    district: "Centro",
    city: "Arujá",
    state: "SP",
    zip: "07400-560",
    hours: "",
    latitude: "",
    longitude: "",
  },
  social: {
    facebook: "https://www.facebook.com/Vale-do-Sol-Im%C3%B3veis-e-Consultoria-731877396834804/",
    instagram: "",
  },
  hero: {
    title: "Encontre o lugar para a sua próxima história.",
    subtitle: "Imóveis selecionados em Arujá e região.",
    image_path: "",
  },
  about: {
    tagline:
      "Desde 1975, construindo relações, negócios e histórias no mercado imobiliário.",
    intro:
      "Fundada em 1975, na cidade de Arujá, São Paulo, a Vale do Sol Empreendimentos Imobiliários nasceu da experiência de seu fundador, Leonardo Barbieri, italiano e veterano no mercado de vendas.",
    history:
      "Ao longo de mais de cinco décadas, a empresa acompanhou o crescimento e a transformação de Arujá e região, construindo sua trajetória com base em conhecimento do mercado, relacionamento próximo com seus clientes e experiência em diferentes segmentos imobiliários.\n\n" +
      "Hoje, a Vale do Sol é conduzida pela segunda geração da família, Maria Barbieri, advogada, e Francisco Barbieri, o Franco, engenheiro mecânico especializado em corretagem de imóveis.\n\n" +
      "A união entre tradição e conhecimento continua sendo parte essencial da nossa forma de trabalhar. Mantemos os valores que deram origem à empresa, ao mesmo tempo em que acompanhamos a evolução do mercado e as novas necessidades de quem compra, vende, investe ou busca administrar um imóvel.",
    specialties:
      "Atuamos na compra, venda e intermediação de imóveis, oferecendo conhecimento e acompanhamento em diferentes tipos de propriedades.",
    segments:
      "Terrenos e áreas | Oportunidades para construção, investimento e desenvolvimento.\n" +
      "Casas e imóveis residenciais | Imóveis para diferentes momentos e necessidades.\n" +
      "Chácaras e sítios | Propriedades para moradia, lazer ou investimento.\n" +
      "Galpões e áreas industriais | Espaços destinados a empresas, operações e expansão de negócios.\n" +
      "Condomínios fechados | Imóveis e terrenos em empreendimentos residenciais.\n" +
      "Administração e locação | Gestão e intermediação de imóveis para proprietários e locatários.",
    closing:
      "Mais do que intermediar imóveis, construímos relações que atravessam gerações.\n\n" +
      "São décadas conhecendo Arujá, seus bairros, suas transformações e o mercado imobiliário da região.",
    communication:
      "Procuramos utilizar as mais diversas e avançadas formas de comunicação para oferecer nossos produtos e encontrar os melhores negócios para nossos clientes, com um padrão de qualidade e excelência especial para satisfazê-los e fidelizá-los.",
    mission:
      "Com atendimento personalizado, entender o cliente e ajudá-lo a realizar seus sonhos, deixando-os felizes e satisfeitos com seu imóvel, objetivando fidelizar o cliente e até nos tornar amigos fiéis.",
    vision:
      "Promover a alegria e satisfação dos clientes, aprimorando cada vez mais o atendimento personalizado, com total suporte até o final da negociação, e, com acompanhamento pós venda.",
    values:
      "Entender o cliente, para melhor atender, através de total dedicação, respeito, valorização, honestidade, transparência, clareza e dignidade. Além de todo o suporte após a compra ou locação de um imóvel.",
  },
  seo: {
    title: "Vale do Sol Imóveis — Imóveis em Arujá desde 1975",
    description:
      "Casas, terrenos, condomínios, chácaras e imóveis comerciais em Arujá e região. Tradição em Arujá desde 1975. CRECI J-14.578.",
  },
  analytics: {
    ga_measurement_id: "",
    gsc_verification: "",
  },
};

/**
 * Lê as configurações públicas. `cache` do React garante uma única consulta
 * por requisição, mesmo que header, footer e página peçam separadamente.
 */
export const getSettings = cache(async (): Promise<SiteSettingsMap> => {
  if (!isSupabaseConfigured()) return DEFAULT_SETTINGS;

  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase.from("site_settings").select("key, value");
    if (error) throw error;

    const settings = { ...DEFAULT_SETTINGS };
    for (const row of data ?? []) {
      const key = row.key as keyof SiteSettingsMap;
      if (key in settings && row.value && typeof row.value === "object") {
        // Mescla: uma chave nova no código continua valendo mesmo que a
        // linha do banco tenha sido salva antes dela existir.
        settings[key] = { ...settings[key], ...row.value } as never;
      }
    }
    return sanitizeSettings(settings);
  } catch {
    // Configuração é conteúdo de apoio: se o banco falhar, o site continua
    // no ar com os dados oficiais conhecidos em vez de mostrar erro.
    return DEFAULT_SETTINGS;
  }
});

/** ID do Google Analytics / Tag Manager: G-XXXX, GT-XXXX, AW-XXXX, UA-XXXX-X. */
export const GA_ID_PATTERN = /^(G|GT|AW|DC)-[A-Z0-9]{4,20}$|^UA-\d{4,12}-\d{1,4}$/;

/**
 * Os valores abaixo vão para dentro de <script> e de href no site público.
 * O formulário já recusa valor fora do formato (actions/admin/content.ts);
 * aqui a regra se repete na leitura, para que um valor gravado por outro
 * caminho nunca vire script ou link "javascript:".
 */
function sanitizeSettings(settings: SiteSettingsMap): SiteSettingsMap {
  const gaId = settings.analytics.ga_measurement_id?.trim().toUpperCase() ?? "";
  return {
    ...settings,
    social: {
      ...settings.social,
      facebook: safeExternalUrl(settings.social.facebook) ?? "",
      instagram: safeExternalUrl(settings.social.instagram) ?? "",
    },
    analytics: {
      ...settings.analytics,
      ga_measurement_id: GA_ID_PATTERN.test(gaId) ? gaId : "",
    },
  };
}

export async function getSetting<K extends keyof SiteSettingsMap>(key: K): Promise<SiteSettingsMap[K]> {
  const settings = await getSettings();
  return settings[key];
}
