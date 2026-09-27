import type { PropertyPurpose } from "@/types/database";
import { formatDescription, formatListItem } from "@/lib/description";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/**
 * Preço do imóvel. Sem valor cadastrado, o site diz "Sob consulta" —
 * nunca exibe R$ 0, que passaria informação errada ao visitante.
 */
export function formatPrice(
  value: number | null | undefined,
  options: { purpose?: PropertyPurpose; onRequest?: boolean } = {}
): string {
  if (options.onRequest || value === null || value === undefined || value <= 0) {
    return "Sob consulta";
  }
  const formatted = brl.format(value);
  return options.purpose === "locacao" ? `${formatted}/mês` : formatted;
}

export function formatArea(value: number | null | undefined): string | null {
  if (value === null || value === undefined || value <= 0) return null;
  return `${decimal.format(value)} m²`;
}

export function formatNumber(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return decimal.format(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

/** Deixa só os dígitos — usado em href de telefone e no link do WhatsApp. */
export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

export function phoneHref(value: string | null | undefined): string | null {
  const digits = digitsOnly(value);
  if (digits.length < 8) return null;
  return `tel:+55${digits.length > 11 ? digits.slice(-11) : digits}`;
}

/**
 * Monta o link do WhatsApp. O número vem de site_settings (ou da variável de
 * ambiente) — nunca escrito direto num componente.
 */
export function whatsappUrl(number: string | null | undefined, message?: string): string | null {
  const digits = digitsOnly(number);
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${withCountry}${query}`;
}

/** Mensagem padrão de interesse, com o código do imóvel (e o nome, se já souber). */
export function propertyWhatsAppMessage(input: {
  code?: string | null;
  title?: string | null;
  name?: string | null;
}): string {
  const reference = [input.code, input.title].filter(Boolean).join(" — ");
  const name = input.name?.trim();
  const greeting = name ? `Olá, sou ${name}. Vi` : "Olá, vi";
  return `${greeting} o imóvel ${reference || "anunciado"} no site da Vale do Sol Imóveis e gostaria de saber mais.`;
}

/** "Arujá / Centro" — usado em cards e breadcrumbs. */
export function formatLocation(input: { city?: string | null; neighborhood?: string | null }): string {
  return [input.neighborhood, input.city].filter(Boolean).join(", ");
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Corta um texto em um limite de caracteres sem partir palavra. */
export function truncate(value: string | null | undefined, max: number): string {
  if (!value) return "";
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}…`;
}

/**
 * Uma linha de apresentação do imóvel, tirada só do que foi cadastrado:
 * a primeira frase da descrição, quando ela diz algo além do título; se
 * não houver, os primeiros itens de "Ambientes" (ex.: "Casa com 5 suítes ·
 * Área de lazer com piscina"). Nada é redigido aqui — sem dado, sem linha.
 */
export function propertyLede(
  property: { title: string; description?: string | null; highlights?: string[] | null },
  max = 170
): string | null {
  const normalize = (value: string) =>
    value.toLocaleLowerCase("pt-BR").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

  const opening = formatDescription(property.description)[0];
  const first = opening?.type === "paragraph" ? opening.text : undefined;
  const sentence = first?.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? first;
  if (
    sentence &&
    !sentence.endsWith(":") &&
    sentence.length > 24 &&
    !normalize(property.title).includes(normalize(sentence))
  ) {
    return truncate(sentence, max);
  }

  const items = (property.highlights ?? [])
    .map(formatListItem)
    // Medidas soltas ("A/T = 2.000,00 m²") já aparecem na ficha.
    .filter((item) => item.length > 3 && !/=|^a\/[tc]\b/i.test(item));
  if (!items.length) return null;

  let line = items[0];
  for (const item of items.slice(1, 3)) {
    if (`${line} · ${item}`.length > max) break;
    line = `${line} · ${item}`;
  }
  return truncate(line, max);
}
