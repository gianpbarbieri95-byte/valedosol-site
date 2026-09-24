/**
 * Regenera supabase/setup-completo.sql a partir das migrations numeradas.
 * Rode sempre que criar ou alterar uma migration.
 *
 *   node scripts/build-setup-sql.mjs
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.resolve("supabase/migrations");
const OUT = path.resolve("supabase/setup-completo.sql");

const HEADER = `-- =============================================================================
-- Vale do Sol Imóveis — instalação completa do banco
--
-- Este arquivo é a CONCATENAÇÃO das migrations de supabase/migrations/, na
-- ordem correta, para ser colado de uma vez no SQL Editor do Supabase na
-- primeira instalação. A fonte da verdade continua sendo os arquivos
-- numerados; gere este aqui de novo se eles mudarem:
--
--   node scripts/build-setup-sql.mjs
--
-- É seguro rodar mais de uma vez: tudo usa "if not exists", "on conflict do
-- nothing" ou "create or replace". Nada é apagado.
-- =============================================================================
`;

const files = (await readdir(DIR)).filter((name) => /^\d+_.*\.sql$/.test(name)).sort();

const parts = [HEADER];
for (const file of files) {
  const divider = "-- " + "=".repeat(73);
  parts.push(`\n${divider}\n-- ${file}\n${divider}\n`);
  parts.push(await readFile(path.join(DIR, file), "utf8"));
}

await writeFile(OUT, parts.join("\n"), "utf8");
console.log(`${OUT} gerado a partir de ${files.length} migrations: ${files.join(", ")}`);
