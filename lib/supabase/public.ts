import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requiredEnv } from "./env";

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
      global: { headers: { "x-client-info": "valedosol-site" } },
    }
  );
}

export { isSupabaseConfigured, storageUrl } from "./env";
