"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { saveProperty } from "@/actions/admin/properties";
import { IDLE_STATE } from "@/lib/validations/lead";
import { slugify } from "@/lib/format";
import { formatDescription } from "@/lib/description";
import { cn } from "@/lib/utils";
import { DescriptionBlocks } from "@/components/property/description-blocks";
import { codePrefix, nextPropertyCode } from "@/lib/property-code";
import { PROPERTY_STATUSES, PUBLICATION_STATES, STATUS_LABEL } from "@/lib/site";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { PinIcon } from "@/components/ui/icons";
import { FormMessage } from "@/components/forms/form-parts";
import { DecimalInput, NumberStepper, formatCep, lookupCep } from "@/components/admin/form-controls";
import { PORTALS, PORTAL_IDS } from "@/lib/portals/definitions";
import type { PortalId, Property, PropertyType, Region } from "@/types/database";

/** Dados do CRM para as etapas "Proprietários" e "Divulgação". */
export interface PropertyCrmData {
  clients: { id: string; name: string; phone: string | null }[];
  ownerIds: string[];
  portals: Partial<Record<PortalId, { listed: boolean; highlight: boolean }>>;
  /** O que hoje impede o imóvel de sair no XML de cada portal. */
  portalIssues: Partial<Record<PortalId, string[]>>;
  /** Portais ligados pelo administrador na tela de portais. */
  enabledPortals: PortalId[];
}

export interface ExtraStep {
  id: string;
  label: string;
}

const PUBLICATION_LABEL: Record<(typeof PUBLICATION_STATES)[number], string> = {
  draft: "Rascunho — só você vê",
  published: "Publicado — aparece no site",
  archived: "Arquivado — sai do site, histórico preservado",
};

/** "-23.40801, -46.32783" (copiado do Google Maps) ou um link com "@lat,lng". */
function parseCoordinates(text: string): { latitude: string; longitude: string } | null {
  const match =
    text.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/) ??
    text.trim().match(/^(-?\d{1,3}[.,]\d+)\s*[,;\s]\s*(-?\d{1,3}[.,]\d+)$/);
  if (!match) return null;
  return { latitude: match[1].replace(",", "."), longitude: match[2].replace(",", ".") };
}

function Section({
  id,
  title,
  description,
  className,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-24 rounded-[var(--radius-md)] border border-line border-t-[3px] border-t-primary bg-surface p-4 sm:p-6", className)}
    >
      <h2 className="text-lg">{title}</h2>
      {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      <div className="mt-5 grid gap-5">{children}</div>
    </section>
  );
}

const checkboxRow =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] text-sm " +
  "sm:min-h-0";
const checkboxInput = "size-5 shrink-0 rounded-[2px] border-line-strong accent-[var(--color-primary)] sm:size-4";

export function PropertyForm({
  property,
  types,
  regions,
  codeSeries,
  crm,
  before,
  beforeSteps = [],
}: {
  property?: Property | null;
  types: PropertyType[];
  regions: Region[];
  /** Maior número de cada série de código — só no cadastro, para a prévia. */
  codeSeries?: Record<string, number>;
  /** Presente quando o CRM está instalado: libera proprietários e portais. */
  crm?: PropertyCrmData | null;
  /** Blocos com formulário próprio (as fotos), mostrados antes das etapas. */
  before?: React.ReactNode;
  beforeSteps?: ExtraStep[];
}) {
  const [state, action, pending] = useActionState(saveProperty, IDLE_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const dirtyRef = useRef(false);

  const [title, setTitle] = useState(property?.title ?? "");
  const [slug, setSlug] = useState(property?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(property?.slug));
  const [priceOnRequest, setPriceOnRequest] = useState(property?.price_on_request ?? false);
  const [purpose, setPurpose] = useState<"venda" | "locacao">(property?.purpose ?? "venda");
  const [typeId, setTypeId] = useState(property?.property_type_id ?? "");
  const [description, setDescription] = useState(property?.description ?? "");
  const [cep, setCep] = useState(formatCep(property?.zip_code ?? ""));
  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "found" | "not-found">("idle");
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "error">("idle");
  const descriptionBlocks = formatDescription(description);
  const [ownerIds, setOwnerIds] = useState<string[]>(crm?.ownerIds ?? []);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [activeStep, setActiveStep] = useState<string>(beforeSteps[0]?.id ?? "negociacao");

  // Prévia do código que o sistema vai gerar ao salvar um imóvel novo.
  const typeSlug = types.find((type) => type.id === typeId)?.slug ?? null;
  const codePreview = nextPropertyCode(codePrefix(purpose, typeSlug), new Map(Object.entries(codeSeries ?? {})));
  const isNew = !property?.id;

  /* Campos não controlados que as ajudas (CEP, localização) preenchem. */
  function fieldElement(name: string): HTMLInputElement | null {
    const element = formRef.current?.elements.namedItem(name);
    return element instanceof HTMLInputElement ? element : null;
  }

  function setField(name: string, value: string) {
    const element = fieldElement(name);
    if (element) element.value = value;
    dirtyRef.current = true;
  }

  async function fillFromCep(value: string) {
    setCepStatus("loading");
    const address = await lookupCep(value);
    if (!address) {
      setCepStatus("not-found");
      return;
    }

    if (address.city) setField("city", address.city);
    const neighborhood = fieldElement("neighborhood");
    if (address.neighborhood && neighborhood && !neighborhood.value.trim()) setField("neighborhood", address.neighborhood);

    const street = fieldElement("address");
    if (address.street && street && !street.value.trim()) {
      setField("address", `${address.street}, `);
      // Só falta o número: o cursor já vai para lá.
      street.focus();
      street.setSelectionRange(street.value.length, street.value.length);
    }
    setCepStatus("found");
  }

  function fillCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setGeoStatus("error");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setField("latitude", position.coords.latitude.toFixed(7));
        setField("longitude", position.coords.longitude.toFixed(7));
        setGeoStatus("idle");
      },
      () => setGeoStatus("error"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // Erro de validação: leva a pessoa direto ao primeiro campo com problema,
  // em vez de deixá-la procurando numa página longa (no celular, sobretudo).
  useEffect(() => {
    if (state.status !== "error") return;
    dirtyRef.current = true;

    const firstField = Object.keys(state.errors ?? {})[0];
    const element = firstField ? formRef.current?.elements.namedItem(firstField) : null;
    if (element instanceof HTMLElement) {
      element.scrollIntoView({ block: "center", behavior: "smooth" });
      element.focus({ preventScroll: true });
    }
  }, [state]);

  // Aviso ao fechar ou recarregar a aba com alterações não salvas.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const steps: ExtraStep[] = [
    ...beforeSteps,
    { id: "negociacao", label: "Negociação e tipo" },
    { id: "valores", label: "Valores" },
    { id: "localizacao", label: "Localização" },
    { id: "composicao", label: "Composição e medidas" },
    { id: "descricao", label: "Descrição" },
    ...(crm ? [{ id: "proprietarios", label: "Proprietários" }] : []),
    { id: "divulgacao", label: crm ? "Publicação e portais" : "Publicação" },
    { id: "seo", label: "SEO" },
  ];

  // Etapa em destaque no menu acompanha a rolagem: a última cujo topo já
  // passou da linha logo abaixo do cabeçalho fixo. No fim da página, a última.
  const stepIds = steps.map((step) => step.id).join(",");
  useEffect(() => {
    const ids = stepIds.split(",");
    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = ids[0];
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= 140) current = id;
      }
      setActiveStep(atBottom ? ids[ids.length - 1] : current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [stepIds]);

  const submitLabel = isNew ? "Cadastrar e enviar fotos" : "Salvar alterações";
  const clientsById = new Map((crm?.clients ?? []).map((client) => [client.id, client]));
  const ownerOptions = (crm?.clients ?? []).filter(
    (client) =>
      !ownerIds.includes(client.id) &&
      (!ownerFilter.trim() || `${client.name} ${client.phone ?? ""}`.toLowerCase().includes(ownerFilter.trim().toLowerCase()))
  );

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-6">
      {/* Menu de etapas: fixo ao lado no desktop, trilho de atalhos no celular. */}
      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <nav
          aria-label="Etapas do cadastro"
          className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4 lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:rounded-[var(--radius-md)] lg:border lg:border-line lg:bg-surface lg:p-2 lg:px-2"
        >
          {steps.map((step, index) => (
            <a
              key={step.id}
              href={`#${step.id}`}
              aria-current={activeStep === step.id ? "step" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] border px-3 py-2 text-[0.8125rem] transition-colors lg:border-0 lg:border-l-[3px] lg:py-2.5",
                activeStep === step.id
                  ? "border-primary bg-primary-soft font-medium text-primary lg:border-l-primary"
                  : "border-line bg-surface text-ink-soft hover:text-ink lg:border-l-transparent lg:bg-transparent lg:hover:bg-surface-alt"
              )}
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-alt text-[0.625rem] font-semibold text-ink-soft">
                {index + 1}
              </span>
              {step.label}
            </a>
          ))}
        </nav>

        <div className="mt-4 hidden space-y-3 lg:block">
          <Button type="submit" form="property-form" size="md" disabled={pending} aria-busy={pending} className="w-full">
            {pending ? "Salvando…" : submitLabel}
          </Button>
          <FormMessage state={state} />
          {isNew ? <p className="text-xs leading-relaxed text-muted">Ao cadastrar, você vai direto para a tela de fotos.</p> : null}
        </div>
      </aside>

      <div className="min-w-0 space-y-5">
        {/* Filho único do próprio invólucro: elemento vindo do servidor numa
            lista de irmãos dispara o aviso de "key" do React. */}
        {before ? <div>{before}</div> : null}

        <form
          id="property-form"
          ref={formRef}
          // Envio pelo onSubmit, e não por action={...}: com action, o React 19
          // limpa os campos não controlados depois de cada envio — um erro de
          // validação apagava tudo o que tinha sido digitado.
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            dirtyRef.current = false;
            startTransition(() => action(formData));
          }}
          onChange={() => {
            dirtyRef.current = true;
          }}
          className="grid gap-5 pb-28 lg:pb-0"
        >
          {property?.id ? <input type="hidden" name="id" value={property.id} /> : null}
          {crm ? <input type="hidden" name="crm_fields" value="1" /> : null}

          <Section id="negociacao" title="Negociação e tipo">

            <Field label="Título do anúncio" htmlFor="p-titulo" required error={state.errors?.title}>
              <Input
                id="p-titulo"
                name="title"
                required
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  // Sugere o endereço da página enquanto ninguém mexeu nele.
                  if (!slugTouched) setSlug(slugify(event.target.value));
                }}
                placeholder="Casa em condomínio com piscina no Arujá Hills"
                enterKeyHint="next"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Finalidade" htmlFor="p-finalidade" required>
                <Select
                  id="p-finalidade"
                  name="purpose"
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value as "venda" | "locacao")}
                >
                  <option value="venda">Venda</option>
                  <option value="locacao">Locação</option>
                </Select>
              </Field>

              <Field label="Tipo" htmlFor="p-tipo" error={state.errors?.property_type_id}>
                <Select
                  id="p-tipo"
                  name="property_type_id"
                  value={typeId}
                  onChange={(event) => setTypeId(event.target.value)}
                >
                  <option value="">Sem tipo definido</option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Situação" htmlFor="p-situacao" required>
                <Select id="p-situacao" name="status" defaultValue={property?.status ?? "disponivel"}>
                  {PROPERTY_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {property?.id ? (
                <Field
                  label="Código"
                  htmlFor="p-codigo"
                  error={state.errors?.code}
                  hint="Gerado pelo sistema. Altere só para corrigir um código antigo."
                >
                  <Input id="p-codigo" name="code" defaultValue={property.code} />
                </Field>
              ) : (
                <Field
                  label="Código"
                  htmlFor="p-codigo"
                  hint="Gerado automaticamente ao salvar, pela finalidade e pelo tipo."
                >
                  <Input id="p-codigo" value={codePreview} readOnly aria-readonly className="bg-surface-alt text-ink-soft" />
                </Field>
              )}

              <Field
                label="Endereço da página"
                htmlFor="p-slug"
                required
                error={state.errors?.slug}
                hint="Criado a partir do título. Aparece no link: /imoveis/este-texto"
              >
                <Input
                  id="p-slug"
                  name="slug"
                  required
                  value={slug}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setSlug(event.target.value);
                  }}
                  onBlur={(event) => setSlug(slugify(event.target.value))}
                />
              </Field>
            </div>
          </Section>

          <Section id="valores" title="Valores">

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Preço" htmlFor="p-preco" error={state.errors?.price}>
                <DecimalInput
                  id="p-preco"
                  name="price"
                  prefix="R$"
                  disabled={priceOnRequest}
                  defaultValue={property?.price}
                  enterKeyHint="next"
                />
              </Field>

              <Field label="Condomínio (por mês)" htmlFor="p-condominio" error={state.errors?.condo_fee}>
                <DecimalInput id="p-condominio" name="condo_fee" prefix="R$" decimals defaultValue={property?.condo_fee} />
              </Field>

              <Field label="IPTU" htmlFor="p-iptu" error={state.errors?.iptu}>
                <DecimalInput id="p-iptu" name="iptu" prefix="R$" decimals defaultValue={property?.iptu} />
              </Field>
            </div>

            <label className={checkboxRow}>
              <input
                type="checkbox"
                name="price_on_request"
                checked={priceOnRequest}
                onChange={(event) => setPriceOnRequest(event.target.checked)}
                className={checkboxInput}
              />
              Valor sob consulta (o site não mostra o preço)
            </label>
          </Section>

          <Section id="localizacao" title="Localização">

            <div className="grid gap-5 sm:grid-cols-3">
              <Field
                label="CEP"
                htmlFor="p-cep"
                hint={
                  cepStatus === "loading"
                    ? "Buscando endereço…"
                    : cepStatus === "found"
                      ? "Endereço preenchido pelo CEP. Confira e complete o número."
                      : cepStatus === "not-found"
                        ? "Não achamos esse CEP. Preencha o endereço à mão."
                        : "Digite o CEP e o endereço se preenche sozinho."
                }
              >
                <Input
                  id="p-cep"
                  name="zip_code"
                  inputMode="numeric"
                  autoComplete="off"
                  value={cep}
                  onChange={(event) => {
                    const next = formatCep(event.target.value);
                    setCep(next);
                    if (next.replace(/\D/g, "").length === 8 && next !== cep) void fillFromCep(next);
                    else setCepStatus("idle");
                  }}
                  placeholder="07400-560"
                />
              </Field>

              <Field label="Cidade" htmlFor="p-cidade" required error={state.errors?.city} className="sm:col-span-2">
                <Input id="p-cidade" name="city" required defaultValue={property?.city ?? "Arujá"} />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Bairro" htmlFor="p-bairro">
                <Input id="p-bairro" name="neighborhood" defaultValue={property?.neighborhood ?? ""} />
              </Field>

              <Field label="Região do site" htmlFor="p-regiao" hint="Liga o imóvel a uma página de região.">
                <Select id="p-regiao" name="region_id" defaultValue={property?.region_id ?? ""}>
                  <option value="">Nenhuma</option>
                  {regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name} — {region.city}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Endereço" htmlFor="p-endereco" hint="Não aparece inteiro no site se você preferir omitir o número.">
              <Input id="p-endereco" name="address" defaultValue={property?.address ?? ""} />
            </Field>

            <div className="rounded-[var(--radius-sm)] border border-line bg-canvas p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-ink-soft">Posição no mapa</p>
                <button
                  type="button"
                  onClick={fillCurrentLocation}
                  disabled={geoStatus === "loading"}
                  className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-surface px-3 text-[0.8125rem] text-ink transition-colors hover:border-line-strong disabled:opacity-60"
                >
                  <PinIcon className="size-4 text-primary" />
                  {geoStatus === "loading" ? "Localizando…" : "Usar minha localização"}
                </button>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                No imóvel, pelo celular, toque em “Usar minha localização”. Ou cole no campo Latitude as
                coordenadas copiadas do Google Maps (ex.: -23.40801, -46.32783) — as duas se preenchem.
              </p>
              {geoStatus === "error" ? (
                <p role="alert" className="mt-2 text-xs text-danger">
                  Não foi possível obter a localização. Confira se o navegador tem permissão para usá-la.
                </p>
              ) : null}

              <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-5">
                <Field label="Latitude" htmlFor="p-lat" error={state.errors?.latitude}>
                  <Input
                    id="p-lat"
                    name="latitude"
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue={property?.latitude ?? ""}
                    placeholder="-23.4080117"
                    onPaste={(event) => {
                      const coordinates = parseCoordinates(event.clipboardData.getData("text"));
                      if (!coordinates) return;
                      event.preventDefault();
                      setField("latitude", coordinates.latitude);
                      setField("longitude", coordinates.longitude);
                    }}
                  />
                </Field>

                <Field label="Longitude" htmlFor="p-lng" error={state.errors?.longitude}>
                  <Input
                    id="p-lng"
                    name="longitude"
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue={property?.longitude ?? ""}
                    placeholder="-46.3278338"
                  />
                </Field>
              </div>
            </div>
          </Section>

          <Section id="composicao" title="Composição e medidas">

            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-5">
              {[
                { name: "bedrooms", label: "Dormitórios", value: property?.bedrooms },
                { name: "suites", label: "Suítes", value: property?.suites },
                { name: "bathrooms", label: "Banheiros", value: property?.bathrooms },
                { name: "parking_spaces", label: "Vagas", value: property?.parking_spaces },
              ].map((field) => (
                <Field key={field.name} label={field.label} htmlFor={`p-${field.name}`} error={state.errors?.[field.name]}>
                  <NumberStepper
                    id={`p-${field.name}`}
                    name={field.name}
                    defaultValue={field.value}
                    invalid={Boolean(state.errors?.[field.name])}
                  />
                </Field>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-5">
              <Field label="Área do terreno" htmlFor="p-area-total" error={state.errors?.area_total}>
                <DecimalInput id="p-area-total" name="area_total" decimals suffix="m²" defaultValue={property?.area_total} />
              </Field>

              <Field label="Área construída" htmlFor="p-area-construida" error={state.errors?.area_built}>
                <DecimalInput id="p-area-construida" name="area_built" decimals suffix="m²" defaultValue={property?.area_built} />
              </Field>
            </div>

            <div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
              {[
                { name: "in_condo", label: "Fica em condomínio", checked: property?.in_condo },
                { name: "is_furnished", label: "Mobiliado", checked: property?.is_furnished },
              ].map((option) => (
                <label key={option.name} className={checkboxRow}>
                  <input
                    type="checkbox"
                    name={option.name}
                    defaultChecked={option.checked ?? false}
                    className={checkboxInput}
                  />
                  {option.label}
                </label>
              ))}
            </div>

            <Field label="Nome do condomínio" htmlFor="p-condominio-nome">
              <Input id="p-condominio-nome" name="condo_name" defaultValue={property?.condo_name ?? ""} />
            </Field>
          </Section>

          <Section id="descricao" title="Descrição">

            <Field
              label="Descrição"
              htmlFor="p-descricao"
              hint="Separe parágrafos com uma linha em branco; linhas com “-” viram lista. O site padroniza maiúsculas, espaços e pontuação sozinho."
            >
              <Textarea
                id="p-descricao"
                name="description"
                rows={7}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>

            {descriptionBlocks.length ? (
              <details className="group rounded-[var(--radius-sm)] border border-line bg-canvas px-4 py-3 sm:px-5 sm:py-4" open>
                <summary className="label-caps cursor-pointer text-[0.625rem] text-muted">Como vai aparecer no site</summary>
                <DescriptionBlocks blocks={descriptionBlocks} className="mt-3 text-[0.9375rem]" />
              </details>
            ) : null}

            <Field
              label="Composição dos ambientes"
              htmlFor="p-caracteristicas"
              hint="Uma por linha. Aparecem como lista na página do imóvel."
            >
              <Textarea
                id="p-caracteristicas"
                name="highlights"
                rows={8}
                defaultValue={(property?.highlights ?? []).join("\n")}
                placeholder={"3 suítes, sendo 1 master\nSala de estar\nLareira"}
              />
            </Field>
          </Section>

          {crm ? (
            <Section
              id="proprietarios"
              title="Proprietários"
              description="Quem é dono do imóvel. Fica só no painel — nunca aparece no site nem nos portais."
            >
              {ownerIds.map((id) => (
                <input key={id} type="hidden" name="owner_ids" value={id} />
              ))}
              {ownerIds.length ? (
                <ul className="flex flex-wrap gap-2">
                  {ownerIds.map((id) => {
                    const owner = clientsById.get(id);
                    return (
                      <li key={id} className="flex items-center gap-2 rounded-full border border-line bg-canvas py-1 pl-3 pr-1 text-sm">
                        <Link href={`/clientes/${id}`} className="text-ink hover:text-primary">
                          {owner?.name ?? "Cliente"}
                        </Link>
                        {owner?.phone ? <span className="text-xs text-muted">{owner.phone}</span> : null}
                        <button
                          type="button"
                          onClick={() => {
                            setOwnerIds((list) => list.filter((value) => value !== id));
                            dirtyRef.current = true;
                          }}
                          aria-label={`Remover ${owner?.name ?? "proprietário"}`}
                          className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface-alt hover:text-danger"
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">Nenhum proprietário vinculado.</p>
              )}
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="Buscar cliente" htmlFor="p-owner-filtro">
                  <Input id="p-owner-filtro" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} placeholder="Nome ou telefone" />
                </Field>
                <Field label="Adicionar proprietário" htmlFor="p-owner">
                  <Select
                    id="p-owner"
                    value=""
                    onChange={(event) => {
                      const id = event.target.value;
                      if (id) {
                        setOwnerIds((list) => [...list, id]);
                        setOwnerFilter("");
                        dirtyRef.current = true;
                      }
                    }}
                  >
                    <option value="">{ownerOptions.length ? "Escolha na lista…" : "Nenhum cliente encontrado"}</option>
                    {ownerOptions.slice(0, 300).map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                        {client.phone ? ` — ${client.phone}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Link
                  href="/clientes/novo"
                  target="_blank"
                  className="inline-flex h-11 items-center justify-center rounded-[var(--radius-sm)] border border-line px-3 text-[0.8125rem] text-ink-soft hover:border-line-strong hover:text-ink"
                >
                  + Cadastrar cliente
                </Link>
              </div>
            </Section>
          ) : null}

          <Section id="divulgacao" title={crm ? "Publicação e portais" : "Publicação"}>
              <Field label="Estado" htmlFor="p-estado" required>
                <Select id="p-estado" name="publication_state" defaultValue={property?.publication_state ?? "draft"}>
                  {PUBLICATION_STATES.map((value) => (
                    <option key={value} value={value}>
                      {PUBLICATION_LABEL[value]}
                    </option>
                  ))}
                </Select>
              </Field>

              <label className={checkboxRow}>
                <input
                  type="checkbox"
                  name="is_featured"
                  defaultChecked={property?.is_featured ?? false}
                  className={checkboxInput}
                />
                Destacar na página inicial
              </label>


            {crm ? (
              <div className="border-t border-line pt-5">
                <p className="text-sm font-medium text-ink">Anunciar nos portais</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Marcados aqui, o imóvel entra no arquivo XML que o portal lê sozinho. Só vão os publicados, disponíveis e
                  com preço, foto e bairro.
                </p>
                <ul className="mt-4 space-y-4">
                  {PORTAL_IDS.map((portal) => {
                    const current = crm.portals[portal];
                    const issues = crm.portalIssues[portal] ?? [];
                    const enabled = crm.enabledPortals.includes(portal);
                    return (
                      <li key={portal} className="rounded-[var(--radius-sm)] border border-line bg-canvas p-3 sm:p-4">
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                          <label className={checkboxRow}>
                            <input type="checkbox" name={`portal_${portal}`} defaultChecked={current?.listed ?? false} className={checkboxInput} />
                            <span className="font-medium">{PORTALS[portal].name}</span>
                          </label>
                          <label className={cn(checkboxRow, "text-ink-soft")}>
                            <input type="checkbox" name={`portal_${portal}_highlight`} defaultChecked={current?.highlight ?? false} className={checkboxInput} />
                            Anúncio em destaque
                          </label>
                        </div>
                        {!enabled ? (
                          <p className="mt-2 text-xs text-muted">O envio para este portal ainda está desligado na tela Portais.</p>
                        ) : null}
                        {current?.listed && issues.length ? (
                          <p className="mt-2 text-xs text-danger">Hoje não sai no XML: {issues.join(", ")}.</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="lg:hidden">
              <FormMessage state={state} />
            </div>
          </Section>

          {/* Opcional e raramente mexido: fechado para encurtar a página. */}
          <details
            id="seo"
            className="group scroll-mt-24 rounded-[var(--radius-md)] border border-line bg-surface p-4 sm:p-6"
            open={Boolean(property?.seo_title || property?.seo_description)}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block text-lg">SEO</span>
                <span className="mt-1 block text-sm text-ink-soft">
                  Opcional. Em branco, o site gera a partir do título e da descrição.
                </span>
              </span>
              <span aria-hidden className="text-xl text-muted transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="mt-5 grid gap-5">
              <Field label="Título para o Google" htmlFor="p-seo-titulo">
                <Input id="p-seo-titulo" name="seo_title" defaultValue={property?.seo_title ?? ""} maxLength={70} />
              </Field>
              <Field label="Descrição para o Google" htmlFor="p-seo-descricao">
                <Textarea id="p-seo-descricao" name="seo_description" rows={3} defaultValue={property?.seo_description ?? ""} maxLength={180} />
              </Field>
            </div>
          </details>

        {/* Barra fixa de salvar no celular: o botão fica sempre à mão, sem
            rolar até o fim de um formulário comprido. */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgb(0_0_0/0.06)] backdrop-blur lg:hidden">
          {state.status !== "idle" && state.message ? (
            <p
              role="status"
              aria-live="polite"
              className={cn("mb-2 text-center text-[0.8125rem]", state.status === "error" ? "text-danger" : "text-primary")}
            >
              {state.message}
            </p>
          ) : null}
          <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full">
            {pending ? "Salvando…" : submitLabel}
          </Button>
        </div>
        </form>
      </div>
    </div>
  );
}
