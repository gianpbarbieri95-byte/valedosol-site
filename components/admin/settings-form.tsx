"use client";

import { useActionState } from "react";
import { saveSettings } from "@/actions/admin/content";
import { IDLE_STATE } from "@/lib/validations/lead";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { FormMessage, SubmitButton } from "@/components/forms/form-parts";
import type { SiteSettingsMap } from "@/types/database";

function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-line bg-surface p-6">
      <h2 className="text-lg">{title}</h2>
      {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      <div className="mt-5 grid gap-5">{children}</div>
    </section>
  );
}

export function SettingsForm({ settings }: { settings: SiteSettingsMap }) {
  const [state, action] = useActionState(saveSettings, IDLE_STATE);
  const { contact, social, hero, about, seo, analytics } = settings;

  return (
    <form action={action} className="space-y-5">
      <Group title="Contato" description="Aparece no topo do site, no rodapé e na página de contato.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Telefone" htmlFor="s-telefone">
            <Input id="s-telefone" name="contact.phone" defaultValue={contact.phone} />
          </Field>
          <Field label="Celular" htmlFor="s-celular">
            <Input id="s-celular" name="contact.phone_secondary" defaultValue={contact.phone_secondary} />
          </Field>
          <Field
            label="WhatsApp"
            htmlFor="s-whatsapp"
            hint="Só números, com DDI e DDD. Ex.: 5511999876642"
          >
            <Input id="s-whatsapp" name="contact.whatsapp" defaultValue={contact.whatsapp} inputMode="numeric" />
          </Field>
          <Field label="E-mail principal" htmlFor="s-email">
            <Input id="s-email" name="contact.email" type="email" defaultValue={contact.email} />
          </Field>
          <Field label="E-mail secundário" htmlFor="s-email2">
            <Input id="s-email2" name="contact.email_secondary" type="email" defaultValue={contact.email_secondary} />
          </Field>
          <Field label="Horário de atendimento" htmlFor="s-horario" hint="Ex.: Seg a sex, 9h às 18h. Sáb, 9h às 13h.">
            <Input id="s-horario" name="contact.hours" defaultValue={contact.hours} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Endereço" htmlFor="s-endereco">
            <Input id="s-endereco" name="contact.address" defaultValue={contact.address} />
          </Field>
          <Field label="Bairro" htmlFor="s-bairro">
            <Input id="s-bairro" name="contact.district" defaultValue={contact.district} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-4">
          <Field label="Cidade" htmlFor="s-cidade">
            <Input id="s-cidade" name="contact.city" defaultValue={contact.city} />
          </Field>
          <Field label="UF" htmlFor="s-uf">
            <Input id="s-uf" name="contact.state" defaultValue={contact.state} maxLength={2} />
          </Field>
          <Field label="CEP" htmlFor="s-cep">
            <Input id="s-cep" name="contact.zip" defaultValue={contact.zip} />
          </Field>
          <div />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Latitude do escritório"
            htmlFor="s-lat"
            hint="Preencha as duas para o mapa aparecer na página de contato."
          >
            <Input id="s-lat" name="contact.latitude" defaultValue={contact.latitude} />
          </Field>
          <Field label="Longitude do escritório" htmlFor="s-lng">
            <Input id="s-lng" name="contact.longitude" defaultValue={contact.longitude} />
          </Field>
        </div>
      </Group>

      <Group title="Redes sociais" description="Deixe em branco o que a imobiliária não usa — o link some do rodapé.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Instagram" htmlFor="s-instagram">
            <Input id="s-instagram" name="social.instagram" defaultValue={social.instagram} placeholder="https://instagram.com/..." />
          </Field>
          <Field label="Facebook" htmlFor="s-facebook">
            <Input id="s-facebook" name="social.facebook" defaultValue={social.facebook} />
          </Field>
        </div>
      </Group>

      <Group title="Página inicial" description="O texto grande da primeira tela do site.">
        <Field label="Título" htmlFor="s-hero-titulo">
          <Input id="s-hero-titulo" name="hero.title" defaultValue={hero.title} />
        </Field>
        <Field label="Subtítulo" htmlFor="s-hero-sub">
          <Textarea id="s-hero-sub" name="hero.subtitle" rows={2} defaultValue={hero.subtitle} />
        </Field>
        <Field
          label="Imagem de fundo"
          htmlFor="s-hero-img"
          hint="Arquivo no bucket site-images. Em branco, o site usa a foto do primeiro imóvel em destaque."
        >
          <Input id="s-hero-img" name="hero.image_path" defaultValue={hero.image_path} />
        </Field>
      </Group>

      <Group title="Textos institucionais" description="Usados na página 'A imobiliária' e na página inicial.">
        <Field
          label="Linha de abertura"
          htmlFor="s-about-tagline"
          hint="Frase em destaque logo abaixo do título da página."
        >
          <Textarea id="s-about-tagline" name="about.tagline" rows={2} defaultValue={about.tagline} />
        </Field>
        <Field label="Abertura da história" htmlFor="s-about-intro">
          <Textarea id="s-about-intro" name="about.intro" rows={4} defaultValue={about.intro} />
        </Field>
        <Field
          label="Continuação da história"
          htmlFor="s-about-hist"
          hint="Deixe uma linha em branco entre um parágrafo e outro."
        >
          <Textarea id="s-about-hist" name="about.history" rows={8} defaultValue={about.history} />
        </Field>
        <Field
          label="Abertura de 'Nossa atuação'"
          htmlFor="s-about-esp"
          hint="Aparece também na página inicial."
        >
          <Textarea id="s-about-esp" name="about.specialties" rows={3} defaultValue={about.specialties} />
        </Field>
        <Field
          label="Segmentos de atuação"
          htmlFor="s-about-seg"
          hint="Um por linha, no formato: Título | descrição."
        >
          <Textarea id="s-about-seg" name="about.segments" rows={7} defaultValue={about.segments} />
        </Field>
        <Field
          label="Fechamento da página"
          htmlFor="s-about-fech"
          hint="Deixe uma linha em branco entre os parágrafos. O primeiro sai em destaque."
        >
          <Textarea id="s-about-fech" name="about.closing" rows={4} defaultValue={about.closing} />
        </Field>
        <Field label="Atendimento" htmlFor="s-about-com">
          <Textarea id="s-about-com" name="about.communication" rows={3} defaultValue={about.communication} />
        </Field>
        <div className="grid gap-5 lg:grid-cols-3">
          <Field label="Missão" htmlFor="s-about-missao">
            <Textarea id="s-about-missao" name="about.mission" rows={4} defaultValue={about.mission} />
          </Field>
          <Field label="Visão" htmlFor="s-about-visao">
            <Textarea id="s-about-visao" name="about.vision" rows={4} defaultValue={about.vision} />
          </Field>
          <Field label="Valores" htmlFor="s-about-valores">
            <Textarea id="s-about-valores" name="about.values" rows={4} defaultValue={about.values} />
          </Field>
        </div>
      </Group>

      <Group title="SEO" description="Título e descrição que o Google mostra para a página inicial.">
        <Field label="Título" htmlFor="s-seo-titulo" hint="Até 60 caracteres funciona melhor.">
          <Input id="s-seo-titulo" name="seo.title" defaultValue={seo.title} maxLength={70} />
        </Field>
        <Field label="Descrição" htmlFor="s-seo-desc" hint="Até 160 caracteres.">
          <Textarea id="s-seo-desc" name="seo.description" rows={3} defaultValue={seo.description} maxLength={180} />
        </Field>
      </Group>

      <Group title="Analytics" description="Preencha quando tiver as contas criadas. Em branco, nada é carregado.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Google Analytics (ID)" htmlFor="s-ga" hint="Formato G-XXXXXXX">
            <Input id="s-ga" name="analytics.ga_measurement_id" defaultValue={analytics.ga_measurement_id} />
          </Field>
          <Field label="Verificação do Search Console" htmlFor="s-gsc">
            <Input id="s-gsc" name="analytics.gsc_verification" defaultValue={analytics.gsc_verification} />
          </Field>
        </div>
      </Group>

      <div className="sticky bottom-0 flex items-center gap-4 border-t border-line bg-canvas/95 py-4 backdrop-blur-sm">
        <SubmitButton>Salvar configurações</SubmitButton>
        <FormMessage state={state} className="flex-1" />
      </div>
    </form>
  );
}
