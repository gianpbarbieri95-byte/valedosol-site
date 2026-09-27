/**
 * Verificação da instalação: confere se o banco respondeu à migração e, acima
 * de tudo, se a RLS está realmente isolando o que precisa ser isolado.
 *
 *   node scripts/verifica-instalacao.mjs
 *
 * Grava e apaga registros de teste. Rode à vontade — não deixa resíduo.
 */

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const raw = await readFile(".env.local", "utf8");
const get = (k) => (raw.match(new RegExp(`^\s*${k}\s*=\s*(.*?)\s*$`, "m")) ?? [])[1]?.replace(/^["']|["']$/g, "") ?? "";

const URL_BASE = get("NEXT_PUBLIC_SUPABASE_URL");
const anon = createClient(URL_BASE, get("NEXT_PUBLIC_SUPABASE_ANON_KEY"), { auth: { persistSession: false } });
const admin = createClient(URL_BASE, get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

let falhas = 0;
const marca = (ok, texto) => {
  if (!ok) falhas++;
  console.log(`  ${ok ? "OK   " : "FALHA"} ${texto}`);
};

console.log("TESTE DE ISOLAMENTO — dado real gravado, anônimo tenta ler\n");

// 1. Lead sigiloso
const { data: lead, error: e1 } = await admin
  .from("leads")
  .insert({ name: "TESTE RLS", phone: "11900000000", message: "sigiloso", source: "teste_rls" })
  .select("id")
  .single();

if (e1) {
  console.log("  não consegui inserir o lead de teste:", e1.message);
} else {
  const { data: visto } = await anon.from("leads").select("id, name").eq("id", lead.id);
  marca((visto ?? []).length === 0, `lead gravado (service role vê), anônimo enxerga ${visto?.length ?? 0} — esperado 0`);

  const { error: eUpd } = await anon.from("leads").update({ name: "invadido" }).eq("id", lead.id);
  const { data: conf } = await admin.from("leads").select("name").eq("id", lead.id).single();
  marca(conf.name === "TESTE RLS", `anônimo tentou alterar o lead: ${eUpd ? "recusado" : "sem erro"}, nome continua "${conf.name}"`);

  await admin.from("leads").delete().eq("id", lead.id);
}

// 2. Imóvel em rascunho não pode vazar
const { data: draft, error: e2 } = await admin
  .from("properties")
  .insert({ title: "Rascunho de teste", slug: "rascunho-de-teste-rls", code: "TESTE-RLS", publication_state: "draft" })
  .select("id")
  .single();

if (e2) {
  console.log("  não consegui inserir o rascunho:", e2.message);
} else {
  const { data: vistoDraft } = await anon.from("properties").select("id").eq("id", draft.id);
  marca((vistoDraft ?? []).length === 0, `imóvel em rascunho: anônimo enxerga ${vistoDraft?.length ?? 0} — esperado 0`);

  // Publicado, o mesmo imóvel passa a aparecer
  await admin.from("properties").update({ publication_state: "published" }).eq("id", draft.id);
  const { data: vistoPub } = await anon.from("properties").select("id").eq("id", draft.id);
  marca((vistoPub ?? []).length === 1, `depois de publicar: anônimo enxerga ${vistoPub?.length ?? 0} — esperado 1`);

  await admin.from("properties").delete().eq("id", draft.id);
}

// 3. Configuração marcada como privada não vaza
const { error: e3 } = await admin
  .from("site_settings")
  .upsert({ key: "teste_privado", value: { segredo: "nao-pode-aparecer" }, is_public: false });

if (!e3) {
  const { data: vistoCfg } = await anon.from("site_settings").select("key").eq("key", "teste_privado");
  marca((vistoCfg ?? []).length === 0, `configuração privada: anônimo enxerga ${vistoCfg?.length ?? 0} — esperado 0`);
  await admin.from("site_settings").delete().eq("key", "teste_privado");
}

// 4. Bucket privado não é servido publicamente
const teste = new Blob(["conteudo sigiloso"], { type: "text/plain" });
await admin.storage.from("lead-uploads").upload("teste-rls.txt", teste, { upsert: true });
const publico = `${URL_BASE}/storage/v1/object/public/lead-uploads/teste-rls.txt`;
const res = await fetch(publico);
marca(!res.ok, `bucket lead-uploads pela URL pública: HTTP ${res.status} — esperado erro`);
await admin.storage.from("lead-uploads").remove(["teste-rls.txt"]);

// 5. CRM e portais (migration 0005): nada disso é visível ao anônimo
const { data: cliente, error: e5 } = await admin
  .from("clients")
  .insert({ name: "TESTE RLS", phone: "11900000000" })
  .select("id")
  .single();

if (e5) {
  console.log("  CRM não verificado (migration 0005 aplicada?):", e5.message);
} else {
  const { data: vistoCli } = await anon.from("clients").select("id").eq("id", cliente.id);
  marca((vistoCli ?? []).length === 0, `cliente do CRM: anônimo enxerga ${vistoCli?.length ?? 0} — esperado 0`);

  const { error: eIns } = await anon.from("clients").insert({ name: "Invasor", phone: "11911111111" });
  marca(Boolean(eIns), `anônimo tentou cadastrar cliente: ${eIns ? "recusado" : "ACEITO"}`);

  const { data: tokens } = await anon.from("portal_settings").select("feed_token");
  marca((tokens ?? []).length === 0, `token dos XMLs dos portais: anônimo enxerga ${tokens?.length ?? 0} — esperado 0`);

  await admin.from("clients").delete().eq("id", cliente.id);
}

console.log(falhas === 0 ? "\nIsolamento confirmado: nenhuma falha." : `\n${falhas} FALHA(S) DE SEGURANÇA.`);
