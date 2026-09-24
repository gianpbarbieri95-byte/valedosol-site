import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requiredEnv } from "./env";

/**
 * Cliente com service role. Ignora RLS — use somente onde isso é necessário
 * e o acesso já foi verificado:
 *
 *   - gravação de leads vindos dos formulários públicos (anon não escreve);
 *   - upload de anexos no bucket privado lead-uploads.
 *
 * O `import "server-only"` faz o build quebrar se alguém importar este
 * arquivo a partir de um Client Component.
 */
export function createAdminClient() {
  return createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
