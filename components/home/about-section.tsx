import Link from "next/link";
import { SITE } from "@/lib/site";
import { Reveal } from "@/components/ui/reveal";
import { ArrowRightIcon } from "@/components/ui/icons";

/**
 * "Uma empresa que atravessou gerações." — as pessoas da Vale do Sol.
 * Nome e função são exatamente os do institucional cadastrado no painel;
 * nenhum cargo, formação ou frase foi acrescentado. Não há fotos da família
 * no acervo, então a apresentação é tipográfica, como o expediente de uma
 * revista — nunca um rosto de banco de imagens no lugar de uma pessoa real.
 */
const PEOPLE = [
  {
    generation: `Fundador · ${SITE.foundedYear}`,
    name: "Leonardo Barbieri",
    text: "Italiano e veterano no mercado de vendas, fundou a Vale do Sol em Arujá.",
  },
  {
    generation: "Segunda geração",
    name: "Maria Barbieri",
    text: "Advogada. Conduz a Vale do Sol.",
  },
  {
    generation: "Segunda geração",
    name: "Francisco Barbieri, o Franco",
    text: "Engenheiro mecânico especializado em corretagem de imóveis. Conduz a Vale do Sol.",
  },
];

export function AboutSection({ closing }: { closing: string | null }) {
  return (
    <section aria-labelledby="familia" className="container-site section-xl">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-7">
          <p className="eyebrow">A família Barbieri</p>
          <h2 id="familia" className="mt-6 text-balance text-display">
            Uma empresa que{" "}
            <span className="italic text-primary">atravessou gerações.</span>
          </h2>
        </Reveal>

        <Reveal className="self-end lg:col-span-5" delay={120}>
          {closing ? (
            <p className="text-pretty text-[1.0625rem] leading-relaxed text-ink-soft md:text-lg">
              {closing}
            </p>
          ) : null}
          <Link href="/a-imobiliaria" className="link-line mt-8 text-ink">
            Conheça a Vale do Sol
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </Reveal>
      </div>

      <ul className="mt-16 grid gap-y-12 md:grid-cols-3 md:gap-x-12 lg:mt-24">
        {PEOPLE.map((person, index) => (
          <Reveal
            as="li"
            key={person.name}
            delay={index * 110}
            className="border-t border-ink/80 pt-7"
          >
            <p className="label-caps text-[0.625rem] text-gold tabular">{person.generation}</p>
            <h3 className="mt-5 text-balance text-[clamp(1.9rem,1.5rem+1.2vw,2.6rem)] leading-[1.05]">
              {person.name}
            </h3>
            <p className="mt-4 max-w-xs text-pretty leading-relaxed text-ink-soft">{person.text}</p>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
