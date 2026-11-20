import { PRIMARY_CITY, SITE } from "@/lib/site";
import { LANDINGS } from "@/lib/seo";
import { getSettings } from "@/lib/queries/settings";
import { getRegions } from "@/lib/queries/taxonomies";

export const revalidate = 3600;

/**
 * Resumo do site para assistentes de IA (llms.txt). Só fatos cadastrados:
 * quem somos, onde fica, registro no CRECI e as páginas que respondem às
 * perguntas mais comuns. Preço e disponibilidade ficam nas páginas, que são
 * a fonte atual.
 */
export async function GET() {
  const [{ contact }, regions] = await Promise.all([
    getSettings(),
    getRegions().catch(() => []),
  ]);

  const address = [contact.address, contact.district, `${contact.city}-${contact.state}`, contact.zip]
    .filter(Boolean)
    .join(", ");

  const lines = [
    `# ${SITE.name}`,
    "",
    `> Imobiliária em ${PRIMARY_CITY} (SP) desde ${SITE.foundedYear}. Venda e locação de casas, terrenos, condomínios, chácaras e imóveis comerciais em Arujá e região. Fundada por Leonardo Barbieri e conduzida hoje pela segunda geração da família Barbieri.`,
    "",
    "## Quem somos",
    `- Razão social: ${SITE.legalName}`,
    `- Registro: CRECI ${SITE.creciCompany} (imobiliária); corretor responsável CRECI ${SITE.creciBroker}`,
    `- Endereço: ${address}`,
    contact.phone ? `- Telefone: ${contact.phone}` : "",
    contact.phone_secondary ? `- Celular / WhatsApp: ${contact.phone_secondary}` : "",
    contact.email ? `- E-mail: ${contact.email}` : "",
    "",
    "## Páginas principais",
    `- [Início](${SITE.url}/): visão geral e imóveis em destaque`,
    `- [Todos os imóveis](${SITE.url}/imoveis): acervo completo com filtros`,
    ...LANDINGS.map((landing) => `- [${landing.label}](${SITE.url}/${landing.slug}): ${landing.description}`),
    `- [Regiões](${SITE.url}/regioes): bairros e condomínios de Arujá`,
    `- [Venda seu imóvel](${SITE.url}/venda-seu-imovel): para proprietários que querem anunciar`,
    `- [A imobiliária](${SITE.url}/a-imobiliaria): história e equipe`,
    `- [Contato](${SITE.url}/contato): endereço, telefone e WhatsApp`,
    "",
    regions.length ? "## Bairros e condomínios" : "",
    ...regions.map((region) => `- [${region.name}](${SITE.url}/regioes/${region.slug})`),
    "",
    "## Observações",
    "- Valores, disponibilidade e fotos mudam: consulte sempre a página de cada imóvel (/imoveis/<código ou nome>).",
    `- Sitemap: ${SITE.url}/sitemap.xml`,
    "",
  ];

  return new Response(lines.filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
