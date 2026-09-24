import Link from "next/link";

import { getAdminSession, requireStaff } from "@/lib/auth";
import { listLeads } from "@/lib/queries/admin";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/site";
import { formatDateTime, phoneHref, whatsappUrl } from "@/lib/format";
import { buildQuery, cn, firstParam } from "@/lib/utils";

import { Badge, EmptyState, Select } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/pagination";
import { WhatsAppIcon, MailIcon, PhoneIcon } from "@/components/ui/icons";
import { updateLeadStatus, saveLeadNotes, deleteLead } from "@/actions/admin/leads";
import { LeadNotes } from "@/components/admin/lead-notes";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  site_imovel: "Interesse em imóvel",
  site_contato: "Contato",
  site_venda_imovel: "Venda seu imóvel",
  site: "Site",
};

const STATUS_TONE: Record<LeadStatus, "gold" | "primary" | "muted"> = {
  novo: "gold",
  em_atendimento: "primary",
  concluido: "muted",
  arquivado: "muted",
};

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("/admin/leads");
  const [params, session] = await Promise.all([searchParams, getAdminSession()]);

  const status = firstParam(params.status);
  const source = firstParam(params.origem);
  const page = Number(firstParam(params.pagina) ?? 1) || 1;

  const result = await listLeads({ status, source, page });

  return (
    <div>
      <header>
        <h1 className="text-3xl">Contatos</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          {result.total} {result.total === 1 ? "contato recebido" : "contatos recebidos"} pelo site
        </p>
      </header>

      <nav aria-label="Filtrar por situação" className="mt-6 flex flex-wrap gap-1.5">
        {[{ value: "", label: "Todos" }, ...LEAD_STATUSES.map((value) => ({ value, label: LEAD_STATUS_LABEL[value] }))].map(
          (option) => (
            <Link
              key={option.value || "todos"}
              href={`/admin/leads${buildQuery({ status: option.value || undefined, origem: source })}`}
              aria-current={(status ?? "") === option.value ? "true" : undefined}
              className={cn(
                "rounded-[var(--radius-sm)] border px-3 py-1.5 text-[0.8125rem] transition-colors",
                (status ?? "") === option.value
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-line text-ink-soft hover:border-line-strong hover:text-ink"
              )}
            >
              {option.label}
            </Link>
          )
        )}
      </nav>

      {result.items.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="Nenhum contato por aqui"
          description={
            status || source
              ? "Nenhum contato com esse filtro."
              : "Quando alguém enviar um formulário no site, a mensagem aparece aqui."
          }
        />
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {result.items.map((lead) => {
              const whatsapp = whatsappUrl(
                lead.phone,
                lead.property_code
                  ? `Olá ${lead.name.split(" ")[0]}, aqui é da Vale do Sol Imóveis. Recebemos seu contato sobre o imóvel ${lead.property_code}.`
                  : `Olá ${lead.name.split(" ")[0]}, aqui é da Vale do Sol Imóveis. Recebemos seu contato pelo site.`
              );
              const details = Object.entries(lead.details ?? {}).filter(([, value]) => value);

              return (
                <li
                  key={lead.id}
                  className="rounded-[var(--radius-md)] border border-line bg-surface p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg">{lead.name}</h2>
                        <Badge tone={STATUS_TONE[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</Badge>
                        <Badge tone="muted">{SOURCE_LABEL[lead.source] ?? lead.source}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted">{formatDateTime(lead.created_at)}</p>
                    </div>

                    <form action={updateLeadStatus} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={lead.id} />
                      <label htmlFor={`status-${lead.id}`} className="sr-only">
                        Situação do contato
                      </label>
                      <Select
                        id={`status-${lead.id}`}
                        name="status"
                        defaultValue={lead.status}
                        className="h-9 w-44 text-[0.8125rem]"
                      >
                        {LEAD_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {LEAD_STATUS_LABEL[value]}
                          </option>
                        ))}
                      </Select>
                      <button
                        type="submit"
                        className="h-9 rounded-[var(--radius-sm)] border border-line px-3 text-xs text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
                      >
                        Salvar
                      </button>
                    </form>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    <a
                      href={phoneHref(lead.phone) ?? "#"}
                      className="flex items-center gap-1.5 text-ink transition-colors hover:text-primary"
                    >
                      <PhoneIcon className="size-4 text-muted" />
                      {lead.phone}
                    </a>

                    {whatsapp ? (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-primary transition-colors hover:text-primary-hover"
                      >
                        <WhatsAppIcon className="size-4" />
                        Responder no WhatsApp
                      </a>
                    ) : null}

                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        className="flex items-center gap-1.5 text-ink-soft transition-colors hover:text-primary"
                      >
                        <MailIcon className="size-4 text-muted" />
                        {lead.email}
                      </a>
                    ) : null}
                  </div>

                  {lead.property ? (
                    <p className="mt-3 text-sm text-ink-soft">
                      Imóvel:{" "}
                      <Link href={`/imoveis/${lead.property.slug}`} className="text-primary underline-offset-4 hover:underline">
                        {lead.property.code} — {lead.property.title}
                      </Link>
                    </p>
                  ) : lead.property_code ? (
                    <p className="mt-3 text-sm text-ink-soft">Imóvel: {lead.property_code} (fora do ar)</p>
                  ) : null}

                  {lead.message ? (
                    <p className="mt-3 whitespace-pre-line rounded-[var(--radius-sm)] bg-canvas px-4 py-3 text-sm leading-relaxed text-ink-soft">
                      {lead.message}
                    </p>
                  ) : null}

                  {details.length ? (
                    <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                      {details.map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <dt className="text-muted">{key.replace(/_/g, " ")}:</dt>
                          <dd className="text-ink-soft">{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}

                  {lead.attachments?.length ? (
                    <p className="mt-3 text-sm text-ink-soft">
                      {lead.attachments.length}{" "}
                      {lead.attachments.length === 1 ? "arquivo enviado" : "arquivos enviados"} —
                      disponíveis no Storage do Supabase, em <code className="text-xs">lead-uploads</code>.
                    </p>
                  ) : null}

                  <LeadNotes id={lead.id} notes={lead.notes} action={saveLeadNotes} />

                  {session?.profile.role === "admin" ? (
                    <form action={deleteLead} className="mt-3">
                      <input type="hidden" name="id" value={lead.id} />
                      <button
                        type="submit"
                        className="text-xs text-muted transition-colors hover:text-danger"
                      >
                        Excluir este contato
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <Pagination
            className="mt-8"
            page={result.page}
            pageCount={result.pageCount}
            buildHref={(target) =>
              `/admin/leads${buildQuery({ status, origem: source, pagina: target > 1 ? target : undefined })}`
            }
          />
        </>
      )}
    </div>
  );
}
