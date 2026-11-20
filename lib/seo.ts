import { PRIMARY_CITY, SITE } from "@/lib/site";
import type { SiteSettingsMap } from "@/types/database";

/**
 * SEO e GEO (busca por IA) num lugar só: dados estruturados da empresa, páginas
 * de entrada por tipo de imóvel e a imagem padrão de compartilhamento.
 * Só entra aqui fato verificável (cadastro do painel, CRECI, ano de fundação).
 */

/** Imagem padrão quando a página não tem foto própria (compartilhamento e IA). */
export const DEFAULT_OG_IMAGE = {
  url: "/video/institucional-v2-hero-poster.jpg",
  width: 1920,
  height: 1080,
  alt: "Vale do Sol Imóveis — imobiliária em Arujá desde 1975",
};

export const ORG_ID = `${SITE.url}/#imobiliaria`;
export const WEBSITE_ID = `${SITE.url}/#website`;

/** Só Arujá: é onde todo o acervo cadastrado está. */
const AREA_SERVED = [PRIMARY_CITY];

type Contact = SiteSettingsMap["contact"];
type Social = SiteSettingsMap["social"];

/**
 * Grafo da empresa e do site, emitido uma vez no layout público. As outras
 * páginas apontam para estes @id em vez de repetir (e divergir) os dados.
 */
export function siteGraph(contact: Contact, social: Social) {
  const lat = Number(contact.latitude);
  const lng = Number(contact.longitude);
  const hasGeo = contact.latitude && contact.longitude && Number.isFinite(lat) && Number.isFinite(lng);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["RealEstateAgent", "LocalBusiness"],
        "@id": ORG_ID,
        name: SITE.name,
        legalName: SITE.legalName,
        alternateName: "Vale do Sol Imóveis e Consultoria",
        url: SITE.url,
        logo: { "@type": "ImageObject", url: `${SITE.url}/brand/logo.png` },
        image: `${SITE.url}${DEFAULT_OG_IMAGE.url}`,
        description: `Imobiliária em ${PRIMARY_CITY} desde ${SITE.foundedYear}: casas, terrenos, condomínios, chácaras e imóveis comerciais em Arujá e região.`,
        foundingDate: String(SITE.foundedYear),
        founder: { "@type": "Person", name: "Leonardo Barbieri" },
        telephone: contact.phone || undefined,
        email: contact.email || undefined,
        address: {
          "@type": "PostalAddress",
          streetAddress: contact.address || undefined,
          addressLocality: contact.city || PRIMARY_CITY,
          addressRegion: contact.state || "SP",
          postalCode: contact.zip || undefined,
          addressCountry: "BR",
        },
        ...(hasGeo ? { geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng } } : {}),
        areaServed: AREA_SERVED.map((name) => ({ "@type": "City", name })),
        knowsAbout: [
          `Compra e venda de imóveis em ${PRIMARY_CITY}`,
          "Locação de imóveis",
          "Casas e terrenos em condomínio",
          "Chácaras e sítios",
          "Imóveis comerciais",
        ],
        identifier: [
          { "@type": "PropertyValue", name: "CRECI (imobiliária)", value: SITE.creciCompany },
          { "@type": "PropertyValue", name: "CRECI (corretor responsável)", value: SITE.creciBroker },
        ],
        sameAs: [social.facebook, social.instagram].filter(Boolean),
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: SITE.url,
        name: SITE.name,
        inLanguage: "pt-BR",
        publisher: { "@id": ORG_ID },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/imoveis?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

/* ------------------------------------------------------------------ Entradas */

export interface LandingFaq {
  question: string;
  answer: string;
}

export interface Landing {
  slug: string;
  /** Filtros aplicados à listagem da página. */
  filters: { profile?: "casas" | "terrenos" | "chacaras" | "condominios" | "comerciais"; purpose?: "venda" | "locacao" };
  /** Título da aba (o layout acrescenta o nome do site). */
  title: string;
  description: string;
  h1: string;
  intro: string[];
  faq: LandingFaq[];
  /** Rótulo curto para links internos. */
  label: string;
}

const CRECI_LINE = `A Vale do Sol Imóveis atende em Arujá desde ${SITE.foundedYear} e tem registro no CRECI (${SITE.creciCompany}).`;

/**
 * Cada entrada responde a uma busca real ("casas à venda em Arujá" etc.) com a
 * listagem ao vivo do acervo. O texto é de orientação geral ao comprador, sem
 * número, preço ou promessa que mude de um dia para o outro.
 */
export const LANDINGS: Landing[] = [
  {
    slug: "casas-a-venda-em-aruja",
    label: "Casas à venda em Arujá",
    filters: { profile: "casas", purpose: "venda" },
    title: "Casas à venda em Arujá",
    description:
      "Casas e sobrados à venda em Arujá, em bairro e em condomínio. Fotos, valores e atendimento direto da Vale do Sol Imóveis, em Arujá desde 1975.",
    h1: "Casas à venda em Arujá",
    intro: [
      `Veja as casas, sobrados e residências à venda em ${PRIMARY_CITY}, em bairros tradicionais e em condomínios. A lista abaixo é o acervo atual da Vale do Sol e muda conforme os imóveis são publicados ou vendidos.`,
      `${CRECI_LINE} Se não encontrar o que procura, fale com a gente: nem tudo o que temos está publicado.`,
    ],
    faq: [
      {
        question: "Quais documentos conferir antes de comprar uma casa em Arujá?",
        answer:
          "Peça a matrícula atualizada do imóvel no cartório de registro de imóveis, as certidões do vendedor e a situação do IPTU. Isso confirma quem é o proprietário e se há dívidas, penhoras ou ônus sobre a casa. A imobiliária pode orientar cada etapa.",
      },
      {
        question: "Posso financiar a compra de uma casa?",
        answer:
          "Sim, na maioria dos casos. O financiamento depende da análise de crédito do comprador e da avaliação do imóvel pelo banco, e a casa precisa estar com a documentação regular. A página de cada imóvel tem um simulador de parcelas para ter uma ideia inicial.",
      },
      {
        question: "Qual a diferença entre casa em bairro e casa em condomínio?",
        answer:
          "A casa em condomínio fechado costuma ter portaria, áreas comuns e regras internas, com taxa condominial mensal. A casa em bairro não tem essa taxa e oferece mais liberdade de uso, mas a segurança e a infraestrutura dependem da rua. A ficha de cada imóvel informa o condomínio e o valor da taxa quando cadastrados.",
      },
    ],
  },
  {
    slug: "terrenos-a-venda-em-aruja",
    label: "Terrenos à venda em Arujá",
    filters: { profile: "terrenos", purpose: "venda" },
    title: "Terrenos à venda em Arujá",
    description:
      "Terrenos à venda em Arujá: em bairro, em condomínio e comerciais. Metragem, localização e valores na Vale do Sol Imóveis, em Arujá desde 1975.",
    h1: "Terrenos à venda em Arujá",
    intro: [
      `Terrenos em bairro, em condomínio e comerciais em ${PRIMARY_CITY}, para construir a casa própria ou investir. Cada anúncio mostra a metragem e a localização do lote.`,
      `${CRECI_LINE} Antes de fechar, nós ajudamos a conferir a documentação e as regras de construção do lote.`,
    ],
    faq: [
      {
        question: "O que verificar antes de comprar um terreno em Arujá?",
        answer:
          "Confira a matrícula atualizada, se o lote está regularizado e quais são os parâmetros de construção permitidos pela prefeitura (zoneamento, recuos e taxa de ocupação). Em loteamento ou condomínio, peça também o regulamento interno.",
      },
      {
        question: "Terreno em condomínio tem regras para construir?",
        answer:
          "Em geral sim. Condomínios costumam ter regulamento próprio sobre projeto, padrão de construção e prazos de obra, além da taxa condominial. Leia o regulamento antes de comprar.",
      },
      {
        question: "Posso financiar a compra de um terreno?",
        answer:
          "Há linhas de crédito para terreno, mas as condições costumam ser diferentes das de imóvel pronto e dependem do banco e do comprador. Vale consultar a instituição financeira antes de decidir.",
      },
    ],
  },
  {
    slug: "chacaras-a-venda-em-aruja",
    label: "Chácaras à venda em Arujá",
    filters: { profile: "chacaras", purpose: "venda" },
    title: "Chácaras e sítios à venda em Arujá",
    description:
      "Chácaras e sítios à venda em Arujá e região, com espaço, verde e documentação conferida. Atendimento da Vale do Sol Imóveis, em Arujá desde 1975.",
    h1: "Chácaras e sítios à venda em Arujá",
    intro: [
      `Chácaras e sítios em ${PRIMARY_CITY} e região para quem quer mais espaço, verde e tranquilidade perto da capital. Veja abaixo o que está disponível agora.`,
      `${CRECI_LINE} Em imóveis desse tipo a documentação pede atenção extra, e nós acompanhamos a conferência com você.`,
    ],
    faq: [
      {
        question: "Chácara é imóvel urbano ou rural?",
        answer:
          "Depende da localização e da classificação do imóvel. Imóvel urbano paga IPTU à prefeitura; imóvel rural tem outras exigências, como o CCIR e o ITR. Confirme na matrícula e na prefeitura como a chácara está classificada antes de comprar.",
      },
      {
        question: "Dá para financiar uma chácara?",
        answer:
          "Pode ser possível, mas bancos costumam fazer exigências específicas para chácaras e sítios, como a regularidade da documentação e a avaliação do imóvel. Consulte a instituição financeira com a matrícula em mãos.",
      },
    ],
  },
  {
    slug: "condominios-em-aruja",
    label: "Imóveis em condomínio em Arujá",
    filters: { profile: "condominios", purpose: "venda" },
    title: "Casas e terrenos em condomínio em Arujá",
    description:
      "Casas e terrenos em condomínios fechados de Arujá, como o Arujá Hills. Veja o acervo da Vale do Sol Imóveis, em Arujá desde 1975.",
    h1: "Casas e terrenos em condomínio em Arujá",
    intro: [
      `Imóveis em condomínios fechados de ${PRIMARY_CITY}: casas prontas e terrenos para construir, com a segurança e a estrutura de um condomínio.`,
      `${CRECI_LINE} Cada anúncio informa o condomínio e, quando cadastrada, a taxa mensal.`,
    ],
    faq: [
      {
        question: "O que está incluído na taxa condominial?",
        answer:
          "A taxa cobre os custos comuns do condomínio, como portaria, manutenção das áreas comuns e conservação das vias. O que entra varia de condomínio para condomínio, então peça o detalhamento antes de comprar.",
      },
      {
        question: "Preciso de aprovação para construir ou reformar em condomínio?",
        answer:
          "Normalmente sim. O condomínio costuma exigir a aprovação do projeto pela administração, além da aprovação na prefeitura. Peça o regulamento de obras ao comprar um terreno ou uma casa.",
      },
    ],
  },
  {
    slug: "imoveis-comerciais-em-aruja",
    label: "Imóveis comerciais em Arujá",
    filters: { profile: "comerciais" },
    title: "Imóveis comerciais em Arujá",
    description:
      "Prédios, salas, terrenos comerciais e galpões em Arujá. Veja o acervo de imóveis comerciais da Vale do Sol Imóveis, em Arujá desde 1975.",
    h1: "Imóveis comerciais em Arujá",
    intro: [
      `Prédios, salas, terrenos comerciais e galpões em ${PRIMARY_CITY}, para abrir, ampliar ou investir. Veja abaixo o que está disponível.`,
      `${CRECI_LINE} Fale com a gente para avaliar localização, documentação e uso permitido do imóvel.`,
    ],
    faq: [
      {
        question: "Como saber se o imóvel pode receber a minha atividade?",
        answer:
          "Cada atividade comercial depende do zoneamento do local e do alvará da prefeitura. Antes de comprar ou alugar, confirme se o uso pretendido é permitido naquele endereço.",
      },
      {
        question: "A Vale do Sol também administra locação comercial?",
        answer:
          "Os imóveis do acervo aparecem como venda ou locação em cada anúncio. Para saber o que está disponível para alugar, fale com a equipe pelo WhatsApp ou pelo telefone do escritório.",
      },
    ],
  },
  {
    slug: "imoveis-para-alugar-em-aruja",
    label: "Imóveis para alugar em Arujá",
    filters: { purpose: "locacao" },
    title: "Imóveis para alugar em Arujá",
    description:
      "Imóveis para alugar em Arujá: casas, salas e imóveis comerciais. Veja o que está disponível na Vale do Sol Imóveis, em Arujá desde 1975.",
    h1: "Imóveis para alugar em Arujá",
    intro: [
      `Imóveis disponíveis para locação em ${PRIMARY_CITY}. A lista abaixo mostra apenas o que está publicado agora.`,
      `${CRECI_LINE} Se procura um imóvel para alugar que ainda não apareceu, deixe seu contato e avisamos quando entrar.`,
    ],
    faq: [
      {
        question: "Quais documentos são pedidos para alugar um imóvel?",
        answer:
          "Em geral, documento de identidade, CPF, comprovante de renda e uma das garantias de locação (fiador, seguro-fiança ou depósito caução). A imobiliária confirma o que é exigido para cada imóvel.",
      },
    ],
  },
];

export function getLanding(slug: string): Landing | undefined {
  return LANDINGS.find((landing) => landing.slug === slug);
}

/** FAQPage de uma entrada, para respostas diretas em buscadores e IAs. */
export function faqJsonLd(faq: LandingFaq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
