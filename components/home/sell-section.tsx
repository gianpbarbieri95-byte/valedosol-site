import { SITE } from "@/lib/site";
import { Reveal } from "@/components/ui/reveal";
import { ButtonExternal, ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon, WhatsAppIcon } from "@/components/ui/icons";

/**
 * Para quem tem um imóvel. Só entra o que é verificável (anos de Arujá, família e
 * CRECI) e os três passos são os mesmos da página "Venda seu imóvel"
 * — nenhum serviço ou diferencial novo é prometido aqui. O fecho da home logo
 * abaixo é verde-escuro, então este bloco é claro, num painel destacado.
 */
const STEPS = [
  { title: "Você envia os dados", text: "O que souber sobre o imóvel. Foto ajuda, mas não é obrigatória." },
  { title: "A gente entra em contato", text: "Para entender o imóvel, tirar dúvidas e combinar a visita." },
  { title: "O imóvel é anunciado", text: "Descrito com cuidado e publicado para quem procura em Arujá." },
];

export function SellSection({ years, whatsapp }: { years: number; whatsapp: string | null }) {
  const proofs = [
    { value: `${years} anos`, label: "no mercado de Arujá" },
    { value: "2 gerações", label: "da família Barbieri" },
    { value: SITE.creciCompany, label: "CRECI da imobiliária" },
  ];

  return (
    <section aria-labelledby="vender" className="bg-canvas section">
      <div className="container-site">
        <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface shadow-card">
          {/* Traço dourado no topo: o painel se lê como um "cartão" da imobiliária */}
          <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gold" />

          <div className="grid lg:grid-cols-12">
            <Reveal className="p-7 sm:p-10 lg:col-span-7 lg:p-14">
              <p className="eyebrow">Para proprietários</p>
              <h2 id="vender" className="mt-5 text-balance text-display">
                Seu imóvel nas mãos de quem <em className="text-primary">conhece Arujá</em>.
              </h2>
              <p className="mt-5 max-w-lg text-pretty text-[1.0625rem] leading-relaxed text-ink-soft">
                Quer vender ou alugar? Conte o que você tem. A Vale do Sol cuida do anúncio e do
                atendimento a quem procura imóvel na cidade.
              </p>

              <dl className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius-sm)] border border-line bg-line sm:grid-cols-3">
                {proofs.map((item) => (
                  <div key={item.value} className="bg-surface px-4 py-4">
                    <dt className="sr-only">{item.label}</dt>
                    <dd className="font-display text-[1.35rem] leading-tight text-ink tabular">{item.value}</dd>
                    <p className="mt-1 text-[0.8125rem] leading-snug text-muted">{item.label}</p>
                  </div>
                ))}
              </dl>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ButtonLink href="/venda-seu-imovel" variant="primary" size="lg">
                  Anunciar meu imóvel
                  <ArrowRightIcon />
                </ButtonLink>
                {whatsapp ? (
                  <ButtonExternal href={whatsapp} variant="outline" size="lg">
                    <WhatsAppIcon />
                    Conversar no WhatsApp
                  </ButtonExternal>
                ) : null}
              </div>
            </Reveal>

            <Reveal
              delay={120}
              className="border-t border-line bg-surface-alt p-7 sm:p-10 lg:col-span-5 lg:border-l lg:border-t-0 lg:p-14"
            >
              <p className="label-caps text-[0.6875rem] text-gold">Como funciona</p>
              <ol className="relative mt-7">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="relative flex gap-5 pb-8 last:pb-0">
                    {/* Fio até o próximo passo */}
                    {index < STEPS.length - 1 ? (
                      <span aria-hidden className="absolute bottom-0 left-[1.0625rem] top-[2.125rem] w-px bg-line-strong" />
                    ) : null}
                    <span className="relative z-10 grid size-[2.125rem] shrink-0 place-items-center rounded-full border border-gold bg-surface font-display text-[1.05rem] leading-none text-gold tabular">
                      {index + 1}
                    </span>
                    <div className="pt-1">
                      <h3 className="text-[1.25rem] leading-tight">{step.title}</h3>
                      <p className="mt-1.5 text-pretty text-[0.9375rem] leading-relaxed text-ink-soft">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
