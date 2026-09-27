import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import type { Profile, UserRole } from "@/types/database";

/**
 * Sessão administrativa.
 *
 * O proxy (proxy.ts) já barra o painel sem sessão, mas ele é só a primeira
 * camada. Toda página e toda ação administrativa chamam uma destas funções,
 * e a RLS confere de novo no banco. Três camadas, porque uma só não basta.
 */

export interface AdminSession {
  userId: string;
  email: string;
  profile: Profile;
}

/**
 * Sessão atual, ou null. `getUser()` valida o token no servidor do Supabase —
 * `getSession()` apenas lê o cookie e por isso não serve para autorizar.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  // Usuário autenticado sem perfil não é equipe: não entra no painel.
  if (!profile) return null;

  return { userId: user.id, email: user.email ?? profile.email, profile: profile as Profile };
});

/** Exige sessão de equipe (admin ou editor). Redireciona para o login. */
export async function requireStaff(nextPath = "/dashboard"): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return session;
}

/** Exige papel de administrador. Editor recebe 'sem permissão'. */
export async function requireAdmin(nextPath = "/dashboard"): Promise<AdminSession> {
  const session = await requireStaff(nextPath);
  if (session.profile.role !== "admin") redirect("/dashboard?erro=sem-permissao");
  return session;
}

export function hasRole(session: AdminSession | null, ...roles: UserRole[]): boolean {
  return Boolean(session && roles.includes(session.profile.role));
}
