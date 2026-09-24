import { SITE } from "@/lib/site";
import { Reveal } from "@/components/ui/reveal";

/**
 * "Desde 1975" — a história como uma cronologia impressa, em cinco passos,
 * do ano da fundação ao ano corrente (calculado, nunca escrito à mão).
 * Só entra o que a própria imobiliária publica (texto institucional e filme):
 * a fundação por Leonardo Barbieri, as décadas acompanhando Arujá, os
 * segmentos em que passou a atuar, a segunda geração e o presente. Não há
 * fotografia histórica no acervo, então a seção é tipográfica de propósito —
 * nenhuma imagem de "época" é inventada.
 */
const YEAR = new Date().getFullYear();
const YEARS = YEAR - SITE.foundedYear;

const STEPS = [
  {
    mark: String(SITE.foundedYear),
    title: "Leonardo Barbieri funda a Vale do Sol",
    text: "Em Arujá, o italiano Leonardo Barbieri, veterano no mercado de vendas, funda a Vale do Sol Empreendimentos Imobiliários.",
  },
  {
    mark: "Décadas de história",
    title: "Arujá cresce. A Vale do Sol cresce junto.",
    text: "A empresa acompanha o crescimento e a transformação da cidade e da região, negócio a negócio.",
  },
  {
    mark: "Novos segmentos",
    title: "Do terreno ao condomínio fechado",
    text: "Terrenos, casas, chácaras, galpões, condomínios fechados, administração e locação: a experiência se estende a diferentes segmentos.",
  },
  {
    mark: "Hoje",
    title: "A segunda geração da família",
    text: "Maria Barbieri, advogada, e Francisco Barbieri, o Franco, engenheiro mecânico especializado em corretagem de imóveis, conduzem a empresa.",
  },
  {
    mark: String(YEAR),
    title: `${YEARS} anos de história`,
    text: "Conectando pessoas a imóveis em Arujá e região, com os valores que deram origem à Vale do Sol.",
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
            <p className="mt-6 max-w-sm text-pretty leading-relaxed text-ink-soft">
              {YEARS} anos acompanhando Arujá — da fundação por Leonardo Barbieri à segunda geração
              da família.
            </p>
          </Reveal>
        </div>

        <ol className="relative lg:col-span-6 lg:col-start-7">
          {/* Fio da cronologia; o traço dourado por cima se desenha conforme
              a leitura desce (CSS puro, ver .timeline-progress). */}
          <span aria-hidden className="absolute bottom-3 left-0 top-3 w-px bg-line-strong" />
          <span aria-hidden className="timeline-progress absolute bottom-3 left-0 top-3 w-px bg-gold" />
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
              <p className="font-display text-[clamp(1.35rem,1.1rem+0.8vw,1.75rem)] leading-none text-gold tabular">
                {step.mark}
              </p>
              <h3 className="mt-4 text-balance text-[clamp(1.75rem,1.4rem+1.1vw,2.5rem)] leading-[1.08] text-ink">
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
