import Link from "next/link";
import { SITE } from "@/lib/site";
import { Reveal } from "@/components/ui/reveal";
import { ArrowRightIcon } from "@/components/ui/icons";

/**
 * A Vale do Sol em quatro ideias curtas. Cada texto resume o que já está no
 * institucional cadastrado no painel (história, missão, valores) — nenhuma
 * promessa nova. Não há fotos da família no acervo, então as pessoas
 * aparecem pelo nome, nunca por um rosto de banco de imagens.
 */
const TRAITS = [
  {
    title: "Experiência",
    text: `No mercado imobiliário de Arujá e região desde ${SITE.foundedYear}.`,
  },
  {
    title: "Conhecimento local",
    text: "Décadas conhecendo a cidade, seus bairros, suas transformações e o mercado da região.",
  },
  {
    title: "Atendimento próximo",
    text: "Atendimento personalizado até o fim da negociação, com suporte depois da compra ou da locação.",
  },
  {
    title: "Continuidade familiar",
    text: "Fundada por Leonardo Barbieri e conduzida hoje pela segunda geração: Maria e Franco Barbieri.",
  },
];

export function AboutSection({ intro }: { intro: string }) {
  return (
    <section aria-labelledby="a-vale-do-sol" className="container-site section-xl">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-7">
          <p className="eyebrow">A Vale do Sol</p>
          <h2 id="a-vale-do-sol" className="mt-6 text-balance text-display">
            Conhecemos Arujá porque{" "}
            <span className="italic text-primary">fazemos parte da sua história.</span>
          </h2>
        </Reveal>

        <Reveal className="lg:col-span-5 lg:pt-14" delay={120}>
          <p className="text-pretty text-[1.0625rem] leading-relaxed text-ink-soft md:text-lg">{intro}</p>
          <Link href="/a-imobiliaria" className="link-line mt-8 text-ink">
            Conheça a Vale do Sol
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </Reveal>
      </div>

      <ul className="mt-20 grid gap-y-10 sm:grid-cols-2 sm:gap-x-12 lg:mt-28 lg:grid-cols-4">
        {TRAITS.map((trait, index) => (
          <Reveal as="li" key={trait.title} delay={index * 100} className="border-t border-ink/80 pt-6">
            <h3 className="text-[1.75rem] leading-tight text-ink">{trait.title}</h3>
            <p className="mt-3 max-w-xs text-pretty text-[0.9375rem] leading-relaxed text-ink-soft">{trait.text}</p>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
