"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import type { FormState } from "@/lib/validations/lead";

const credentialsSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido"),
  password: z.string().min(6, "A senha precisa ter ao menos 6 caracteres"),
  next: z.string().trim().optional(),
});

/**
 * Login do painel.
 *
 * A mensagem de erro é sempre a mesma, tanto para e-mail inexistente quanto
 * para senha errada: dizer qual dos dois falhou entrega quais e-mails têm
 * conta no sistema.
 */
export async function signIn(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) {
    return {
      status: "error",
      message: "O projeto ainda não está conectado ao Supabase. Preencha o .env.local.",
    };
  }

  const requestHeaders = await headers();
  const { allowed, retryAfterSeconds } = rateLimit(clientKey(requestHeaders, "login"), 8, 10 * 60 * 1000);

  if (!allowed) {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return {
      status: "error",
      message: `Muitas tentativas. Aguarde ${minutes} minuto${minutes > 1 ? "s" : ""} e tente de novo.`,
    };
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    // Sem o campo oculto (login aberto direto, sem ?next=), o FormData
    // devolve null, e o zod recusava o login inteiro por causa disso.
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    // Só os nomes dos campos que falharam — nunca o valor digitado.
    console.warn("[login] validação recusou:", parsed.error.issues.map((issue) => issue.path.join(".")).join(", "));
    return { status: "error", message: "Confira o e-mail e a senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // O visitante vê sempre a mesma frase; o motivo real fica no log do
    // servidor (código do Supabase, sem senha e sem e-mail) para diagnóstico.
    console.warn("[login] Supabase recusou:", error.code ?? "sem-código", error.status ?? "", error.message);
    return { status: "error", message: "E-mail ou senha incorretos." };
  }

  // Entrou pelo Auth, mas quem é equipe é quem tem perfil. Sem perfil,
  // a sessão é encerrada na hora.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  if (!profile) {
    console.warn("[login] autenticou, mas sem perfil de equipe");
    await supabase.auth.signOut();
    return {
      status: "error",
      message: "Esta conta não tem acesso ao painel. Fale com o administrador.",
    };
  }

  const destination =
    parsed.data.next && parsed.data.next.startsWith("/admin") ? parsed.data.next : "/admin/dashboard";

  revalidatePath("/admin", "layout");
  redirect(destination);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/admin", "layout");
  redirect("/admin/login");
}
