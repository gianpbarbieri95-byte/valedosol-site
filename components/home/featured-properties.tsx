import Link from "next/link";
import { PropertyCard } from "@/components/property/property-card";
import { SectionHeading } from "@/components/ui/primitives";
import { Reveal } from "@/components/ui/reveal";
import { ArrowRightIcon } from "@/components/ui/icons";
import type { PropertyCardData } from "@/types/database";

/**
 * Vitrine editorial: um imóvel protagonista e dois de apoio, em composição
 * assimétrica. A seleção vem de getShowcaseProperties — disponível, com foto,
 * destaques da imobiliária na frente. Nada é promovido por conta própria.
 */
export function FeaturedProperties({
  properties,
  ledes,
}: {
  properties: PropertyCardData[];
  /** Linha de apresentação por id — só com o que foi cadastrado. */
  ledes: Map<string, string | null>;
}) {
  const [lead, ...rest] = properties;
  if (!lead) return null;

  return (
    <section aria-labelledby="selecionados" className="container-site section-xl">
      <Reveal>
        <SectionHeading
          id="selecionados"
          eyebrow="Imóveis em destaque"
          title="Propriedades que merecem ser conhecidas."
          description="Uma seleção do acervo da Vale do Sol em Arujá e região."
          action={
            <Link href="/imoveis" className="link-line text-ink">
              Ver todos os imóveis
              <ArrowRightIcon className="size-3.5" />
            </Link>
          }
        />
      </Reveal>

      {/* O protagonista em largura total; os dois de apoio embaixo, em
          larguras e alturas de partida diferentes — a assimetria é de propósito. */}
      <Reveal className="mt-14 md:mt-20">
        <PropertyCard
          property={lead}
          size="xl"
          lede={ledes.get(lead.id)}
          imageClassName="aspect-[4/3] md:aspect-[16/9] lg:aspect-[21/9]"
          sizes="(min-width: 1440px) 1312px, 100vw"
        />
      </Reveal>

      {rest.length ? (
        <div className="mt-16 grid gap-x-12 gap-y-16 md:mt-24 md:grid-cols-12">
          {rest.map((property, index) => (
            <Reveal
              key={property.id}
              delay={120 + index * 120}
              className={index === 0 ? "md:col-span-7" : "md:col-span-5 md:mt-24"}
            >
              <PropertyCard
                property={property}
                size="lg"
                lede={ledes.get(property.id)}
                imageClassName="aspect-[4/3]"
                sizes={index === 0 ? "(min-width: 768px) 58vw, 100vw" : "(min-width: 768px) 42vw, 100vw"}
              />
            </Reveal>
          ))}
        </div>
      ) : null}
    </section>
  );
}
