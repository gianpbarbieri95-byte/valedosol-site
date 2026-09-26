"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { requireStaff } from "@/lib/auth";
import { SITE } from "@/lib/site";
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

/* --------------------------------------------------------- senha esquecida */

const resetRequestSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido"),
});

/**
 * Endereço do próprio site que recebeu o pedido. O link do e-mail precisa
 * voltar para o mesmo domínio (o da Vercel durante a aprovação, o oficial
 * depois) — e o Supabase só aceita os que estão na lista de Redirect URLs.
 */
function requestOrigin(requestHeaders: Headers): string {
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return SITE.url;
  const protocol =
    requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${protocol}://${host}`;
}

/**
 * Envia o link para criar uma senha nova.
 *
 * A resposta é a mesma exista ou não o e-mail: dizer "não encontrado"
 * entregaria quais endereços têm conta no painel.
 */
export async function requestPasswordReset(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "O projeto ainda não está conectado ao Supabase." };
  }

  const requestHeaders = await headers();
  const { allowed, retryAfterSeconds } = rateLimit(clientKey(requestHeaders, "reset"), 4, 15 * 60 * 1000);
  if (!allowed) {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return {
      status: "error",
      message: `Muitos pedidos seguidos. Aguarde ${minutes} minuto${minutes > 1 ? "s" : ""} e tente de novo.`,
    };
  }

  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: "Informe um e-mail válido.", errors: { email: "Informe um e-mail válido" } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${requestOrigin(requestHeaders)}/admin/auth/confirmar?next=/admin/nova-senha`,
  });

  if (error) {
    console.warn("[senha] Supabase recusou o envio:", error.code ?? "sem-código", error.status ?? "", error.message);
    if (error.status === 429) {
      return { status: "error", message: "Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo." };
    }
  }

  return {
    status: "success",
    message:
      "Se esse e-mail tiver acesso ao painel, enviamos um link para criar uma senha nova. Confira a caixa de entrada e o spam, e abra o link neste mesmo aparelho.",
  };
}

/* ------------------------------------------------------------ senha nova */

const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Use ao menos 8 caracteres").max(72, "Use no máximo 72 caracteres"),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "As duas senhas não são iguais",
    path: ["confirm"],
  });

/** Grava a senha nova de quem está logado (pelo link do e-mail ou pelo painel). */
export async function updatePassword(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireStaff("/admin/nova-senha");

  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "error", message: "Confira a senha nova.", errors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    console.warn("[senha] troca recusada:", error.code ?? "sem-código", error.status ?? "");
    const message =
      error.code === "same_password"
        ? "A senha nova precisa ser diferente da atual."
        : error.code === "weak_password"
          ? "Senha fraca demais. Misture letras, números e símbolos."
          : error.code === "reauthentication_needed"
            ? "Por segurança, saia e entre de novo antes de trocar a senha."
            : "Não foi possível trocar a senha agora. Tente de novo em instantes.";
    return { status: "error", message };
  }

  revalidatePath("/admin", "layout");
  redirect("/admin/dashboard?senha=alterada");
}
