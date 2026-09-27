import Image from "next/image";
import Link from "next/link";

import { requireStaff } from "@/lib/auth";
import { listAdminProperties } from "@/lib/queries/admin";
import { storageUrl } from "@/lib/supabase/public";
import { PROPERTY_STATUSES, SITE, STATUS_LABEL, STORAGE_BUCKETS } from "@/lib/site";
import { formatDate, formatPrice } from "@/lib/format";
import { buildQuery, cn, firstParam } from "@/lib/utils";

import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, Input, Select } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/pagination";
import { setPublicationState } from "@/actions/admin/properties";

export const dynamic = "force-dynamic";

const STATE_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

export default async function AdminPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("/imoveis");
  const params = await searchParams;

  const search = firstParam(params.busca);
  const state = firstParam(params.estado);
  const status = firstParam(params.status);
  const page = Number(firstParam(params.pagina) ?? 1) || 1;

  const result = await listAdminProperties({ search, state, status, page });

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Imóveis</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            {result.total} {result.total === 1 ? "imóvel" : "imóveis"} no cadastro
          </p>
        </div>
        <ButtonLink href="/imoveis/novo">+ Novo imóvel</ButtonLink>
      </header>

      {firstParam(params.excluido) ? (
        <p role="status" className="mt-6 rounded-[var(--radius-sm)] border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-primary">
          Imóvel excluído.
        </p>
      ) : null}

      <form
        method="get"
        className="mt-6 grid grid-cols-2 items-end gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4 md:flex md:flex-wrap"
      >
        <div className="col-span-2 md:min-w-56 md:flex-1">
          <label htmlFor="busca" className="mb-1.5 block text-[0.8125rem] font-medium text-ink-soft">
            Buscar
          </label>
          <Input id="busca" name="busca" type="search" enterKeyHint="search" defaultValue={search ?? ""} placeholder="Título, código ou bairro" />
        </div>

        <div>
          <label htmlFor="estado" className="mb-1.5 block text-[0.8125rem] font-medium text-ink-soft">
            Publicação
          </label>
          <Select id="estado" name="estado" defaultValue={state ?? ""}>
            <option value="">Todos</option>
            {Object.entries(STATE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label htmlFor="status" className="mb-1.5 block text-[0.8125rem] font-medium text-ink-soft">
            Situação
          </label>
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Todas</option>
            {PROPERTY_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </Select>
        </div>

        <button
          type="submit"
          className="h-11 rounded-[var(--radius-sm)] bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Filtrar
        </button>

        {search || state || status ? (
          <Link href="/imoveis" className="h-11 px-3 text-center text-sm leading-[2.75rem] text-ink-soft hover:text-ink">
            Limpar
          </Link>
        ) : null}
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          className="mt-8"
          title={search || state || status ? "Nenhum imóvel com esses filtros" : "Nenhum imóvel cadastrado"}
          description={
            search || state || status
              ? "Tente outra busca ou limpe os filtros."
              : "Cadastre o primeiro imóvel para ele aparecer no site."
          }
          action={<ButtonLink href="/imoveis/novo">Cadastrar imóvel</ButtonLink>}
        />
      ) : (
        <>
          {/* Celular: um cartão por imóvel, com os botões grandes o bastante para o dedo. */}
          <ul className="mt-5 space-y-3 md:hidden">
            {result.items.map((property) => {
              const cover = storageUrl(STORAGE_BUCKETS.property, property.images?.[0]?.storage_path);
              const published = property.publication_state === "published";

              return (
                <li key={property.id} className="overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface">
                  <Link href={`/imoveis/${property.id}`} className="flex gap-3 p-3 active:bg-canvas">
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-[var(--radius-xs)] bg-surface-alt">
                      {cover ? <Image src={cover} alt="" fill sizes="80px" className="object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[0.9375rem] font-medium leading-snug text-ink">{property.title}</p>
                      <p className="mt-1 truncate text-xs text-muted">
                        {property.code}
                        {property.neighborhood ? ` · ${property.neighborhood}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone={published ? "primary" : property.publication_state === "draft" ? "gold" : "muted"}>
                          {STATE_LABEL[property.publication_state]}
                        </Badge>
                        <span className="text-[0.8125rem] text-ink-soft">
                          {formatPrice(property.price, {
                            purpose: property.purpose,
                            onRequest: property.price_on_request,
                          })}
                        </span>
                      </div>
                    </div>
                  </Link>

                  <div className="grid grid-cols-2 border-t border-line text-[0.8125rem]">
                    <form action={setPublicationState} className="border-r border-line">
                      <input type="hidden" name="id" value={property.id} />
                      <input type="hidden" name="state" value={published ? "draft" : "published"} />
                      <button
                        type="submit"
                        className={cn(
                          "h-11 w-full transition-colors",
                          published ? "text-ink-soft active:bg-surface-alt" : "font-medium text-primary active:bg-primary-soft"
                        )}
                      >
                        {published ? "Despublicar" : "Publicar"}
                      </button>
                    </form>
                    <Link
                      href={`/imoveis/${property.id}`}
                      className="grid h-11 place-items-center text-ink-soft active:bg-surface-alt"
                    >
                      Editar e fotos
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 hidden overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Imóveis cadastrados</caption>
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Imóvel</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Preço</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">Situação</th>
                  <th scope="col" className="px-4 py-3 font-medium">Publicação</th>
                  <th scope="col" className="hidden px-4 py-3 font-medium xl:table-cell">Atualizado</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.map((property) => {
                  const cover = storageUrl(STORAGE_BUCKETS.property, property.images?.[0]?.storage_path);

                  return (
                    <tr key={property.id} className="hover:bg-canvas">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative size-12 shrink-0 overflow-hidden rounded-[var(--radius-xs)] bg-surface-alt">
                            {cover ? (
                              <Image src={cover} alt="" fill sizes="48px" className="object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/imoveis/${property.id}`}
                              className="block truncate font-medium text-ink hover:text-primary"
                            >
                              {property.title}
                            </Link>
                            <p className="truncate text-xs text-muted">
                              {property.code}
                              {property.neighborhood ? ` · ${property.neighborhood}` : ""}
                              {property.is_featured ? " · destaque" : ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="hidden whitespace-nowrap px-4 py-3 text-ink-soft md:table-cell">
                        {formatPrice(property.price, {
                          purpose: property.purpose,
                          onRequest: property.price_on_request,
                        })}
                      </td>

                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span className="text-ink-soft">{STATUS_LABEL[property.status]}</span>
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            property.publication_state === "published"
                              ? "primary"
                              : property.publication_state === "draft"
                                ? "gold"
                                : "muted"
                          }
                        >
                          {STATE_LABEL[property.publication_state]}
                        </Badge>
                      </td>

                      <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-muted xl:table-cell">
                        {formatDate(property.updated_at)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <form action={setPublicationState}>
                            <input type="hidden" name="id" value={property.id} />
                            <input
                              type="hidden"
                              name="state"
                              value={property.publication_state === "published" ? "draft" : "published"}
                            />
                            <button
                              type="submit"
                              className={cn(
                                "whitespace-nowrap rounded-[var(--radius-xs)] px-2.5 py-1.5 text-xs transition-colors",
                                property.publication_state === "published"
                                  ? "text-ink-soft hover:bg-surface-alt"
                                  : "bg-primary-soft text-primary hover:bg-primary hover:text-white"
                              )}
                            >
                              {property.publication_state === "published" ? "Despublicar" : "Publicar"}
                            </button>
                          </form>

                          <Link
                            href={`/imoveis/${property.id}`}
                            className="whitespace-nowrap rounded-[var(--radius-xs)] px-2.5 py-1.5 text-xs text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink"
                          >
                            Editar
                          </Link>

                          {property.publication_state === "published" ? (
                            <a
                              href={`${SITE.url}/imoveis/${property.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="whitespace-nowrap rounded-[var(--radius-xs)] px-2.5 py-1.5 text-xs text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink"
                            >
                              Ver
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            className="mt-8"
            page={result.page}
            pageCount={result.pageCount}
            buildHref={(target) =>
              `/imoveis${buildQuery({ busca: search, estado: state, status, pagina: target > 1 ? target : undefined })}`
            }
          />
        </>
      )}
    </div>
  );
}
