/**
 * Padronização da descrição do imóvel.
 *
 * O texto é gravado como a equipe digitou (ou como veio do WordPress) e só é
 * arrumado na hora de mostrar — assim os imóveis antigos também saem no padrão
 * e nada se perde no banco. O mesmo formatador alimenta a página do imóvel, a
 * vitrine, o SEO e a prévia do painel.
 *
 * O que ele faz:
 * - espaços, tabulações e espaço antes de vírgula/ponto;
 * - PALAVRAS GRITADAS em caixa baixa (siglas conhecidas ficam: IPTU, CRECI…);
 * - primeira letra maiúscula e ponto final em todo parágrafo;
 * - frase que termina em "contendo:" sem lista depois vira frase completa;
 * - linhas com marcador (-, •, *, 1.) ou quantidade ("3 Quartos…") viram lista.
 */

export type DescriptionBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

/** Siglas que continuam em maiúsculas mesmo num texto todo gritado. */
const KEEP_UPPER = new Set([
  "IPTU", "ITBI", "FGTS", "CRECI", "CNPJ", "CPF", "AVCB", "ART", "RGI", "CEP",
  "SP", "RJ", "MG", "PR", "SC", "RS", "BR", "TV", "WC", "AC", "II", "III", "IV",
]);

/** Nomes próprios da região que voltam com maiúscula depois de um texto gritado. */
const PROPER = new Map(
  [
    "Arujá", "Arujazinho", "Hills", "Jordanópolis", "Guarulhos", "Itaquaquecetuba", "Mogi", "Cruzes",
    "Santa", "Isabel", "Paulo", "Planalto", "Retiro", "Domingos", "Fazenda", "Velha", "Centro",
  ].map((name) => [name.toLocaleLowerCase("pt-BR"), name])
);

const BULLET = /^\s*(?:[-–—•*·▪►✓✔]+|\d{1,2}[.)])\s+/u;
const QUANTITY = /^\d{1,2}\s+\p{L}/u;
const TERMINAL = /[.!?…]$/u;
/** "…, contendo:" / "… com:" — abertura de lista que ficou sem a lista. */
const DANGLING_INTRO =
  /[\s,;–—-]*(?:\b(?:contendo|cont[eé]m|composta?\s+(?:de|por)|que\s+possui|possuindo|possui|sendo|com|tendo)\b)?[\s,;]*:\s*$/iu;

function isShouting(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 12) return false;
  const upper = letters.filter((ch) => ch === ch.toLocaleUpperCase("pt-BR") && ch !== ch.toLocaleLowerCase("pt-BR"));
  return upper.length / letters.length > 0.7;
}

function fixCase(text: string): string {
  const shouting = isShouting(text);
  return text.replace(/\p{L}[\p{L}'’-]*/gu, (word) => {
    if (KEEP_UPPER.has(word)) return word;
    const isUpper = word === word.toLocaleUpperCase("pt-BR") && word !== word.toLocaleLowerCase("pt-BR");
    if (!isUpper) return word;
    // Texto todo em caixa alta: tudo em caixa baixa. Palavra solta gritada: só
    // as de 4+ letras, para não mexer em sigla curta que não está na lista.
    if (shouting || word.length >= 4) {
      const lower = word.toLocaleLowerCase("pt-BR");
      return (shouting && PROPER.get(lower)) || lower;
    }
    return word;
  });
}

/** Maiúscula no começo do texto e depois de cada ponto final, "!" ou "?". */
function capitalize(text: string): string {
  return text.replace(/(^|[.!?…]\s+)([^\p{L}\p{N}]*)(\p{L})/gu, (_, before, gap, letter) =>
    `${before}${gap}${letter.toLocaleUpperCase("pt-BR")}`
  );
}

function tidy(text: string): string {
  const cleaned = text
    .replace(/[\t   ]/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\s+([,;:.!?)])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/([,;])(?=\p{L})/gu, "$1 ")
    .replace(/!{2,}/g, "!")
    .replace(/\?{2,}/g, "?")
    .replace(/,{2,}/g, ",")
    .trim();
  return capitalize(fixCase(cleaned));
}

/** Um item de lista: sem marcador, sem pontuação no fim, primeira letra maiúscula. */
export function formatListItem(item: string): string {
  return tidy(item.replace(BULLET, "")).replace(/[\s;,.:]+$/u, "");
}

function finishParagraph(text: string, followedByList: boolean): string {
  let value = tidy(text);
  if (value.endsWith(":") && !followedByList) {
    value = value.replace(DANGLING_INTRO, "");
  }
  value = value.replace(/[\s;,]+$/u, "");
  if (!value) return "";
  if (!TERMINAL.test(value) && !value.endsWith(":")) value += ".";
  return value;
}

type Unit = { kind: "paragraph" | "item" | "quantity"; text: string };

function toUnits(raw: string): Unit[] {
  const units: Unit[] = [];
  const blocks = raw.replace(/\r\n?/g, "\n").split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    // Várias linhas curtas no mesmo bloco ("Sala\nCozinha\nLareira") são lista,
    // mesmo sem marcador. Uma primeira linha terminada em ":" é a abertura.
    const [head, ...rest] = lines;
    const body = head.endsWith(":") ? rest : lines;
    const looksLikeList =
      body.length >= 2 && body.every((line) => BULLET.test(line) || (line.length <= 90 && !/[.!?]$/.test(line)));

    let buffer: string[] = [];
    const flush = () => {
      if (buffer.length) units.push({ kind: "paragraph", text: buffer.join(" ") });
      buffer = [];
    };

    for (const [index, line] of lines.entries()) {
      const isOpening = index === 0 && head.endsWith(":");
      if (BULLET.test(line) || (looksLikeList && !isOpening)) {
        flush();
        units.push({ kind: "item", text: line });
      } else if (lines.length === 1 && QUANTITY.test(line)) {
        units.push({ kind: "quantity", text: line });
      } else {
        buffer.push(line);
      }
    }
    flush();
  }
  return units;
}

export function formatDescription(raw: string | null | undefined): DescriptionBlock[] {
  if (!raw?.trim()) return [];
  const units = toUnits(raw);

  // Parágrafos de uma linha que começam por quantidade ("1 Sala de jantar")
  // só viram lista quando aparecem em sequência; sozinhos seguem como texto.
  for (let i = 0; i < units.length; i++) {
    if (units[i].kind !== "quantity") continue;
    const neighbour = units[i - 1]?.kind === "quantity" || units[i - 1]?.kind === "item" ||
      units[i + 1]?.kind === "quantity" || units[i + 1]?.kind === "item";
    units[i] = { kind: neighbour ? "item" : "paragraph", text: units[i].text };
  }

  const blocks: DescriptionBlock[] = [];
  units.forEach((unit, index) => {
    if (unit.kind === "item") {
      const item = formatListItem(unit.text);
      if (!item) return;
      const last = blocks.at(-1);
      if (last?.type === "list") last.items.push(item);
      else blocks.push({ type: "list", items: [item] });
      return;
    }
    const text = finishParagraph(unit.text, units[index + 1]?.kind === "item");
    if (text) blocks.push({ type: "paragraph", text });
  });
  return blocks;
}

/** A descrição padronizada em texto corrido — para SEO, JSON-LD e vitrine. */
export function descriptionPlainText(raw: string | null | undefined): string {
  return formatDescription(raw)
    .map((block) => (block.type === "paragraph" ? block.text : `${block.items.join("; ")}.`))
    .join(" ");
}
