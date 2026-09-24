/**
 * Helpers de ambiente e de URL do Storage.
 *
 * Este arquivo é propositalmente neutro: não importa next/headers nem o SDK
 * do Supabase, então pode ser usado por Server Components e por Client
 * Components sem arrastar código de servidor para o bundle do navegador.
 */

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente ${name} não definida. Copie .env.example para .env.local e preencha.`
    );
  }
  return value;
}

/** Indica se o projeto já foi conectado a um Supabase. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** URL pública de um arquivo no Storage, sem precisar de uma chamada extra. */
export function storageUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;

  return `${base}/storage/v1/object/public/${bucket}/${path.replace(/^\/+/, "")}`;
}
