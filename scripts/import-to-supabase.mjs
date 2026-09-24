/**
 * Importa o acervo extraído do WordPress para o Supabase.
 *
 *   node scripts/import-to-supabase.mjs --dry-run     simula e não grava nada
 *   node scripts/import-to-supabase.mjs --confirm     grava de verdade
 *
 * É idempotente: cada imóvel é identificado por legacy_id, então rodar duas
 * vezes atualiza em vez de duplicar. Nada é apagado — imóveis criados à mão
 * no painel não são tocados.
 *
 * Os imóveis entram como RASCUNHO. Publicar é decisão de quem revisar.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DATA_DIR = path.resolve("data");
const IMG_DIR = path.join(DATA_DIR, "images");
const BUCKET = "property-images";

const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has("--confirm");
const SKIP_IMAGES = args.has("--no-images");
const PUBLISH = args.has("--publicar");

/* ------------------------------------------------------------- ambiente */

async function loadEnv() {
  try {
    const raw = await readFile(path.resolve(".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (value && !process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    /* sem .env.local: as variáveis podem vir do ambiente */
  }
}

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

function slugify(value = "") {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ----------------------------------------------------------------- main */

async function main() {
  await loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Preencha o .env.local antes de importar."
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const properties = JSON.parse(await readFile(path.join(DATA_DIR, "properties.json"), "utf8"));
  const taxonomies = JSON.parse(await readFile(path.join(DATA_DIR, "taxonomies.json"), "utf8"));

  console.log(`${properties.length} imóveis no arquivo de extração.`);
  if (DRY_RUN) {
    console.log("\n*** SIMULAÇÃO — nada será gravado. Use --confirm para valer. ***\n");
  }

  /* ---------------------------------------------------- tipos de imóvel */

  const { data: typeRows, error: typeError } = await supabase.from("property_types").select("id, slug");
  if (typeError) throw new Error(`Não foi possível ler property_types: ${typeError.message}`);

  const typeBySlug = new Map((typeRows ?? []).map((row) => [row.slug, row.id]));
  console.log(`${typeBySlug.size} tipos de imóvel cadastrados no banco.`);

  const semTipo = properties.filter((p) => p.type_slug && !typeBySlug.has(p.type_slug));
  if (semTipo.length) {
    console.warn(
      `  ! ${semTipo.length} imóveis apontam para tipos que não existem no banco: ` +
        [...new Set(semTipo.map((p) => p.type_slug))].join(", ")
    );
  }

  /* ----------------------------------------------------------- regiões */
  // Cada bairro encontrado no site antigo vira uma região, sem descrição:
  // o texto de cada uma é trabalho editorial da imobiliária, não nosso.

  const regionBySlug = new Map();
  const { data: existingRegions } = await supabase.from("regions").select("id, slug");
  for (const row of existingRegions ?? []) regionBySlug.set(row.slug, row.id);

  const neighborhoods = taxonomies.neighborhoods ?? [];
  let regionsCreated = 0;

  // O bairro só guarda o slug da cidade ("aruja"). O nome com acento vem da
  // lista de cidades — capitalizar o slug produziria "Aruja" e a região
  // deixaria de casar com o campo `city` dos imóveis.
  const cityLabelBySlug = new Map(
    (taxonomies.cities ?? []).map((city) => [city.slug, city.label ?? city.name ?? city.slug])
  );

  for (const [index, hood] of neighborhoods.entries()) {
    if (regionBySlug.has(hood.slug)) continue;

    const citySlug = hood.city_slug ?? "aruja";
    const city = hood.city ?? cityLabelBySlug.get(citySlug) ?? "Arujá";
    const payload = {
      name: hood.label ?? hood.name ?? hood.slug,
      slug: hood.slug,
      city,
      sort_order: index * 10,
      active: true,
    };

    if (DRY_RUN) {
      console.log(`  + região ${payload.slug} (${payload.city})`);
      regionsCreated++;
      continue;
    }

    const { data, error } = await supabase.from("regions").insert(payload).select("id").single();
    if (error) {
      console.warn(`  ! região ${payload.slug}: ${error.message}`);
      continue;
    }
    regionBySlug.set(hood.slug, data.id);
    regionsCreated++;
  }
  console.log(`${regionsCreated} regiões criadas.`);

  /* ---------------------------------------------------------- imóveis */

  const { data: existingProperties } = await supabase
    .from("properties")
    .select("id, legacy_id, slug, code");

  const byLegacy = new Map(
    (existingProperties ?? []).filter((row) => row.legacy_id).map((row) => [row.legacy_id, row])
  );

  let created = 0;
  let updated = 0;
  let imagesUploaded = 0;
  const problems = [];

  for (const property of properties) {
    const payload = {
      title: property.title,
      slug: property.slug,
      code: property.code,
      purpose: property.purpose ?? "venda",
      property_type_id: property.type_slug ? (typeBySlug.get(property.type_slug) ?? null) : null,
      status: property.status ?? "disponivel",
      // Entram como rascunho: alguém da Vale do Sol confere antes de publicar.
      publication_state: PUBLISH ? "published" : "draft",
      price: property.price ?? null,
      price_on_request: !property.price,
      city: property.city ?? "Arujá",
      neighborhood: property.neighborhood ?? null,
      address: property.address ?? null,
      zip_code: property.zip_code ?? null,
      region_id: property.neighborhood_slug ? (regionBySlug.get(property.neighborhood_slug) ?? null) : null,
      latitude: property.latitude ?? null,
      longitude: property.longitude ?? null,
      area_total: property.area_total ?? null,
      area_built: property.area_built ?? null,
      bedrooms: property.bedrooms ?? null,
      suites: property.suites ?? null,
      bathrooms: property.bathrooms ?? null,
      parking_spaces: property.parking_spaces ?? null,
      description: property.description || null,
      highlights: property.highlights ?? [],
      is_featured: Boolean(property.is_featured),
      in_condo: Boolean(property.in_condo),
      condo_name: property.condo_name ?? null,
      legacy_source: "wordpress",
      legacy_id: property.legacy_id,
    };

    const existing = byLegacy.get(property.legacy_id);

    if (DRY_RUN) {
      console.log(
        `  ${existing ? "~" : "+"} ${payload.code.padEnd(10)} ${payload.title.slice(0, 48).padEnd(50)} ` +
          `${payload.city}/${payload.neighborhood ?? "—"} ${payload.property_type_id ? "" : "[sem tipo]"}`
      );
      existing ? updated++ : created++;
      continue;
    }

    let propertyId;

    if (existing) {
      const { error } = await supabase.from("properties").update(payload).eq("id", existing.id);
      if (error) {
        problems.push(`${payload.code}: ${error.message}`);
        continue;
      }
      propertyId = existing.id;
      updated++;
    } else {
      const { data, error } = await supabase.from("properties").insert(payload).select("id").single();
      if (error) {
        problems.push(`${payload.code}: ${error.message}`);
        continue;
      }
      propertyId = data.id;
      created++;
    }

    if (!SKIP_IMAGES) {
      imagesUploaded += await syncImages(supabase, propertyId, property);
    }

    process.stdout.write(`\r  ${created + updated}/${properties.length} imóveis   `);
  }

  console.log("");
  console.log("\nResultado");
  console.log(`  criados     ${created}`);
  console.log(`  atualizados ${updated}`);
  if (!SKIP_IMAGES) console.log(`  fotos enviadas ${imagesUploaded}`);

  if (problems.length) {
    console.log("\nProblemas");
    for (const problem of problems) console.log(`  ! ${problem}`);
  }

  if (DRY_RUN) {
    console.log("\nNada foi gravado. Rode com --confirm para importar de verdade.");
  } else {
    console.log(
      PUBLISH
        ? "\nImóveis importados e publicados."
        : "\nImóveis importados como RASCUNHO. Revise no painel e publique um a um, ou rode com --publicar."
    );
  }
}

/** Envia as fotos que ainda não estão no Storage e registra as que faltam. */
async function syncImages(supabase, propertyId, property) {
  const folder = path.join(IMG_DIR, property.code);

  let files;
  try {
    files = (await readdir(folder)).filter((name) => MIME[path.extname(name).toLowerCase()]).sort();
  } catch {
    return 0; // pasta não existe: imóvel sem foto baixada
  }

  if (!files.length) return 0;

  const { data: existingImages } = await supabase
    .from("property_images")
    .select("id, storage_path")
    .eq("property_id", propertyId);

  const alreadyThere = new Set((existingImages ?? []).map((row) => row.storage_path));
  const rows = [];
  let uploaded = 0;

  for (const [index, file] of files.entries()) {
    const storagePath = `${slugify(property.code)}/${file}`;
    if (alreadyThere.has(storagePath)) continue;

    const absolute = path.join(folder, file);
    const info = await stat(absolute);
    if (info.size === 0) continue;

    const buffer = await readFile(absolute);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: MIME[path.extname(file).toLowerCase()],
        upsert: true,
      });

    if (error) {
      console.warn(`\n  ! foto ${storagePath}: ${error.message}`);
      continue;
    }

    rows.push({
      property_id: propertyId,
      storage_path: storagePath,
      alt_text: `${property.title} — foto ${index + 1}`,
      sort_order: index,
      // A primeira foto da pasta é a capa que o site antigo usava.
      is_cover: index === 0 && (existingImages ?? []).length === 0,
    });
    uploaded++;
  }

  if (rows.length) {
    const { error } = await supabase.from("property_images").insert(rows);
    if (error) console.warn(`\n  ! registros de foto de ${property.code}: ${error.message}`);
  }

  return uploaded;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
