"use client";

import { useActionState, useState } from "react";
import { saveProperty } from "@/actions/admin/properties";
import { IDLE_STATE } from "@/lib/validations/lead";
import { slugify } from "@/lib/format";
import { codePrefix, nextPropertyCode } from "@/lib/property-code";
import { PROPERTY_STATUSES, PUBLICATION_STATES, STATUS_LABEL } from "@/lib/site";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { FormMessage, SubmitButton } from "@/components/forms/form-parts";
import type { Property, PropertyType, Region } from "@/types/database";

const PUBLICATION_LABEL: Record<(typeof PUBLICATION_STATES)[number], string> = {
  draft: "Rascunho — só você vê",
  published: "Publicado — aparece no site",
  archived: "Arquivado — sai do site, histórico preservado",
};

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-line bg-surface p-6">
      <h2 className="text-lg">{title}</h2>
      {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      <div className="mt-5 grid gap-5">{children}</div>
    </section>
  );
}

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
  const [state, action] = useActionState(saveProperty, IDLE_STATE);
  const [title, setTitle] = useState(property?.title ?? "");
  const [slug, setSlug] = useState(property?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(property?.slug));
  const [priceOnRequest, setPriceOnRequest] = useState(property?.price_on_request ?? false);
  const [purpose, setPurpose] = useState<"venda" | "locacao">(property?.purpose ?? "venda");
  const [typeId, setTypeId] = useState(property?.property_type_id ?? "");

  // Prévia do código que o sistema vai gerar ao salvar um imóvel novo.
  const typeSlug = types.find((type) => type.id === typeId)?.slug ?? null;
  const codePreview = nextPropertyCode(codePrefix(purpose, typeSlug), new Map(Object.entries(codeSeries ?? {})));

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-3">
      {property?.id ? <input type="hidden" name="id" value={property.id} /> : null}

      <div className="grid gap-5 lg:col-span-2">
        <Section title="Identificação">
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
            />
          </Field>

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
              hint="Aparece no link: /imoveis/este-texto"
            >
              <Input
                id="p-slug"
                name="slug"
                required
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                }}
                onBlur={(event) => setSlug(slugify(event.target.value))}
              />
            </Field>
          </div>

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
        </Section>

        <Section title="Valores">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Preço (R$)" htmlFor="p-preco" error={state.errors?.price}>
              <Input
                id="p-preco"
                name="price"
                inputMode="numeric"
                disabled={priceOnRequest}
                defaultValue={property?.price ?? ""}
                placeholder="1190000"
              />
            </Field>

            <Field label="Condomínio (R$/mês)" htmlFor="p-condominio" error={state.errors?.condo_fee}>
              <Input id="p-condominio" name="condo_fee" inputMode="numeric" defaultValue={property?.condo_fee ?? ""} />
            </Field>

            <Field label="IPTU (R$)" htmlFor="p-iptu" error={state.errors?.iptu}>
              <Input id="p-iptu" name="iptu" inputMode="numeric" defaultValue={property?.iptu ?? ""} />
            </Field>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="price_on_request"
              checked={priceOnRequest}
              onChange={(event) => setPriceOnRequest(event.target.checked)}
              className="size-4 rounded-[2px] border-line-strong accent-[var(--color-primary)]"
            />
            Valor sob consulta (o site não mostra o preço)
          </label>
        </Section>

        <Section title="Localização">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Cidade" htmlFor="p-cidade" required error={state.errors?.city}>
              <Input id="p-cidade" name="city" required defaultValue={property?.city ?? "Arujá"} />
            </Field>

            <Field label="Bairro" htmlFor="p-bairro">
              <Input id="p-bairro" name="neighborhood" defaultValue={property?.neighborhood ?? ""} />
            </Field>
          </div>

          <Field label="Endereço" htmlFor="p-endereco" hint="Não aparece inteiro no site se você preferir omitir o número.">
            <Input id="p-endereco" name="address" defaultValue={property?.address ?? ""} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="CEP" htmlFor="p-cep">
              <Input id="p-cep" name="zip_code" defaultValue={property?.zip_code ?? ""} placeholder="07400-560" />
            </Field>

            <Field label="Latitude" htmlFor="p-lat" error={state.errors?.latitude}>
              <Input id="p-lat" name="latitude" defaultValue={property?.latitude ?? ""} placeholder="-23.4080117" />
            </Field>

            <Field label="Longitude" htmlFor="p-lng" error={state.errors?.longitude}>
              <Input id="p-lng" name="longitude" defaultValue={property?.longitude ?? ""} placeholder="-46.3278338" />
            </Field>
          </div>

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
        </Section>

        <Section title="Características">
          <div className="grid gap-5 sm:grid-cols-4">
            {[
              { name: "bedrooms", label: "Dormitórios", value: property?.bedrooms },
              { name: "suites", label: "Suítes", value: property?.suites },
              { name: "bathrooms", label: "Banheiros", value: property?.bathrooms },
              { name: "parking_spaces", label: "Vagas", value: property?.parking_spaces },
            ].map((field) => (
              <Field key={field.name} label={field.label} htmlFor={`p-${field.name}`} error={state.errors?.[field.name]}>
                <Input
                  id={`p-${field.name}`}
                  name={field.name}
                  type="number"
                  min={0}
                  max={99}
                  defaultValue={field.value ?? ""}
                />
              </Field>
            ))}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Área do terreno (m²)" htmlFor="p-area-total" error={state.errors?.area_total}>
              <Input id="p-area-total" name="area_total" inputMode="decimal" defaultValue={property?.area_total ?? ""} />
            </Field>

            <Field label="Área construída (m²)" htmlFor="p-area-construida" error={state.errors?.area_built}>
              <Input id="p-area-construida" name="area_built" inputMode="decimal" defaultValue={property?.area_built ?? ""} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { name: "in_condo", label: "Fica em condomínio", checked: property?.in_condo },
              { name: "is_furnished", label: "Mobiliado", checked: property?.is_furnished },
            ].map((option) => (
              <label key={option.name} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  name={option.name}
                  defaultChecked={option.checked ?? false}
                  className="size-4 rounded-[2px] border-line-strong accent-[var(--color-primary)]"
                />
                {option.label}
              </label>
            ))}
          </div>

          <Field label="Nome do condomínio" htmlFor="p-condominio-nome">
            <Input id="p-condominio-nome" name="condo_name" defaultValue={property?.condo_name ?? ""} />
          </Field>
        </Section>

        <Section title="Texto do anúncio">
          <Field label="Descrição" htmlFor="p-descricao" hint="Separe parágrafos com uma linha em branco.">
            <Textarea id="p-descricao" name="description" rows={7} defaultValue={property?.description ?? ""} />
          </Field>

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

        <Section title="SEO" description="Opcional. Em branco, o site gera a partir do título e da descrição.">
          <Field label="Título para o Google" htmlFor="p-seo-titulo">
            <Input id="p-seo-titulo" name="seo_title" defaultValue={property?.seo_title ?? ""} maxLength={70} />
          </Field>
          <Field label="Descrição para o Google" htmlFor="p-seo-descricao">
            <Textarea id="p-seo-descricao" name="seo_description" rows={3} defaultValue={property?.seo_description ?? ""} maxLength={180} />
          </Field>
        </Section>
      </div>

      {/* Coluna de publicação */}
      <div className="lg:col-span-1">
        <div className="sticky top-6 space-y-5">
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

            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="is_featured"
                defaultChecked={property?.is_featured ?? false}
                className="size-4 rounded-[2px] border-line-strong accent-[var(--color-primary)]"
              />
              Destacar na página inicial
            </label>

            <FormMessage state={state} />

            <SubmitButton className="w-full">
              {property?.id ? "Salvar alterações" : "Cadastrar imóvel"}
            </SubmitButton>

            {!property?.id ? (
              <p className="text-xs leading-relaxed text-muted">
                Depois de cadastrar, você envia as fotos na tela de edição.
              </p>
            ) : null}
          </Section>
        </div>
      </div>
    </form>
  );
}
