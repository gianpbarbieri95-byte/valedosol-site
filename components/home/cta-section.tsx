import Image from "next/image";
import Link from "next/link";
import { ButtonExternal, ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { ArrowRightIcon, WhatsAppIcon } from "@/components/ui/icons";

/**
 * Fecho da home: atendimento personalizado para quem não achou o que
 * procurava na vitrine. O WhatsApp é o de site_settings, com a mensagem já
 * escrita; sem WhatsApp cadastrado, o botão leva à página de contato. A foto
 * de fundo é a "imagem da abertura" cadastrada no painel, bem escurecida.
 */
export function CTASection({ whatsapp, image }: { whatsapp: string | null; image?: string | null }) {
  return (
    <section aria-labelledby="cta-final" className="relative isolate overflow-hidden bg-primary-deep text-white">
      {image ? (
        <div aria-hidden className="absolute inset-0 -z-10">
          <Image src={image} alt="" fill quality={70} sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-[#04140b]/78" />
        </div>
      ) : null}
      <div className="container-site py-28 md:py-44">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="label-caps text-[0.6875rem] text-gold-bright">Atendimento personalizado</p>
          <h2 id="cta-final" className="mt-6 text-balance text-hero text-white">
            Está procurando um imóvel específico?
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-pretty text-lg leading-relaxed text-white/80">
            Conte o que você procura. Nossa equipe pode apresentar possibilidades disponíveis em Arujá
            e região.
          </p>

          <div className="mt-12 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {whatsapp ? (
              <ButtonExternal href={whatsapp} variant="brass" size="lg">
                <WhatsAppIcon />
                Quero encontrar meu imóvel
              </ButtonExternal>
            ) : (
              <ButtonLink href="/contato" variant="brass" size="lg">
                Quero encontrar meu imóvel
                <ArrowRightIcon />
              </ButtonLink>
            )}
          </div>

          <p className="mt-10 text-sm text-white/65">
            Prefere procurar sozinho?{" "}
            <Link
              href="/imoveis"
              className="text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-gold-bright"
            >
              Ver todos os imóveis
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
