import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SITE } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar no painel",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex justify-center">
          <Image src="/brand/logo.png" alt={SITE.name} width={250} height={249} className="h-20 w-auto" priority />
        </Link>

        <div className="mt-8 rounded-[var(--radius-md)] border border-line bg-surface p-7 shadow-subtle">
          <h1 className="text-2xl">Área restrita</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Entre para gerenciar os imóveis do site.
          </p>

          {configured ? (
            <div className="mt-7">
              <LoginForm next={next} />
            </div>
          ) : (
            <p className="mt-6 rounded-[var(--radius-sm)] border border-gold/30 bg-gold-soft px-4 py-3 text-sm text-[#7a5a10]">
              Configuração pendente: preencha <code>.env.local</code> com as chaves do Supabase para
              habilitar o login.
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/" className="transition-colors hover:text-ink-soft">
            Voltar ao site
          </Link>
        </p>
      </div>
    </main>
  );
}
