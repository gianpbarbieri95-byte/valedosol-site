import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { CrmNotInstalledError, listClients } from "@/lib/queries/crm";
import { CLIENT_KINDS, CLIENT_KIND_LABEL, OPEN_STAGES } from "@/lib/crm";
import { formatLocalDay } from "@/lib/datetime";
import { phoneHref, whatsappUrl } from "@/lib/format";
import { buildQuery, firstParam } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Input, Select } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/pagination";
import { WhatsAppIcon } from "@/components/ui/icons";
import { CrmPendingNotice, FlashMessage, PageHeader, Pill } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("/clientes");
  const params = await searchParams;
  const search = firstParam(params.busca);
  const kind = firstParam(params.perfil);
  const page = Number(firstParam(params.pagina) ?? 1) || 1;

  let result: Awaited<ReturnType<typeof listClients>>;
  try {
    result = await listClients({ search, kind: kind && (CLIENT_KINDS as readonly string[]).includes(kind) ? kind : undefined, page });
  } catch (error) {
    if (error instanceof CrmNotInstalledError) {
      return (
        <div>
          <PageHeader title="Clientes" />
          <CrmPendingNotice />
        </div>
      );
    }
    throw error;
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        description={`${result.total} ${result.total === 1 ? "cliente" : "clientes"} no cadastro`}
        actions={
          <>
            <ButtonLink href="/leads" variant="outline" size="sm">
              Contatos do site
            </ButtonLink>
            <ButtonLink href="/clientes/novo" size="sm">
              + Novo cliente
            </ButtonLink>
          </>
        }
      />

      <FlashMessage message={firstParam(params.ok) === "excluido" ? "Cliente excluído." : null} />

      <form method="get" className="grid grid-cols-2 items-end gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4 md:flex md:flex-wrap">
        <div className="col-span-2 md:min-w-64 md:flex-1">
          <label htmlFor="busca" className="mb-1.5 block text-[0.8125rem] font-medium text-ink-soft">
            Buscar
          </label>
          <Input id="busca" name="busca" type="search" enterKeyHint="search" defaultValue={search ?? ""} placeholder="Nome, telefone, e-mail ou documento" />
        </div>
        <div>
          <label htmlFor="perfil" className="mb-1.5 block text-[0.8125rem] font-medium text-ink-soft">
            Perfil
          </label>
          <Select id="perfil" name="perfil" defaultValue={kind ?? ""}>
            <option value="">Todos</option>
            {CLIENT_KINDS.map((value) => (
              <option key={value} value={value}>
                {CLIENT_KIND_LABEL[value]}
              </option>
            ))}
          </Select>
        </div>
        <button type="submit" className="h-11 rounded-[var(--radius-sm)] bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover">
          Filtrar
        </button>
        {search || kind ? (
          <Link href="/clientes" className="h-11 px-3 text-center text-sm leading-[2.75rem] text-ink-soft hover:text-ink">
            Limpar
          </Link>
        ) : null}
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          className="mt-6"
          title={search || kind ? "Nenhum cliente com esses filtros" : "Nenhum cliente cadastrado"}
          description={
            search || kind
              ? "Tente outra busca ou limpe os filtros."
              : "Cadastre compradores, locatários e proprietários — ou transforme um contato do site em cliente."
          }
          action={<ButtonLink href="/clientes/novo">Cadastrar cliente</ButtonLink>}
        />
      ) : (
        <div className="mt-6 overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface">
          <ul className="divide-y divide-line">
            {result.items.map((client) => {
              const open = client.deals.filter((deal) => (OPEN_STAGES as readonly string[]).includes(deal.stage)).length;
              const tel = phoneHref(client.phone);
              const whatsapp = whatsappUrl(client.phone);
              return (
                <li key={client.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
                  <Link href={`/clientes/${client.id}`} className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-ink">{client.name}</span>
                      {client.kinds.map((value) => (
                        <Pill key={value} tone={value === "proprietario" ? "gold" : "primary"}>
                          {CLIENT_KIND_LABEL[value]}
                        </Pill>
                      ))}
                    </p>
                    <p className="mt-1 truncate text-sm text-ink-soft">
                      {[client.phone, client.email].filter(Boolean).join(" · ") || "Sem contato"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Desde {formatLocalDay(client.created_at)}
                      {client.source ? ` · ${client.source}` : ""}
                      {open ? ` · ${open} ${open === 1 ? "negócio aberto" : "negócios abertos"}` : ""}
                    </p>
                  </Link>
                  <div className="flex gap-2">
                    {whatsapp ? (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] border border-line px-3 text-[0.8125rem] text-ink-soft hover:border-line-strong hover:text-ink"
                      >
                        <WhatsAppIcon className="size-4" /> WhatsApp
                      </a>
                    ) : null}
                    {tel ? (
                      <a href={tel} className="inline-flex h-10 items-center rounded-[var(--radius-sm)] border border-line px-3 text-[0.8125rem] text-ink-soft hover:border-line-strong hover:text-ink">
                        Ligar
                      </a>
                    ) : null}
                    <Link
                      href={`/negocios/novo?cliente=${client.id}`}
                      className="inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-primary-soft px-3 text-[0.8125rem] font-medium text-primary hover:bg-primary hover:text-white"
                    >
                      + Negócio
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {result.pageCount > 1 ? (
        <Pagination
          className="mt-8"
          page={result.page}
          pageCount={result.pageCount}
          buildHref={(target) => `/clientes${buildQuery({ busca: search, perfil: kind, pagina: target > 1 ? target : undefined })}`}
        />
      ) : null}
    </div>
  );
}
