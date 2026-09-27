/**
 * XML no formato do Chaves na Mão.
 *
 * Raiz <Document> > <imoveis> > <imovel>, com as 53 tags da documentação
 * oficial, na mesma ordem e grafia, presentes mesmo quando vazias (o portal
 * exige). Só entram imóveis que passaram por portalIssues().
 */
import { toLocalInput } from "@/lib/datetime";
import { CHAVES_NA_MAO_COMMERCIAL } from "./definitions";
import { tag, wrap, cdata, xmlNumber, xmlInt, XML_DECLARATION } from "./xml";
import { splitAddress, type FeedContext, type FeedProperty } from "./feed-types";

/** "AAAA-MM-DD HH:MM:SS" no horário de Arujá, o formato que o portal aceita. */
function portalDateTime(value: string): string {
  return `${toLocalInput(value).replace("T", " ")}:00`;
}

function imovel(property: FeedProperty, context: FeedContext): string {
  const isRent = property.purpose === "locacao";
  const isCommercial = (CHAVES_NA_MAO_COMMERCIAL as readonly string[]).includes(property.portalType);
  const address = splitAddress(property.address);

  const fotos = property.photos.map((photo) =>
    wrap("foto", [tag("url", photo.url), tag("data_atualizacao", portalDateTime(photo.updatedAt))])
  );

  return wrap("imovel", [
    tag("referencia", property.code),
    tag("codigo_cliente", property.code),
    tag("link_cliente", property.url),
    tag("titulo", property.title),
    tag("transacao", isRent ? "L" : "V"),
    tag("transacao2", ""),
    tag("finalidade", isCommercial ? "CO" : "RE"),
    tag("finalidade2", ""),
    tag("destaque", property.highlight ? "1" : "0"),
    tag("tipo", property.portalType),
    tag("tipo2", ""),
    tag("valor", xmlNumber(property.price)),
    tag("valor_locacao", ""),
    tag("valor_iptu", xmlNumber(property.iptu)),
    tag("valor_condominio", xmlNumber(property.condo_fee)),
    tag("area_total", xmlNumber(property.area_total)),
    tag("area_util", xmlNumber(property.area_built)),
    tag("conservacao", ""),
    tag("quartos", xmlInt(property.bedrooms)),
    tag("suites", xmlInt(property.suites)),
    tag("garagem", xmlInt(property.parking_spaces)),
    tag("banheiro", xmlInt(property.bathrooms)),
    tag("closet", ""),
    tag("salas", ""),
    tag("despensa", ""),
    tag("bar", ""),
    tag("cozinha", ""),
    tag("quarto_empregada", ""),
    tag("escritorio", ""),
    tag("area_servico", ""),
    tag("lareira", ""),
    tag("varanda", ""),
    tag("lavanderia", ""),
    tag("aceita_pet", ""),
    tag("estado", context.state),
    tag("cidade", property.city),
    tag("bairro", property.neighborhood),
    tag("cep", (property.zip_code ?? "").replace(/\D/g, "").slice(0, 8)),
    tag("endereco", address.street.slice(0, 200)),
    tag("numero", address.number.slice(0, 10)),
    tag("complemento", ""),
    // O portal mostra só bairro e cidade, não a rua e o número.
    tag("esconder_endereco_imovel", "1"),
    `<descritivo>${cdata(property.description.slice(0, 3000))}</descritivo>`,
    wrap("fotos_imovel", fotos),
    tag("data_atualizacao", portalDateTime(property.updated_at)),
    tag("latitude", property.latitude ?? ""),
    tag("longitude", property.longitude ?? ""),
    tag("video", ""),
    tag("tour_360", ""),
    wrap("area_comum", []),
    wrap("area_privativa", []),
    tag("aceita_troca", ""),
    // 1 = por mês. Só se envia em locação.
    tag("periodo_locacao", isRent ? "1" : ""),
  ]);
}

export function buildChavesNaMaoXml(properties: FeedProperty[], context: FeedContext): string {
  return (
    XML_DECLARATION +
    "\n" +
    wrap("Document", [wrap("imoveis", properties.map((property) => imovel(property, context)))]) +
    "\n"
  );
}
