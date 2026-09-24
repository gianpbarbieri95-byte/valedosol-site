import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requiredEnv } from "./env";

/**
 * Cliente Supabase para Server Components, Route Handlers e Server Actions.
 * Usa a chave anônima: toda a autorização continua sendo decidida pela RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component não pode escrever cookie. O middleware já cuida
          // da renovação da sessão, então aqui o erro é esperado e inofensivo.
        }
      },
    },
  });
}
