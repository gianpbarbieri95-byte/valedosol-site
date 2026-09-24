"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase do navegador. Só enxerga a chave anônima — nunca a
 * service role. Usado por favoritos, login e upload no admin.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
