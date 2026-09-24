import type { Metadata } from "next";

import { SITE } from "@/lib/site";
import { getPropertyTypes, getCities } from "@/lib/queries/taxonomies";
import { getSettings } from "@/lib/queries/settings";
import { whatsappUrl } from "@/lib/format";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SellPropertyForm } from "@/components/forms/sell-property-form";
import { ButtonExternal } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/icons";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Venda seu imóvel",
  description:
    "Envie os dados do seu imóvel em Arujá e região para a Vale do Sol Imóveis. Atuamos na cidade desde 1975.",
  alternates: { canonical: "/venda-seu-imovel" },
};

export default async function SellPropertyPage() {
  const [types, cities, settings] = await Promise.all([getPropertyTypes(), getCities(), getSettings()]);

  const whatsapp = whatsappUrl(
    settings.contact.whatsapp,
    "Olá, quero anunciar meu imóvel com a Vale do Sol Imóveis."
  );

  return (
    <div className="container-site py-10 md:py-14">
      <Breadcrumb items={[{ label: "Venda seu imóvel" }]} />

      <div className="mt-8 grid gap-12 lg:grid-cols-12 lg:gap-16">
        <header className="lg:col-span-5">
          <p className="eyebrow">Anuncie com a gente</p>
          <h1 className="mt-4 text-balance text-[2.5rem] leading-[1.08] md:text-[3rem]">
            Seu imóvel merece ser apresentado da maneira certa.
          </h1>
          <p className="mt-6 text-pretty text-lg leading-relaxed text-ink-soft">
            Há {new Date().getFullYear() - SITE.foundedYear} anos a Vale do Sol acompanha o mercado de
            Arujá. Conte o que você tem e a gente conversa sobre como anunciar.
          </p>

          <ol className="mt-10 space-y-6 border-t border-line pt-8">
            {[
              {
                title: "Você envia os dados",
                text: "Preencha o formulário com o que souber sobre o imóvel. Foto ajuda, mas não é obrigatória.",
              },
              {
                title: "A gente entra em contato",
                text: "Falamos com você para entender o imóvel, tirar dúvidas e combinar a visita.",
              },
              {
                title: "O imóvel entra no site",
                text: "Fotografado e descrito do jeito certo, publicado para quem procura em Arujá.",
              },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-gold font-display text-base text-gold">
                  {index + 1}
                </span>
                <div>
                  <h2 className="text-lg">{step.title}</h2>
                  <p className="mt-1 text-pretty text-sm leading-relaxed text-ink-soft">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          {whatsapp ? (
            <div className="mt-10 rounded-[var(--radius-md)] border border-line bg-surface p-6">
              <p className="text-sm text-ink-soft">
                Prefere falar direto com alguém? É só chamar.
              </p>
              <ButtonExternal href={whatsapp} variant="outline" className="mt-4 w-full sm:w-auto">
                <WhatsAppIcon />
                Falar pelo WhatsApp
              </ButtonExternal>
            </div>
          ) : null}
        </header>

        <div className="lg:col-span-7">
          <div className="rounded-[var(--radius-md)] border border-line bg-surface p-7 md:p-9">
            <h2 className="text-2xl">Dados do imóvel</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Os campos marcados com <span className="text-danger">*</span> são obrigatórios.
            </p>
            <div className="mt-7">
              <SellPropertyForm
                types={types.map((type) => ({ value: type.slug, label: type.name }))}
                cities={cities}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
