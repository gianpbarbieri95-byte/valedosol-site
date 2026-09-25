import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { phoneHref, whatsappUrl } from "@/lib/format";
import { MailIcon, PhoneIcon, PinIcon, WhatsAppIcon } from "@/components/ui/icons";
import type { ContactSettings, SocialSettings } from "@/types/database";

const COLUMNS = [
  {
    title: "Imóveis",
    links: [
      { href: "/imoveis?finalidade=venda", label: "Comprar" },
      { href: "/imoveis?finalidade=locacao", label: "Alugar" },
      { href: "/imoveis", label: "Todos os imóveis" },
      { href: "/regioes", label: "Regiões" },
      { href: "/favoritos", label: "Meus favoritos" },
    ],
  },
  {
    title: "Institucional",
    links: [
      { href: "/a-imobiliaria", label: "A Vale do Sol" },
      { href: "/venda-seu-imovel", label: "Venda seu imóvel" },
      { href: "/contato", label: "Fale conosco" },
    ],
  },
];

export function Footer({
  contact,
  social,
  regions = [],
}: {
  contact: ContactSettings;
  social: SocialSettings;
  /** Regiões cadastradas no painel — só as que existem, na ordem de lá. */
  regions?: { slug: string; name: string }[];
}) {
  const columns = regions.length
    ? [
        ...COLUMNS,
        {
          title: "Regiões",
          links: [
            ...regions.slice(0, 6).map((region) => ({
              href: `/regioes/${region.slug}`,
              label: region.name,
            })),
            ...(regions.length > 6 ? [{ href: "/regioes", label: "Todas as regiões" }] : []),
          ],
        },
      ]
    : COLUMNS;
  const tel = phoneHref(contact.phone);
  const telSecondary = phoneHref(contact.phone_secondary);
  const whatsapp = whatsappUrl(contact.whatsapp);
  const fullAddress = [contact.address, contact.district, `${contact.city} — ${contact.state}`, contact.zip]
    .filter(Boolean)
    .join(", ");

  return (
    <footer className="mt-24 border-t border-line bg-surface [main:has(#cta-final)+&]:mt-0 [main:has(#cta-final)+&]:border-t-0">
      {/* Fio dourado do logo fechando o corpo da página */}
      <div aria-hidden className="h-px bg-gradient-to-r from-transparent via-gold/45 to-transparent" />

      <div className="container-site grid grid-cols-2 gap-x-8 gap-y-12 py-16 md:grid-cols-12 md:py-20">
        <div className="col-span-2 md:col-span-12 lg:col-span-3">
          <Image
            src="/brand/logo.png"
            alt={SITE.name}
            width={250}
            height={249}
            unoptimized
            className="h-20 w-auto"
          />
          <p className="mt-5 max-w-sm text-pretty text-sm leading-relaxed text-ink-soft">
            Desde {SITE.foundedYear}, a Vale do Sol ajuda famílias e empresas a encontrar imóveis em
            Arujá e região.
          </p>
          <p className="mt-5 text-xs uppercase tracking-[0.14em] text-ink-soft">
            {SITE.creci} <span aria-hidden className="mx-1.5 text-line-strong">·</span> Desde {SITE.foundedYear}
          </p>
        </div>

        {columns.map((column) => (
          <nav
            key={column.title}
            aria-label={column.title}
            className={column.title === "Regiões" ? "md:col-span-3 lg:col-span-2" : "md:col-span-2"}
          >
            <h2 className="mb-5 text-[0.6875rem] font-sans font-medium uppercase tracking-[0.16em] text-ink">
              {column.title}
            </h2>
            <ul className="space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-block text-sm text-ink-soft transition-[color,transform] duration-300 hover:translate-x-1 hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="col-span-2 md:col-span-5 lg:col-span-3">
          <h2 className="mb-5 text-[0.6875rem] font-sans font-medium uppercase tracking-[0.16em] text-ink">
            Contato
          </h2>
          <ul className="space-y-3 text-sm text-ink-soft">
            {fullAddress ? (
              <li className="flex gap-2.5">
                <PinIcon className="mt-0.5 text-muted" />
                <span className="text-pretty">{fullAddress}</span>
              </li>
            ) : null}
            {tel ? (
              <li className="flex gap-2.5">
                <PhoneIcon className="mt-0.5 text-muted" />
                <a className="transition-colors hover:text-primary" href={tel}>
                  {contact.phone}
                </a>
              </li>
            ) : null}
            {telSecondary && contact.phone_secondary !== contact.phone ? (
              <li className="flex gap-2.5">
                <PhoneIcon className="mt-0.5 text-muted" />
                <a className="transition-colors hover:text-primary" href={telSecondary}>
                  {contact.phone_secondary}
                </a>
              </li>
            ) : null}
            {contact.email ? (
              <li className="flex gap-2.5">
                <MailIcon className="mt-0.5 text-muted" />
                <a className="[overflow-wrap:anywhere] transition-colors hover:text-primary" href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              </li>
            ) : null}
            {whatsapp ? (
              <li className="flex gap-2.5">
                <WhatsAppIcon className="mt-0.5 text-muted" />
                <a
                  className="transition-colors hover:text-primary"
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Falar pelo WhatsApp
                </a>
              </li>
            ) : null}
            {contact.hours ? (
              <li className="pt-1 text-xs text-muted">{contact.hours}</li>
            ) : null}
          </ul>

          {social.facebook || social.instagram ? (
            <div className="mt-8">
              <h2 className="mb-3 text-[0.6875rem] font-sans font-medium uppercase tracking-[0.16em] text-ink">
                Redes sociais
              </h2>
              <div className="flex gap-4 text-sm">
              {social.instagram ? (
                <a
                  href={social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-soft transition-colors hover:text-primary"
                >
                  Instagram
                </a>
              ) : null}
              {social.facebook ? (
                <a
                  href={social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-soft transition-colors hover:text-primary"
                >
                  Facebook
                </a>
              ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-site flex flex-col gap-3 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.legalName}. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-5">
            <p>
              Produzido por{" "}
              <a
                href="https://nexoraia.api.br"
                target="_blank"
                rel="noopener"
                className="underline-offset-2 transition-colors hover:text-ink-soft hover:underline"
              >
                Nexora IA &amp; Automação
              </a>
            </p>
            <span aria-hidden className="h-3 w-px bg-line" />
            <Link href="/admin/login" className="transition-colors hover:text-ink-soft">
              Área restrita
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
