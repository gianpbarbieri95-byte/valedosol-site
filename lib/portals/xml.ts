/**
 * Montagem de XML sem dependência externa.
 *
 * Todo texto passa por `escapeXml` e todo bloco livre (descrição) vai em
 * CDATA — um "&" ou "<" digitado no painel nunca quebra o arquivo que o
 * portal lê.
 */

export function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** CDATA seguro: "]]>" dentro do texto é dividido em dois blocos. */
export function cdata(value: string): string {
  const clean = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return `<![CDATA[${clean.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

type Attrs = Record<string, string | number | boolean | null | undefined>;

function renderAttrs(attrs?: Attrs): string {
  if (!attrs) return "";
  return Object.entries(attrs)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => ` ${key}="${escapeXml(String(value))}"`)
    .join("");
}

/** <name attrs>texto</name>. Valor vazio gera a tag vazia (<name></name>). */
export function tag(name: string, value: string | number | null | undefined, attrs?: Attrs): string {
  const text = value === null || value === undefined ? "" : escapeXml(String(value));
  return `<${name}${renderAttrs(attrs)}>${text}</${name}>`;
}

/** Tag só quando há valor — para elementos opcionais. */
export function optionalTag(name: string, value: string | number | null | undefined, attrs?: Attrs): string {
  if (value === null || value === undefined || value === "") return "";
  return tag(name, value, attrs);
}

/** Tag com filhos já montados. */
export function wrap(name: string, children: string[] | string, attrs?: Attrs): string {
  const inner = Array.isArray(children) ? children.filter(Boolean).join("") : children;
  return `<${name}${renderAttrs(attrs)}>${inner}</${name}>`;
}

/** Número no formato que os portais pedem: ponto decimal, sem milhar. */
export function xmlNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "";
  const fixed = Number(value).toFixed(decimals);
  return fixed.replace(/\.?0+$/, "") || "0";
}

export function xmlInt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "";
  return String(Math.round(Number(value)));
}

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
