import type { Metadata } from "next";
import Link from "next/link";

import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import { getSettings } from "@/lib/queries/settings";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { ArrowRightIcon } from "@/components/ui/icons";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "A imobiliária",
  description:
    "Fundada em 1975 em Arujá por Leonardo Barbieri, a Vale do Sol é conduzida hoje pela segunda geração da família Barbieri.",
  alternates: { canonical: "/a-imobiliaria" },
};

/** Texto de configuração em parágrafos: linha em branco separa um do outro. */
function paragrafos(texto: string): string[] {
  return texto.split(/\n{2,}/).map((bloco) => bloco.trim()).filter(Boolean);
}

/**
 * Os segmentos de atuação chegam como uma linha por item, no formato
 * `Título | descrição`. Guardar como texto mantém o campo editável num
 * textarea do painel, sem exigir um editor de lista só para esta seção.
 */
function segmentos(texto: string): { title: string; text: string }[] {
  return texto
    .split(/\n+/)
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const [title, ...resto] = linha.split("|");
      return { title: title.trim(), text: resto.join("|").trim() };
    })
    .filter((item) => item.title);
}

export default async function AboutPage() {
  const settings = await getSettings();
  const { about } = settings;
  const years = new Date().getFullYear() - SITE.foundedYear;

  const historia = paragrafos(about.history ?? "");
  const atuacao = segmentos(about.segments ?? "");
  const fechamento = paragrafos(about.closing ?? "");

  return (
    <div className="container-site py-10 md:py-14">
      <Breadcrumb items={[{ label: "A imobiliária" }]} />

      <header className="mt-8 max-w-3xl">
        <p className="eyebrow">Desde {SITE.foundedYear}</p>
        <h1 className="mt-4 text-balance text-hero">Mais de 50 anos de história em Arujá</h1>
        {about.tagline ? (
          <p className="mt-6 text-pretty text-xl leading-relaxed text-primary md:text-2xl">
            {about.tagline}
          </p>
        ) : null}
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-7">
          <p className="text-pretty text-lg leading-relaxed text-ink md:text-xl">{about.intro}</p>
        </Reveal>

        {historia.length ? (
          <Reveal className="lg:col-span-5 lg:border-l lg:border-line lg:pl-16" delay={90}>
            <div className="space-y-5 text-pretty leading-relaxed text-ink-soft">
              {historia.map((texto, index) => (
                <p key={index}>{texto}</p>
              ))}
            </div>
          </Reveal>
        ) : null}
      </div>

      <div
        className={cn(
          "mt-16 grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line",
          "sm:grid-cols-2"
        )}
      >
        {[
          { value: years, label: "anos em Arujá" },
          { value: 2, label: "gerações da família Barbieri" },
        ].map((item) => (
          <div key={item.label} className="bg-surface px-6 py-8">
            <p className="font-display text-[2.5rem] leading-none text-primary tabular">{item.value}</p>
            <p className="mt-2 text-sm text-ink-soft">{item.label}</p>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------ Nossa atuação */}
      {atuacao.length ? (
        <section className="mt-20">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">O que fazemos</p>
            <h2 className="mt-3 text-display">Nossa atuação</h2>
            <p className="mt-4 text-pretty leading-relaxed text-ink-soft">{about.specialties}</p>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {atuacao.map((item, index) => (
              <Reveal key={item.title} delay={Math.min(index, 2) * 80}>
                <article className="h-full rounded-[var(--radius-md)] border border-line bg-surface p-6 transition-[border-color,box-shadow,transform] duration-500 ease-[var(--ease-premium)] hover:-translate-y-1 hover:border-line-strong hover:shadow-card">
                  <span aria-hidden className="block h-px w-10 bg-gold" />
                  <h3 className="mt-4 text-xl">{item.title}</h3>
                  {item.text ? (
                    <p className="mt-2 text-pretty text-[0.9375rem] leading-relaxed text-ink-soft">
                      {item.text}
                    </p>
                  ) : null}
                </article>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      {/* -------------------------------------------- Missão, visão e valores */}
      <section className="mt-20 grid gap-6 md:grid-cols-3">
        {[
          { title: "Missão", text: about.mission },
          { title: "Visão", text: about.vision },
          { title: "Valores", text: about.values },
        ]
          .filter((block) => block.text)
          .map((block, index) => (
            <Reveal key={block.title} delay={index * 80}>
              <article className="h-full rounded-[var(--radius-md)] border border-line bg-surface p-7">
                <h2 className="text-xl text-primary">{block.title}</h2>
                <p className="mt-3 text-pretty text-[0.9375rem] leading-relaxed text-ink-soft">
                  {block.text}
                </p>
              </article>
            </Reveal>
          ))}
      </section>

      {/* ---------------------------------------- Uma história que continua */}
      {fechamento.length ? (
        <section className="mt-20 border-t border-line pt-16">
          <Reveal className="mx-auto max-w-3xl text-center">
            <p className="eyebrow eyebrow-plain justify-center">Uma história que continua</p>
            <div className="mt-5 space-y-5">
              {fechamento.map((texto, index) => (
                <p
                  key={index}
                  className={cn(
                    "text-pretty leading-relaxed",
                    index === 0 ? "font-display text-2xl leading-snug text-ink md:text-[2rem]" : "text-ink-soft"
                  )}
                >
                  {texto}
                </p>
              ))}
            </div>

            <p className="mt-10 text-sm font-medium text-primary">{SITE.legalName}</p>
            <p className="label-caps mt-1.5 text-muted">
              Desde {SITE.foundedYear}, fazendo parte da história de Arujá
            </p>
          </Reveal>
        </section>
      ) : null}

      <section className="mt-20 rounded-[var(--radius-md)] bg-primary px-7 py-12 md:px-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-12 md:items-center">
          <div className="md:col-span-8">
            <h2 className="text-balance text-3xl text-white md:text-[2.25rem]">
              Vamos conversar sobre o que você procura?
            </h2>
            <p className="mt-3 max-w-xl text-pretty leading-relaxed text-white/80">
              {about.communication}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 md:col-span-4 md:justify-end">
            <ButtonLink href="/contato" variant="gold" size="lg">
              Falar com a gente
              <ArrowRightIcon />
            </ButtonLink>
          </div>
        </div>
      </section>

      <p className="mt-10 text-center text-xs text-muted">
        {SITE.legalName} · {SITE.creci} ·{" "}
        <Link href="/imoveis" className="underline-offset-4 hover:underline">
          Ver imóveis disponíveis
        </Link>
      </p>
    </div>
  );
}
