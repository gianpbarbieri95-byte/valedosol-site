import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SITE } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar no painel",
  robots: { index: false, follow: false },
};

/**
 * Paisagem da marca — o mesmo sol e as mesmas colinas do filme
 * institucional, desenhados aqui em SVG para não depender de foto nem
 * carregar o pôster (que já traz texto próprio).
 */
function Landscape({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 260"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M0 120 C 180 88 360 70 520 74 S 720 96 800 84 V260 H0Z" fill="#0f4a27" />
      <path d="M0 120 C 180 88 360 70 520 74 S 720 96 800 84" fill="none" stroke="#d3a33f" strokeWidth="1.5" opacity="0.8" vectorEffect="non-scaling-stroke" />
      <path d="M0 176 C 220 150 420 146 600 160 S 760 176 800 170 V260 H0Z" fill="#0b3d20" />
      <path d="M0 224 C 240 206 480 202 800 214 V260 H0Z" fill="#072d17" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const { next, erro } = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <main className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Marca: faixa curta no celular, painel inteiro ao lado no desktop */}
      <section
        aria-label={SITE.name}
        className="relative isolate overflow-hidden bg-primary-deep text-white lg:sticky lg:top-0 lg:h-dvh"
      >
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_85%_0%,#123f25_0%,#072d17_55%,#05210f_100%)]"
        />
        {/* Sol */}
        <div
          aria-hidden
          className="absolute -z-10 right-[12%] top-[18%] size-14 rounded-full bg-[radial-gradient(circle_at_40%_35%,#fbe9b7,#d3a33f_60%,#b98a2c)] shadow-[0_0_80px_30px_rgb(211_163_63/0.22)] lg:right-[16%] lg:top-[14%] lg:size-24"
        />
        <Landscape className="absolute inset-x-0 bottom-0 -z-10 h-24 w-full lg:h-[38%]" />

        <div className="flex h-full flex-col px-5 pb-14 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 lg:px-14 lg:pb-12 lg:pt-12 xl:px-20">
          <div className="flex items-center justify-between gap-4">
            <Link
              href={SITE.url}
              className="inline-flex rounded-[var(--radius-md)] bg-white p-1.5 shadow-float transition-transform duration-300 hover:-translate-y-0.5"
            >
              <Image
                src="/brand/logo.png"
                alt={SITE.name}
                width={250}
                height={249}
                unoptimized
                priority
                className="size-14 lg:size-20"
              />
            </Link>
            <Link
              href={SITE.url}
              className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] px-3 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronLeftIcon className="size-4" />
              Ver o site
            </Link>
          </div>

          <div className="mt-6 max-w-lg lg:mt-auto lg:mb-[34%]">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-gold-bright">
              Painel da equipe
            </p>
            <p className="mt-2 font-display text-[1.75rem] leading-[1.08] tracking-[-0.01em] lining-nums lg:mt-5 lg:text-[3.25rem]">
              Os imóveis da Vale do Sol, <span className="text-gold-bright">em um só lugar.</span>
            </p>
            <ul className="mt-8 hidden space-y-3 text-[0.9375rem] text-white/75 lg:block">
              {[
                "Cadastre e publique imóveis com fotos",
                "Acompanhe os contatos que chegam pelo site",
                "Funciona no computador e no celular",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span aria-hidden className="h-px w-5 bg-gold-bright/70" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="hidden text-xs tracking-[0.08em] text-white/55 lg:block">
            {SITE.creci} · Arujá-SP · Desde 1975
          </p>
        </div>
      </section>

      {/* Formulário */}
      <section className="relative -mt-6 flex justify-center rounded-t-[1rem] bg-canvas px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-9 sm:px-8 lg:mt-0 lg:items-center lg:rounded-none lg:px-12 lg:py-16">
        <div className="w-full max-w-[26rem]">
          <h1 className="text-title lining-nums">Entrar no painel</h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
            Use o e-mail e a senha cadastrados para a equipe.
          </p>

          {erro === "link" ? (
            <p
              role="alert"
              className="mt-6 rounded-[var(--radius-sm)] border border-gold/30 bg-gold-soft px-4 py-3 text-sm leading-relaxed text-[#7a5a10]"
            >
              O link para criar a senha nova venceu, já foi usado ou foi aberto em outro navegador.{" "}
              <Link href="/esqueci-senha" className="font-medium underline underline-offset-4">
                Peça um link novo
              </Link>{" "}
              e abra-o neste mesmo aparelho.
            </p>
          ) : null}

          {configured ? (
            <div className="mt-8">
              <LoginForm next={next} />
            </div>
          ) : (
            <p className="mt-8 rounded-[var(--radius-sm)] border border-gold/30 bg-gold-soft px-4 py-3 text-sm text-[#7a5a10]">
              Configuração pendente: preencha <code>.env.local</code> com as chaves do Supabase para
              habilitar o login.
            </p>
          )}

          <div className="mt-10 border-t border-line pt-6 text-sm leading-relaxed text-muted">
            <p>
              <span className="font-medium text-ink-soft">Primeiro acesso ou sem conta?</span> Peça ao
              administrador do painel para cadastrar o seu e-mail.
            </p>
          </div>

          <p className="mt-8 text-center text-xs tracking-[0.06em] text-muted lg:hidden">
            {SITE.creci} · Arujá-SP · Desde 1975
          </p>
        </div>
      </section>
    </main>
  );
}
