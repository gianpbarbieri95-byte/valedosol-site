import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";

/**
 * Para quem tem um imóvel. O texto é o do institucional (o que a Vale do Sol
 * faz) e os três passos são os mesmos da página "Venda seu imóvel" — nenhum
 * serviço ou diferencial novo é prometido aqui.
 */
const STEPS = [
  { title: "Você envia os dados", text: "O que souber sobre o imóvel. Foto ajuda, mas não é obrigatória." },
  { title: "A gente entra em contato", text: "Para entender o imóvel, tirar dúvidas e combinar a visita." },
  { title: "O imóvel é anunciado", text: "Descrito com cuidado e publicado para quem procura em Arujá." },
];

export function SellSection({ specialties, years }: { specialties: string | null; years: number }) {
  return (
    <section aria-labelledby="vender" className="border-y border-line bg-surface section-xl">
      <div className="container-site grid gap-14 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-6">
          <p className="eyebrow">Para proprietários</p>
          <h2 id="vender" className="mt-6 text-balance text-display">
            Está pensando em vender seu imóvel?
          </h2>
          <p className="mt-6 max-w-lg text-pretty text-[1.0625rem] leading-relaxed text-ink-soft md:text-lg">
            {specialties ??
              "Atuamos na compra, venda e intermediação de imóveis em Arujá e região."}{" "}
            São {years} anos conhecendo o mercado da cidade.
          </p>
          <ButtonLink href="/venda-seu-imovel" variant="primary" size="lg" className="mt-10">
            Falar com a Vale do Sol
            <ArrowRightIcon />
          </ButtonLink>
        </Reveal>

        <Reveal as="ol" className="self-end lg:col-span-5 lg:col-start-8" delay={120}>
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-6 border-t border-line py-6 last:border-b">
              <span className="w-8 shrink-0 font-display text-2xl leading-none text-gold tabular">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-[1.5rem] leading-tight">{step.title}</h3>
                <p className="mt-1.5 text-pretty text-[0.9375rem] leading-relaxed text-ink-soft">{step.text}</p>
              </div>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
