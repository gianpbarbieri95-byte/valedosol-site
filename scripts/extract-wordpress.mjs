/**
 * Extrai o acervo real do site WordPress atual da Vale do Sol.
 *
 * Não escreve nada no Supabase: só baixa e normaliza, para que os dados possam
 * ser conferidos antes de qualquer importação.
 *
 *   node scripts/extract-wordpress.mjs
 *
 * Saída:
 *   data/properties.json   registros normalizados
 *   data/taxonomies.json   cidades, bairros e tipos encontrados
 *   data/images/<CODIGO>/  fotos originais
 */

import { mkdir, writeFile, readFile, stat, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

const ORIGIN = "https://valedosolimoveis.com.br";
const OUT_DIR = path.resolve("data");
const IMG_DIR = path.join(OUT_DIR, "images");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const args = new Set(process.argv.slice(2));
const SKIP_IMAGES = args.has("--no-images");
const ONLY_IMAGES = args.has("--only-images");

/**
 * O servidor da Vale do Sol bloqueia o IP por alguns minutos a cada rajada:
 * 6 conexões simultâneas perderam 415 de 541 imagens, e 2 conexões ainda
 * caíam em ciclos de "connect timeout". Uma conexão só, com pausa entre
 * requisições, é lento mas atravessa. Leva o tempo que levar.
 */
const CONCURRENCY = 1;
/**
 * Testado em 23/09/2026: não é cabeçalho nem Referer — qualquer requisição
 * isolada passa com 200. O que derruba é volume por janela de tempo. Com
 * 1,2s entre fotos o bloqueio voltava; 3,5s atravessa.
 */
const POLITE_DELAY = 3500;

/**
 * Quando o servidor começa a recusar conexão, insistir só prolonga o bloqueio.
 * A espera cresce a cada rodada de falhas: 2min, 5min, 10min. Um recuo fixo
 * de 90s não era suficiente e o script ficava girando em falso.
 */
const COOLDOWN_AFTER_FAILURES = 3;
const COOLDOWN_STEPS_MS = [120_000, 300_000, 600_000];

let consecutiveFailures = 0;
let cooldownIndex = 0;

async function cooldownIfBlocked() {
  if (consecutiveFailures < COOLDOWN_AFTER_FAILURES) return;

  const wait = COOLDOWN_STEPS_MS[Math.min(cooldownIndex, COOLDOWN_STEPS_MS.length - 1)];
  console.warn(
    `\n  servidor recusando conexão; pausando ${Math.round(wait / 60_000)}min antes de continuar...`
  );

  consecutiveFailures = 0;
  cooldownIndex++;
  await sleep(wait);
}

/* ------------------------------------------------------------------ utils */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * O fetch do Node não tem timeout padrão: uma conexão que o servidor deixa
 * pendurada trava o script para sempre. Todo pedido daqui leva prazo.
 */
const REQUEST_TIMEOUT = 25_000;

function request(url, extraHeaders = {}) {
  return fetch(url, {
    headers: { "User-Agent": UA, ...extraHeaders },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
}

async function getJSON(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await request(url, { Accept: "application/json" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === tries) throw err;
      await sleep(800 * i);
    }
  }
}

async function getText(url, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await request(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === tries) throw err;
      await sleep(800 * i);
    }
  }
}

/** Decodifica as entidades HTML que o WordPress devolve nos títulos. */
function decodeEntities(str = "") {
  const named = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#039;": "'",
    "&apos;": "'", "&nbsp;": " ", "&#8211;": "–", "&#8212;": "—",
    "&#8216;": "‘", "&#8217;": "’", "&#8220;": "“", "&#8221;": "”",
    "&#8230;": "…", "&ordm;": "º", "&ordf;": "ª", "&deg;": "°",
  };
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z#0-9]+;/gi, (m) => named[m] ?? m)
    .trim();
}

function stripTags(html = "") {
  return decodeEntities(
    html
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toInt(value) {
  const n = toNumber(value);
  return n === null ? null : Math.round(n);
}

/* ------------------------------------------------------------- taxonomias */

/**
 * O WordPress não expõe as taxonomias do CPT `property` na REST API.
 *
 * Ler os links da página de cada imóvel não funciona: o menu de navegação
 * repete todas as cidades e todos os tipos em toda página, e o parser acaba
 * atribuindo a primeira opção do menu a todo mundo.
 *
 * A leitura confiável é pelo caminho inverso — a página de arquivo de cada
 * taxonomia. Em /tipo-de-imovel/casa-condominios/, todo link para /imoveis/
 * é, por definição, um imóvel daquele tipo. O menu não interfere porque não
 * aponta para /imoveis/.
 */

/** Percorre um arquivo paginado e devolve os slugs de imóvel listados nele. */
async function collectArchive(basePath) {
  const slugs = new Set();

  for (let page = 1; page <= 25; page++) {
    const url = page === 1 ? `${ORIGIN}${basePath}` : `${ORIGIN}${basePath}page/${page}/`;

    let html;
    try {
      html = await getText(url);
    } catch {
      break; // 404 na paginação = acabou
    }

    const found = [...html.matchAll(/href="[^"]*\/imoveis\/([a-z0-9-]+)\/?"/gi)].map((m) => m[1]);
    const before = slugs.size;
    for (const slug of found) slugs.add(slug);

    if (found.length === 0 || slugs.size === before) break;
    await sleep(POLITE_DELAY);
  }

  return [...slugs];
}

/**
 * Termos observados na auditoria do site (menu de navegação de /local/,
 * /tipo-de-imovel/ e /situacao/).
 *
 * Ficam fixos aqui porque raspar o menu depende de o servidor responder, e
 * ele bloqueia o nosso IP a cada rajada. Com a lista conhecida, a extração
 * vai direto às páginas de arquivo, que é o que realmente importa. O menu
 * ainda é lido quando dá — se aparecer um termo novo, ele entra na lista.
 */
const KNOWN_TERMS = {
  cities: [
    { slug: "aruja", label: "Arujá" },
    { slug: "guarulhos", label: "Guarulhos" },
    { slug: "itaquaquecetuba", label: "Itaquaquecetuba" },
    { slug: "mogi-das-cruzes", label: "Mogi das Cruzes" },
    { slug: "santa-isabel", label: "Santa Isabel" },
    { slug: "suzano", label: "Suzano" },
  ],
  types: [
    { slug: "apartamento", label: "Apartamento" },
    { slug: "casa-bairro", label: "Casa em Bairro" },
    { slug: "casa-condominios", label: "Casa em Condomínio" },
    { slug: "chacara-sitios", label: "Chácara / Sítio" },
    { slug: "comercial", label: "Comercial" },
    { slug: "galpao-industrial", label: "Galpão Industrial" },
    { slug: "imoveis-comerciais", label: "Imóveis Comerciais" },
    { slug: "imoveis-litoral", label: "Imóveis no Litoral" },
    { slug: "industrial-terreno", label: "Área Industrial" },
    { slug: "terreno-bairro", label: "Terreno em Bairro" },
    { slug: "terreno-comercial", label: "Terreno Comercial" },
    { slug: "terreno-condominio", label: "Terreno em Condomínio" },
  ],
  situations: [
    { slug: "disponivel", label: "Disponível" },
    { slug: "alugado", label: "Alugado" },
    { slug: "reservado", label: "Reservado" },
    { slug: "vendido", label: "Vendido" },
  ],
};

/** Lê o menu da home e soma o que achar aos termos já conhecidos. */
async function discoverTaxonomies() {
  let html = "";
  try {
    html = await getText(`${ORIGIN}/`);
  } catch (err) {
    console.warn(`  ! menu indisponível (${err.message}); usando os termos conhecidos.`);
  }

  const pick = (re, known) => {
    const out = new Map(known.map((term) => [term.slug, term]));
    for (const m of html.matchAll(re)) {
      const slug = m[1];
      if (out.has(slug)) continue;
      const label = decodeEntities(m[2] ?? "");
      out.set(slug, { slug, label: label || slug });
    }
    return [...out.values()];
  };

  return {
    cities: pick(/href="[^"]*\/local\/([a-z0-9-]+)\/?"[^>]*>([^<]*)</gi, KNOWN_TERMS.cities),
    types: pick(/href="[^"]*\/tipo-de-imovel\/([a-z0-9-]+)\/?"[^>]*>([^<]*)</gi, KNOWN_TERMS.types),
    situations: pick(/href="[^"]*\/situacao\/([a-z0-9-]+)\/?"[^>]*>([^<]*)</gi, KNOWN_TERMS.situations),
  };
}

/** Bairros são filhos de cidade: /local/<cidade>/<bairro>/ */
async function discoverNeighborhoods(citySlug) {
  const out = new Map();

  for (let page = 1; page <= 25; page++) {
    const url = page === 1 ? `${ORIGIN}/local/${citySlug}/` : `${ORIGIN}/local/${citySlug}/page/${page}/`;

    let html;
    try {
      html = await getText(url);
    } catch {
      break;
    }

    const re = new RegExp(`href="[^"]*\\/local\\/${citySlug}\\/([a-z0-9-]+)\\/?"[^>]*>([^<]*)<`, "gi");
    let matched = 0;
    for (const m of html.matchAll(re)) {
      matched++;
      if (m[1] === "page") continue;
      if (!out.has(m[1])) out.set(m[1], { slug: m[1], label: decodeEntities(m[2]) || m[1], city_slug: citySlug });
    }

    if (!/\/imoveis\//i.test(html) || matched === 0) break;
    await sleep(POLITE_DELAY);
  }

  return [...out.values()];
}

/**
 * Cidade a partir do endereço cadastrado.
 *
 * Nem todo imóvel tem a taxonomia `local` preenchida no WordPress — 16 dos 38
 * estão sem. O endereço, porém, cita a cidade, e esse é dado do próprio
 * registro.
 *
 * A busca é feita contra a lista fechada de cidades em que a imobiliária atua,
 * e não por um padrão genérico: os endereços misturam separadores ("Centro -
 * Arujá - SP", "Arujá-SP", "Arujá, SP") e um regex solto acabava capturando
 * "Jardim Imperial - Arujá" como se fosse o nome de uma cidade. Procurando
 * apenas o que existe, é impossível inventar cidade.
 */
function cityFromAddress(address = "") {
  if (!address) return null;

  const normalized = address
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  for (const city of KNOWN_TERMS.cities) {
    const needle = city.label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

    // \b nas bordas para "Suzano" não casar dentro de outra palavra.
    if (new RegExp(`\\b${needle.replace(/\s+/g, "\\s+")}\\b`).test(normalized)) {
      return city.label;
    }
  }

  return null;
}

/** Nome da cidade a partir do slug, quando o link pai não trouxe o rótulo. */
const CITY_BY_SLUG = {
  aruja: "Arujá",
  guarulhos: "Guarulhos",
  itaquaquecetuba: "Itaquaquecetuba",
  "mogi-das-cruzes": "Mogi das Cruzes",
  "santa-isabel": "Santa Isabel",
  suzano: "Suzano",
};

/** Taxonomia de tipo do WordPress -> slug de property_types do novo banco. */
const TYPE_MAP = {
  apartamento: "apartamento",
  "casa-bairro": "casa-bairro",
  "casa-condominios": "casa-condominio",
  "chacara-sitios": "chacara-sitio",
  comercial: "comercial",
  "imoveis-comerciais": "comercial",
  "galpao-industrial": "galpao-industrial",
  "industrial-terreno": "area-industrial",
  "imoveis-litoral": "imovel-litoral",
  "terreno-bairro": "terreno-bairro",
  "terreno-comercial": "terreno-comercial",
  "terreno-condominio": "terreno-condominio",
};

const STATUS_MAP = {
  disponivel: "disponivel",
  reservado: "reservado",
  vendido: "vendido",
  alugado: "alugado",
};

/* ------------------------------------------------------------- normalização */

function parseContent(html) {
  const highlights = [];
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(html)) !== null) {
    const text = stripTags(m[1]);
    if (text) highlights.push(text);
  }

  const withoutLists = html.replace(/<ul[\s\S]*?<\/ul>/gi, "").replace(/<ol[\s\S]*?<\/ol>/gi, "");
  const description = stripTags(withoutLists);

  return { description, highlights };
}

function normalize(raw, taxonomies) {
  const general = raw.cmb2?.property_general ?? {};
  const flags = raw.cmb2?.property_flags ?? {};
  const pricing = raw.cmb2?.property_pricing ?? {};
  const attrs = raw.cmb2?.property_attributes ?? {};
  const map = raw.cmb2?.property_map_location?.property_map_location ?? {};

  const { description, highlights } = parseContent(raw.content?.rendered ?? "");

  const gallery = Object.values(general.property_gallery ?? {})
    .filter(Boolean)
    .map((u) => u.replace(/^http:\/\//, "https://"));

  const cover = (general.property_slider_image || gallery[0] || "").replace(/^http:\/\//, "https://");
  // A capa vem primeiro e não se repete na galeria.
  const images = cover ? [cover, ...gallery.filter((u) => u !== cover)] : gallery;

  const address = decodeEntities(general.property_address ?? "");
  const condoMatch = address.match(/Condom[íi]nio\s+([^,]+)/i);

  const citySlug = taxonomies.citySlug ?? null;
  const city =
    taxonomies.city ??
    (citySlug ? CITY_BY_SLUG[citySlug] ?? null : null) ??
    cityFromAddress(address);

  const wpType = taxonomies.types.find((t) => TYPE_MAP[t.slug]);
  const statusFromTax = taxonomies.statusSlug ? STATUS_MAP[taxonomies.statusSlug] : null;
  const status = statusFromTax ?? (flags.property_sold === "on" ? "vendido" : "disponivel");

  return {
    legacy_id: String(raw.id),
    legacy_slug: raw.slug,
    legacy_url: raw.link,
    code: (general.property_id || "").trim() || `WP${raw.id}`,
    title: decodeEntities(raw.title?.rendered ?? ""),
    slug: raw.slug,
    purpose: general.property_contract === "RENT" ? "locacao" : "venda",
    type_slug: wpType ? TYPE_MAP[wpType.slug] : null,
    wp_types: taxonomies.types,
    status,
    price: toNumber(pricing.property_price),
    address,
    zip_code: (general.property_zip || "").trim() || null,
    city,
    city_slug: citySlug,
    neighborhood: taxonomies.neighborhood,
    neighborhood_slug: taxonomies.neighborhoodSlug,
    latitude: toNumber(map.latitude),
    longitude: toNumber(map.longitude),
    area_total: toNumber(attrs.property_lot_area),
    area_built: toNumber(attrs.property_home_area),
    bedrooms: toInt(attrs.property_beds),
    suites: null,
    bathrooms: toInt(attrs.property_baths),
    parking_spaces: toInt(attrs.property_garages),
    rooms: toInt(attrs.property_rooms),
    description,
    highlights,
    is_featured: flags.property_featured === "on",
    in_condo: Boolean(condoMatch) || /condominio/i.test(taxonomies.neighborhoodSlug ?? ""),
    condo_name: condoMatch ? decodeEntities(condoMatch[1]).trim() : null,
    images,
    created_at: raw.date_gmt ? `${raw.date_gmt}Z` : null,
    modified_at: raw.modified_gmt ? `${raw.modified_gmt}Z` : null,
  };
}

/* ----------------------------------------------------------------- imagens */

async function downloadImage(url, destDir, index, tries = 4) {
  const cleanName = decodeURIComponent(url.split("/").pop() ?? `${index}.jpg`).replace(/[^\w.-]+/g, "-");
  const fileName = `${String(index).padStart(2, "0")}-${cleanName}`;
  const dest = path.join(destDir, fileName);

  // Já baixado numa execução anterior: o script é retomável.
  try {
    const { size } = await stat(dest);
    if (size > 0) return { url, file: fileName, skipped: true };
  } catch {
    /* ainda não baixado */
  }

  for (let attempt = 1; attempt <= tries; attempt++) {
    await cooldownIfBlocked();

    try {
      const res = await request(url, { Referer: ORIGIN });
      // 404 é foto apagada do WordPress, não bloqueio: não adianta insistir
      // nem pausar, e não pode contar como falha de conexão.
      if (res.status === 404) {
        await res.body?.cancel();
        await sleep(POLITE_DELAY);
        const gone = new Error("HTTP 404 (foto não existe mais no site antigo)");
        gone.gone = true;
        throw gone;
      }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
      consecutiveFailures = 0;
      cooldownIndex = 0;
      await sleep(POLITE_DELAY);
      return { url, file: fileName, skipped: false };
    } catch (err) {
      await rm(dest, { force: true });
      if (err.gone) throw err;
      consecutiveFailures++;
      if (attempt === tries) throw err;
      // Recuo progressivo: o servidor precisa de fôlego entre as tentativas.
      await sleep(2000 * attempt);
    }
  }
}

/** Executa `worker` sobre `items` com no máximo `limit` em paralelo. */
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Baixa as fotos de todos os imóveis e anota em `image_files` os arquivos
 * que realmente chegaram ao disco. Pode ser reexecutado: o que já baixou
 * é pulado, então uma queda de conexão não obriga a começar do zero.
 */
async function downloadAll(properties) {
  const jobs = [];
  for (const p of properties) {
    const dir = path.join(IMG_DIR, p.code);
    p.images.forEach((url, index) => jobs.push({ code: p.code, dir, url, index }));
  }
  console.log(`Baixando ${jobs.length} imagens (${CONCURRENCY} por vez)...`);

  for (const code of new Set(properties.map((p) => p.code))) {
    await mkdir(path.join(IMG_DIR, code), { recursive: true });
  }

  let done = 0;
  let failed = 0;
  const files = new Map();
  const failures = [];

  await mapLimit(jobs, CONCURRENCY, async (job) => {
    try {
      const result = await downloadImage(job.url, job.dir, job.index);
      if (!files.has(job.code)) files.set(job.code, []);
      files.get(job.code)[job.index] = result.file;
    } catch (err) {
      failed++;
      failures.push({ code: job.code, url: job.url, error: String(err.message ?? err) });
    }
    done++;
    if (done % 10 === 0 || done === jobs.length) {
      process.stdout.write(`\r  ${done}/${jobs.length} (${failed} falhas)   `);
    }
  });
  console.log("");

  for (const p of properties) {
    p.image_files = (files.get(p.code) ?? []).filter(Boolean);
  }

  if (failures.length) {
    await writeFile(path.join(OUT_DIR, "image-failures.json"), JSON.stringify(failures, null, 2), "utf8");
    console.warn(`  ${failures.length} imagens falharam. Lista em data/image-failures.json — rode de novo para retomar.`);
  }

  return failures;
}

/* -------------------------------------------------------------------- main */

async function main() {
  // Retoma apenas o download das fotos, reaproveitando o properties.json
  // já extraído (as URLs vêm da REST API e não mudam).
  if (ONLY_IMAGES) {
    await mkdir(IMG_DIR, { recursive: true });
    const properties = JSON.parse(await readFile(path.join(OUT_DIR, "properties.json"), "utf8"));
    await downloadAll(properties);
    await writeFile(path.join(OUT_DIR, "properties.json"), JSON.stringify(properties, null, 2), "utf8");
    console.log("Fotos atualizadas em data/properties.json");
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(IMG_DIR, { recursive: true });

  console.log("Buscando imóveis na REST API do WordPress...");
  const rawProperties = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await getJSON(`${ORIGIN}/wp-json/wp/v2/property?per_page=100&page=${page}`);
    rawProperties.push(...batch);
    if (batch.length < 100) break;
  }
  console.log(`  ${rawProperties.length} imóveis encontrados.`);

  console.log("Descobrindo termos das taxonomias no menu do site...");
  const terms = await discoverTaxonomies();
  console.log(
    `  ${terms.cities.length} cidades, ${terms.types.length} tipos, ${terms.situations.length} situações.`
  );

  console.log("Mapeando imóveis por taxonomia (páginas de arquivo)...");
  /** slug do imóvel -> taxonomias atribuídas */
  const assigned = new Map(rawProperties.map((p) => [p.slug, {
    city: null, citySlug: null, neighborhood: null, neighborhoodSlug: null, types: [], statusSlug: null,
  }]));

  const neighborhoodTerms = [];

  for (const city of terms.cities) {
    const slugs = await collectArchive(`/local/${city.slug}/`);
    for (const slug of slugs) {
      const entry = assigned.get(slug);
      if (entry) {
        entry.citySlug = city.slug;
        entry.city = city.label;
      }
    }
    console.log(`  local/${city.slug}: ${slugs.length}`);

    if (slugs.length === 0) continue;

    for (const hood of await discoverNeighborhoods(city.slug)) {
      const hoodSlugs = await collectArchive(`/local/${city.slug}/${hood.slug}/`);
      if (hoodSlugs.length === 0) continue;
      neighborhoodTerms.push(hood);
      for (const slug of hoodSlugs) {
        const entry = assigned.get(slug);
        if (entry) {
          entry.neighborhoodSlug = hood.slug;
          entry.neighborhood = hood.label;
        }
      }
      console.log(`    ${hood.slug}: ${hoodSlugs.length}`);
    }
  }

  for (const type of terms.types) {
    const slugs = await collectArchive(`/tipo-de-imovel/${type.slug}/`);
    for (const slug of slugs) {
      assigned.get(slug)?.types.push(type);
    }
    if (slugs.length) console.log(`  tipo/${type.slug}: ${slugs.length}`);
  }

  for (const situation of terms.situations) {
    const slugs = await collectArchive(`/situacao/${situation.slug}/`);
    for (const slug of slugs) {
      const entry = assigned.get(slug);
      if (entry) entry.statusSlug = situation.slug;
    }
    if (slugs.length) console.log(`  situacao/${situation.slug}: ${slugs.length}`);
  }

  const properties = rawProperties.map((raw) => normalize(raw, assigned.get(raw.slug)));

  // Conferência: códigos duplicados quebrariam a chave única do novo banco.
  const byCode = new Map();
  for (const p of properties) {
    if (byCode.has(p.code)) {
      console.warn(`  ! código repetido ${p.code}: ${p.slug} e ${byCode.get(p.code).slug}`);
      p.code = `${p.code}-${p.legacy_id}`;
    }
    byCode.set(p.code, p);
  }

  if (!SKIP_IMAGES) await downloadAll(properties);

  const countBy = (predicate) => properties.filter(predicate).length;

  const taxonomies = {
    cities: terms.cities
      .map((c) => ({ ...c, count: countBy((p) => p.city_slug === c.slug) }))
      .filter((c) => c.count > 0),
    neighborhoods: neighborhoodTerms.map((h) => ({
      ...h,
      count: countBy((p) => p.neighborhood_slug === h.slug),
    })),
    types: terms.types
      .map((t) => ({ ...t, mapped_to: TYPE_MAP[t.slug] ?? null, count: countBy((p) => p.wp_types.some((x) => x.slug === t.slug)) }))
      .filter((t) => t.count > 0),
    situations: terms.situations
      .map((s) => ({ ...s, count: countBy((p) => p.status === (STATUS_MAP[s.slug] ?? s.slug)) }))
      .filter((s) => s.count > 0),
  };

  await writeFile(path.join(OUT_DIR, "properties.json"), JSON.stringify(properties, null, 2), "utf8");
  await writeFile(path.join(OUT_DIR, "taxonomies.json"), JSON.stringify(taxonomies, null, 2), "utf8");

  const baixadas = properties.reduce((s, p) => s + (p.image_files?.length ?? 0), 0);

  console.log("\nResumo");
  console.log(`  imóveis          ${properties.length}`);
  console.log(`  destaques        ${countBy((p) => p.is_featured)}`);
  console.log(`  cidades          ${taxonomies.cities.map((c) => `${c.label} (${c.count})`).join(", ")}`);
  console.log(`  bairros/regiões  ${taxonomies.neighborhoods.length}`);
  console.log(`  situações        ${taxonomies.situations.map((s) => `${s.label} (${s.count})`).join(", ")}`);
  console.log(`  imagens          ${properties.reduce((s, p) => s + p.images.length, 0)} (${baixadas} no disco)`);
  console.log("\nPendências a conferir antes de importar");
  console.log(`  sem tipo         ${countBy((p) => !p.type_slug)}`);
  console.log(`  sem cidade       ${countBy((p) => !p.city)}`);
  console.log(`  sem bairro       ${countBy((p) => !p.neighborhood)}`);
  console.log(`  sem preço        ${countBy((p) => !p.price)}`);
  console.log(`  sem foto         ${countBy((p) => !p.images.length)}`);
  console.log(`\nArquivos em ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
