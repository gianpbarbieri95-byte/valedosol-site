import Image from "next/image";
import Link from "next/link";
import { ButtonExternal, ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { ArrowRightIcon, WhatsAppIcon } from "@/components/ui/icons";

/**
 * Chamada final da home. O WhatsApp é o mesmo número de site_settings; a
 * foto de fundo é a "imagem da abertura" cadastrada no painel (uma casa do
 * acervo), escurecida só o bastante para o texto ler.
 */
export function CTASection({ whatsapp, image }: { whatsapp: string | null; image?: string | null }) {
  return (
    <section aria-labelledby="cta-final" className="relative isolate overflow-hidden bg-primary-deep text-white">
      {image ? (
        <div aria-hidden className="absolute inset-0 -z-10">
          <Image src={image} alt="" fill quality={75} sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-[#04140b]/72" />
        </div>
      ) : null}
      <div className="container-site py-28 md:py-44">
        <Reveal className="mx-auto max-w-4xl text-center">
          <h2 id="cta-final" className="text-balance text-hero text-white">
            O próximo imóvel começa com uma boa escolha.
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-pretty text-lg leading-relaxed text-white/75">
            Conte o que você procura. A Vale do Sol ajuda você a encontrar as possibilidades certas.
          </p>

          <div className="mt-12 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="/imoveis" variant="gold" size="lg">
              Encontrar meu imóvel
              <ArrowRightIcon />
            </ButtonLink>
            {whatsapp ? (
              <ButtonExternal href={whatsapp} variant="onDark" size="lg">
                <WhatsAppIcon />
                Falar com a Vale do Sol
              </ButtonExternal>
            ) : (
              <ButtonLink href="/contato" variant="onDark" size="lg">
                Falar com a Vale do Sol
              </ButtonLink>
            )}
          </div>

          <p className="mt-14 text-sm text-white/60">
            Quer vender ou alugar o seu imóvel?{" "}
            <Link
              href="/venda-seu-imovel"
              className="text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-gold-bright"
            >
              Anuncie com a Vale do Sol
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
