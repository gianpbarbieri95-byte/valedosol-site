import Image from "next/image";
import Link from "next/link";
import { PROFILE_DEFINITIONS, type Profile } from "@/lib/profiles";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/primitives";
import { ArrowRightIcon } from "@/components/ui/icons";

export interface SearchPath {
  profile: Profile;
  count: number;
  /** Foto real de um imóvel do perfil. */
  image: string | null;
}

/**
 * "Qual imóvel você procura?" — três caminhos em vez de um formulário.
 * Cada painel usa a foto de um imóvel do próprio acervo e leva à listagem
 * filtrada pelo perfil. A contagem é a real; perfil vazio não aparece.
 */
export function SearchPaths({ paths }: { paths: SearchPath[] }) {
  const visible = paths.filter((path) => path.count > 0);
  if (!visible.length) return null;

  return (
    <section aria-labelledby="caminhos" className="container-site pb-24 md:pb-36">
      <Reveal>
        <SectionHeading
          id="caminhos"
          eyebrow="Por estilo de vida"
          title="Encontre pelo seu estilo de vida."
          description="Morar, investir ou ter mais espaço: três caminhos pelo acervo de hoje."
        />
      </Reveal>

      <ul className="mt-12 grid gap-4 md:mt-16 md:grid-cols-3 md:gap-5">
        {visible.map((path, index) => {
          const definition = PROFILE_DEFINITIONS[path.profile];
          return (
            <Reveal as="li" key={path.profile} delay={index * 110}>
              <Link
                href={`/imoveis?perfil=${path.profile}`}
                className="group relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-[var(--radius-xs)] bg-primary-deep p-6 text-white sm:aspect-[16/9] md:aspect-[3/4] md:p-8"
              >
                <div className="img-reveal absolute inset-0">
                  {path.image ? (
                    <Image
                      src={path.image}
                      alt=""
                      fill
                      quality={80}
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover transition-transform duration-[1.6s] ease-[var(--ease-premium)] group-hover:scale-[1.05]"
                    />
                  ) : null}
                </div>
                {/* Véu só na metade de baixo, onde fica o texto */}
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-[#04140b]/85 via-[#04140b]/25 to-transparent transition-opacity duration-700 group-hover:opacity-90"
                />

                <div className="relative">
                  <p className="label-caps text-[0.625rem] text-white/60 tabular">
                    {String(index + 1).padStart(2, "0")} · {path.count}{" "}
                    {path.count === 1 ? "imóvel" : "imóveis"}
                  </p>
                  <h3 className="mt-3 font-display text-[2.75rem] leading-none text-white md:text-[3.25rem]">
                    {definition.label}
                  </h3>
                  <p className="mt-3 max-w-[18rem] text-pretty text-[0.9375rem] leading-relaxed text-white/80">
                    {definition.description}
                  </p>
                  <span className="link-line mt-6 text-[0.625rem] text-white">
                    Explorar
                    <ArrowRightIcon className="size-3.5" />
                  </span>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </ul>
    </section>
  );
}
