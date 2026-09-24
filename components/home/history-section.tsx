import { SITE } from "@/lib/site";
import { Reveal } from "@/components/ui/reveal";

/**
 * "Desde 1975" — a história como uma cronologia impressa, em cinco passos.
 * Só entra o que a própria imobiliária publica (texto institucional e filme):
 * a fundação por Leonardo Barbieri, as décadas acompanhando Arujá, os
 * segmentos em que passou a atuar, a segunda geração e o presente. Não há
 * fotografia histórica no acervo, então a seção é tipográfica de propósito —
 * nenhuma imagem de "época" é inventada.
 */
const STEPS = [
  {
    mark: String(SITE.foundedYear),
    title: "Fundação",
    text: "Em Arujá, Leonardo Barbieri, italiano e veterano no mercado de vendas, funda a Vale do Sol Empreendimentos Imobiliários.",
  },
  {
    mark: "Décadas",
    title: "Crescimento de Arujá",
    text: "A empresa acompanha o crescimento e a transformação da cidade e da região, negócio a negócio.",
  },
  {
    mark: "Ciclos",
    title: "Novos ciclos",
    text: "Terrenos, casas, chácaras, galpões, condomínios fechados, administração e locação: a experiência se estende a diferentes segmentos.",
  },
  {
    mark: "Família",
    title: "Segunda geração",
    text: "Maria Barbieri, advogada, e Franco Barbieri, engenheiro especializado em corretagem de imóveis, passam a conduzir a empresa.",
  },
  {
    mark: "Hoje",
    title: "Uma nova experiência imobiliária",
    text: "Os valores que deram origem à Vale do Sol, com o cuidado de sempre para quem compra, vende, investe ou aluga.",
  },
];

export function HistorySection() {
  return (
    <section
      aria-labelledby="historia"
      className="relative isolate overflow-hidden border-t border-line bg-surface-alt section-xl"
    >
      {/* O ano da fundação como marca d'água, como num caderno de arquivo */}
      <p
        aria-hidden
        className="pointer-events-none absolute -left-[3vw] bottom-[-0.12em] -z-10 select-none font-display text-[clamp(10rem,30vw,28rem)] leading-none text-ink/[0.035] tabular"
      >
        {SITE.foundedYear}
      </p>

      <div className="container-site grid gap-16 lg:grid-cols-12 lg:gap-16">
        {/* O título acompanha a leitura no desktop enquanto a cronologia passa */}
        <div className="lg:col-span-5">
          <Reveal className="lg:sticky lg:top-36">
            <p className="eyebrow">Nossa história</p>
            <h2 id="historia" className="mt-6 text-hero">
              Desde {SITE.foundedYear}.
            </h2>
            <p className="mt-6 max-w-md font-display text-[clamp(1.5rem,1.2rem+1vw,2.1rem)] italic leading-snug text-primary">
              Uma história construída imóvel por imóvel.
            </p>
          </Reveal>
        </div>

        <ol className="relative lg:col-span-6 lg:col-start-7">
          {/* Fio da cronologia */}
          <span aria-hidden className="absolute bottom-3 left-0 top-3 w-px bg-line-strong" />
          {STEPS.map((step, index) => (
            <Reveal
              as="li"
              key={step.title}
              delay={60}
              className="relative pb-14 pl-10 last:pb-0 md:pb-20 md:pl-14"
            >
              <span
                aria-hidden
                className={
                  index === STEPS.length - 1
                    ? "absolute left-0 top-2.5 size-[9px] -translate-x-1/2 rounded-full bg-gold"
                    : "absolute left-0 top-2.5 size-[9px] -translate-x-1/2 rounded-full border border-gold bg-surface-alt"
                }
              />
              <p className="label-caps text-[0.625rem] text-muted tabular">
                {String(index + 1).padStart(2, "0")} · {step.mark}
              </p>
              <h3 className="mt-3 text-balance text-[clamp(1.9rem,1.5rem+1.2vw,2.75rem)] leading-[1.05] text-ink">
                {step.title}
              </h3>
              <p className="mt-4 max-w-md text-pretty leading-relaxed text-ink-soft">{step.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
