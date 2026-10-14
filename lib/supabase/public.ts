import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requiredEnv } from "./env";

/**
 * Tag do cache de dados das páginas públicas. As ações do painel chamam
 * updateTag(PUBLIC_DATA_TAG) ao salvar, então o site reflete a mudança na hora.
 */
export const PUBLIC_DATA_TAG = "site-data";

/**
 * Por quanto tempo (s) a Vercel guarda cada leitura pública. Sem isso, a
 * listagem com filtros (/imoveis?…) e as regiões consultavam o Supabase a cada
 * visita, e cada consulta vira linha de log cobrada no plano (Log Ingestion).
 * Uma hora basta: o painel limpa a tag ao salvar.
 */
const PUBLIC_DATA_TTL = 3600;

const cachedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, next: { revalidate: PUBLIC_DATA_TTL, tags: [PUBLIC_DATA_TAG] } });

/**
 * Cliente somente-leitura para as páginas públicas.
 *
 * Diferente de lib/supabase/server.ts, este não toca em cookies(). Isso é
 * proposital: ler cookies marcaria a rota como dinâmica e a Home, a listagem
 * e as páginas de imóvel perderiam a renderização estática com ISR.
 *
 * Como usa a chave anônima, continua limitado pela RLS: só enxerga imóvel
 * publicado e conteúdo marcado como público.
 */
export function createPublicClient() {
  return createSupabaseClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-client-info": "valedosol-site" }, fetch: cachedFetch },
    }
  );
}

export { isSupabaseConfigured, storageUrl } from "./env";
