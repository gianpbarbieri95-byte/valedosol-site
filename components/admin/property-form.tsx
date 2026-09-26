"use client";

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
import type { Property, PropertyType, Region } from "@/types/database";

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
      className={cn("scroll-mt-20 rounded-[var(--radius-md)] border border-line bg-surface p-4 sm:p-6", className)}
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
}: {
  property?: Property | null;
  types: PropertyType[];
  regions: Region[];
  /** Maior número de cada série de código — só no cadastro, para a prévia. */
  codeSeries?: Record<string, number>;
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

  const submitLabel = isNew ? "Cadastrar e enviar fotos" : "Salvar alterações";

  return (
    <form
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
      className="grid gap-4 pb-28 sm:gap-5 lg:grid-cols-3 lg:pb-0"
    >
      {property?.id ? <input type="hidden" name="id" value={property.id} /> : null}

      <div className="grid gap-4 sm:gap-5 lg:col-span-2">
        <Section id="dados" title="Identificação">
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

        <Section id="caracteristicas" title="Características">
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

        <Section id="texto" title="Texto do anúncio">
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

        {/* Opcional e raramente mexido: fechado para encurtar a página. */}
        <details
          className="group scroll-mt-20 rounded-[var(--radius-md)] border border-line bg-surface p-4 sm:p-6"
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
      </div>

      {/* Coluna de publicação. No celular, na edição, sobe para o topo:
          publicar é o que mais se faz depois de enviar as fotos. */}
      <div className={cn("lg:col-span-1", !isNew && "order-first lg:order-none")}>
        <div className="space-y-5 lg:sticky lg:top-6">
          <Section title="Publicação">
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

            <FormMessage state={state} />

            {/* No celular quem salva é a barra fixa lá embaixo. */}
            <div className="hidden lg:block">
              <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="w-full">
                {pending ? "Salvando…" : submitLabel}
              </Button>
            </div>

            {isNew ? (
              <p className="text-xs leading-relaxed text-muted">
                Ao cadastrar, você vai direto para a tela de fotos.
              </p>
            ) : null}
          </Section>
        </div>
      </div>

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
  );
}
