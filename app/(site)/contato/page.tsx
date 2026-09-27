import type { Metadata } from "next";

import { SITE } from "@/lib/site";
import { getSettings } from "@/lib/queries/settings";
import { phoneHref, whatsappUrl } from "@/lib/format";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ContactForm } from "@/components/forms/contact-form";
import { ButtonExternal } from "@/components/ui/button";
import { ClockIcon, MailIcon, PhoneIcon, PinIcon, WhatsAppIcon } from "@/components/ui/icons";
import { jsonLdScript } from "@/lib/utils";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Contato",
  description:
    "Fale com a Vale do Sol Imóveis. Avenida Antônio Afonso de Lima, 704 — Centro, Arujá — SP.",
  alternates: { canonical: "/contato" },
};

export default async function ContactPage() {
  const { contact } = await getSettings();

  const fullAddress = [contact.address, contact.district, `${contact.city} — ${contact.state}`, contact.zip]
    .filter(Boolean)
    .join(", ");

  const whatsapp = whatsappUrl(
    contact.whatsapp,
    "Olá, vim pelo site da Vale do Sol Imóveis e gostaria de falar com vocês."
  );

  const mapQuery = encodeURIComponent(`${contact.address}, ${contact.city}, ${contact.state}`);

  const lat = Number(contact.latitude);
  const lng = Number(contact.longitude);
  const office =
    contact.latitude && contact.longitude && Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: SITE.name,
    legalName: SITE.legalName,
    url: SITE.url,
    telephone: contact.phone,
    email: contact.email,
    foundingDate: String(SITE.foundedYear),
    address: {
      "@type": "PostalAddress",
      streetAddress: contact.address,
      addressLocality: contact.city,
      addressRegion: contact.state,
      postalCode: contact.zip,
      addressCountry: "BR",
    },
    areaServed: "Arujá e região, São Paulo",
  };

  const channels = [
    { icon: PinIcon, label: "Endereço", value: fullAddress },
    { icon: PhoneIcon, label: "Telefone", value: contact.phone, href: phoneHref(contact.phone) },
    {
      icon: PhoneIcon,
      label: "Celular",
      value: contact.phone_secondary,
      href: phoneHref(contact.phone_secondary),
    },
    { icon: MailIcon, label: "E-mail", value: contact.email, href: `mailto:${contact.email}` },
    {
      icon: MailIcon,
      label: "E-mail",
      value: contact.email_secondary,
      href: `mailto:${contact.email_secondary}`,
    },
    { icon: ClockIcon, label: "Horário de atendimento", value: contact.hours },
  ].filter((channel) => channel.value);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />

      <div className="container-site py-10 md:py-14">
        <Breadcrumb items={[{ label: "Contato" }]} />

        <header className="mt-8 max-w-2xl">
          <p className="eyebrow">Contato</p>
          <h1 className="mt-4 text-balance text-display">
            Fale com a Vale do Sol
          </h1>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-ink-soft">
            Estamos em Arujá desde {SITE.foundedYear}. Visite o escritório no Centro, ligue ou mande
            mensagem — como for mais prático para você.
          </p>
        </header>

        <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <ul className="space-y-6">
              {channels.map((channel, index) => (
                <li key={`${channel.label}-${index}`} className="flex gap-4">
                  <channel.icon className="mt-0.5 size-5 shrink-0 text-gold" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">{channel.label}</p>
                    {channel.href ? (
                      <a
                        href={channel.href}
                        className="mt-1 block text-pretty text-ink transition-colors hover:text-primary"
                      >
                        {channel.value}
                      </a>
                    ) : (
                      <p className="mt-1 text-pretty text-ink">{channel.value}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {whatsapp ? (
              <ButtonExternal href={whatsapp} variant="gold" size="lg" className="mt-8 w-full sm:w-auto">
                <WhatsAppIcon />
                Falar pelo WhatsApp
              </ButtonExternal>
            ) : null}

            {/* O mapa só aparece com coordenadas confirmadas em
                site_settings. Marcar um ponto "mais ou menos" mandaria
                cliente para a esquina errada — o link de rota, não. */}
            <div className="mt-8 overflow-hidden rounded-[var(--radius-md)] border border-line">
              {office ? (
                <iframe
                  title="Mapa — Vale do Sol Imóveis"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-[300px] w-full border-0"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${office.lng - 0.005}%2C${office.lat - 0.003}%2C${office.lng + 0.005}%2C${office.lat + 0.003}&layer=mapnik&marker=${office.lat}%2C${office.lng}`}
                />
              ) : null}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-surface px-4 py-4 text-[0.8125rem] text-ink-soft transition-colors hover:text-primary"
              >
                <PinIcon className="size-4" />
                Abrir rota no Google Maps
              </a>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-[var(--radius-md)] border border-line bg-surface p-7 md:p-9">
              <h2 className="text-2xl">Envie uma mensagem</h2>
              <p className="mt-2 text-sm text-ink-soft">
                Respondemos no telefone ou no e-mail que você deixar aqui.
              </p>
              <div className="mt-7">
                <ContactForm />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
