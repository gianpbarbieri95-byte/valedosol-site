import { Reveal } from "@/components/ui/reveal";

const PILLARS = [
  {
    title: "Experiência",
    text: "Conhecimento acumulado ao longo de décadas no mercado imobiliário de Arujá e região.",
  },
  {
    title: "Atendimento",
    text: "Acompanhamento próximo em cada etapa, da primeira conversa ao pós-venda.",
  },
  {
    title: "Segurança",
    text: "Uma negociação conduzida com cuidado e transparência, do começo ao fim.",
  },
];

/** Os três pilares, só com tipografia e fio fino — sem ícone decorativo. */
export function ExperienceSection() {
  return (
    <section aria-labelledby="experiencia" className="border-t border-line section-xl">
      <div className="container-site">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Experiência Vale do Sol</p>
          <h2 id="experiencia" className="mt-6 text-balance text-display">
            O que muda quando quem atende conhece o caminho.
          </h2>
        </Reveal>

        <ol className="mt-16 grid gap-y-12 md:mt-24 md:grid-cols-3 md:gap-x-12">
          {PILLARS.map((pillar, index) => (
            <Reveal as="li" key={pillar.title} delay={index * 120} className="border-t border-ink/80 pt-7">
              <p className="text-xs text-muted tabular">{String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-6 text-[2.25rem] leading-none">{pillar.title}</h3>
              <p className="mt-4 max-w-xs text-pretty leading-relaxed text-ink-soft">{pillar.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
