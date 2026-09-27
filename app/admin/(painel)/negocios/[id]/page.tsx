import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminSession, requireStaff } from "@/lib/auth";
import { CrmNotInstalledError, getDeal, getStaffDirectory, listClientOptions, listOpenDealOptions } from "@/lib/queries/crm";
import { listPropertyOptions } from "@/lib/queries/admin";
import { closeDeal, deleteDeal, toggleActivityDone } from "@/actions/admin/crm";
import { ACTIVITY_KIND_LABEL, DEAL_STAGE_LABEL, OPEN_STAGES } from "@/lib/crm";
import { addLocalDays, formatLocalDateTime, formatLocalDay, startOfLocalDay, toLocalInput, zonedParts, zonedToDate } from "@/lib/datetime";
import { formatPrice, phoneHref, whatsappUrl } from "@/lib/format";
import { SITE } from "@/lib/site";
import { firstParam } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/ui/icons";
import { ActivityForm, DealForm } from "@/components/admin/crm-forms";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { CrmPendingNotice, FlashMessage, PageHeader, Panel, Pill } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const OK_MESSAGE: Record<string, string> = {
  criado: "Negócio criado.",
  convertido: "Contato do site transformado em cliente e negócio. Ele já está na coluna “Qualificando”.",
  ganho: "Parabéns! Negócio marcado como ganho.",
  perdido: "Negócio marcado como perdido.",
  reabrir: "Negócio reaberto em “Negociando”.",
  existente: "Este contato já estava no funil — abrimos o negócio existente.",
};

export default async function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  await requireStaff(`/negocios/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const query = await searchParams;

  let deal: Awaited<ReturnType<typeof getDeal>>;
  try {
    deal = await getDeal(id);
  } catch (error) {
    if (error instanceof CrmNotInstalledError) return <CrmPendingNotice />;
    throw error;
  }
  if (!deal) notFound();

  const [clients, properties, staff, openDeals, session] = await Promise.all([
    listClientOptions(),
    listPropertyOptions(),
    getStaffDirectory(),
    listOpenDealOptions(),
    getAdminSession(),
  ]);

  const isOpen = (OPEN_STAGES as readonly string[]).includes(deal.stage);
  const client = deal.client;
  const whatsapp = whatsappUrl(client?.phone);
  const tel = phoneHref(client?.phone);
  // Sugestão para a próxima atividade: amanhã às 10h.
  const tomorrow = zonedParts(addLocalDays(startOfLocalDay(), 1));
  const suggestion = toLocalInput(zonedToDate(tomorrow.year, tomorrow.month, tomorrow.day, 10));
  const dealOptions = openDeals.some((option) => option.id === deal.id)
    ? openDeals
    : [{ id: deal.id, title: deal.title, client: client ? { name: client.name } : null }, ...openDeals];

  return (
    <div>
      <PageHeader
        title={deal.title}
        breadcrumb={[{ href: deal.closed_at ? "/negocios?fechados=1" : "/negocios", label: "Negócios" }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={deal.stage === "ganho" ? "success" : deal.stage === "perdido" ? "danger" : "primary"}>{DEAL_STAGE_LABEL[deal.stage]}</Pill>
            <span className="text-muted">
              Aberto em {formatLocalDay(deal.created_at)}
              {deal.closed_at ? ` · fechado em ${formatLocalDay(deal.closed_at)}` : ""}
            </span>
          </span>
        }
        actions={
          isOpen ? (
            <>
              <form action={closeDeal}>
                <input type="hidden" name="id" value={deal.id} />
                <input type="hidden" name="outcome" value="ganho" />
                <button type="submit" className="inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover">
                  Marcar como ganho
                </button>
              </form>
              <details className="relative">
                <summary className="inline-flex h-10 cursor-pointer list-none items-center rounded-[var(--radius-sm)] border border-line bg-surface px-4 text-sm text-ink-soft hover:border-line-strong [&::-webkit-details-marker]:hidden">
                  Marcar como perdido
                </summary>
                <form action={closeDeal} className="absolute right-0 z-10 mt-2 w-72 space-y-3 rounded-[var(--radius-md)] border border-line bg-surface p-4 shadow-float">
                  <input type="hidden" name="id" value={deal.id} />
                  <input type="hidden" name="outcome" value="perdido" />
                  <label htmlFor="motivo" className="block text-[0.8125rem] font-medium text-ink-soft">
                    Motivo (opcional)
                  </label>
                  <input id="motivo" name="lost_reason" className="h-10 w-full rounded-[var(--radius-sm)] border border-line px-3 text-sm" placeholder="Comprou com outra imobiliária…" />
                  <button type="submit" className="h-10 w-full rounded-[var(--radius-sm)] bg-danger text-sm font-medium text-white">
                    Confirmar perda
                  </button>
                </form>
              </details>
            </>
          ) : (
            <form action={closeDeal}>
              <input type="hidden" name="id" value={deal.id} />
              <input type="hidden" name="outcome" value="reabrir" />
              <button type="submit" className="inline-flex h-10 items-center rounded-[var(--radius-sm)] border border-line bg-surface px-4 text-sm text-ink hover:border-line-strong">
                Reabrir negócio
              </button>
            </form>
          )
        }
      />

      <FlashMessage message={OK_MESSAGE[firstParam(query.ok) ?? ""] ?? null} />
      <FlashMessage tone="error" message={firstParam(query.erro) === "excluir" ? "Não foi possível excluir o negócio." : null} />
      {deal.stage === "perdido" && deal.lost_reason ? (
        <p className="mb-6 rounded-[var(--radius-sm)] border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
          Motivo da perda: {deal.lost_reason}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Negócio">
          <DealForm deal={deal} clients={clients} properties={properties} staff={staff} />
        </Panel>

        <div className="space-y-5">
          {client ? (
            <Panel accent="gold" title="Cliente">
              <Link href={`/clientes/${client.id}`} className="text-lg font-medium text-ink hover:text-primary">
                {client.name}
              </Link>
              <p className="mt-1 text-sm text-ink-soft">{[client.phone, client.email].filter(Boolean).join(" · ")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {whatsapp ? (
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] border border-line px-3 text-[0.8125rem] text-ink hover:border-line-strong">
                    <WhatsAppIcon className="size-4" /> WhatsApp
                  </a>
                ) : null}
                {tel ? (
                  <a href={tel} className="inline-flex h-9 items-center rounded-[var(--radius-sm)] border border-line px-3 text-[0.8125rem] text-ink hover:border-line-strong">
                    Ligar
                  </a>
                ) : null}
              </div>
              {client.notes ? <p className="mt-3 whitespace-pre-line border-t border-line pt-3 text-sm text-ink-soft">{client.notes}</p> : null}
            </Panel>
          ) : null}

          {deal.property ? (
            <Panel accent="none" title="Imóvel">
              <Link href={`/imoveis/${deal.property.id}`} className="font-medium text-ink hover:text-primary">
                {deal.property.code} — {deal.property.title}
              </Link>
              <p className="mt-1 text-sm text-ink-soft">{formatPrice(deal.property.price, { purpose: deal.property.purpose })}</p>
              <a href={`${SITE.url}/imoveis/${deal.property.slug}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-primary hover:underline">
                Ver no site
              </a>
            </Panel>
          ) : null}

          <Panel title="Atividades" bodyClassName="p-0 sm:p-0">
            {deal.activities.length ? (
              <ul className="divide-y divide-line">
                {deal.activities.map((activity) => (
                  <li key={activity.id} className="flex items-start gap-3 px-5 py-3">
                    <form action={toggleActivityDone}>
                      <input type="hidden" name="id" value={activity.id} />
                      <input type="hidden" name="done" value={activity.done ? "0" : "1"} />
                      <button
                        type="submit"
                        aria-label={activity.done ? "Marcar como pendente" : "Marcar como feita"}
                        className={`mt-0.5 grid size-5 place-items-center rounded-full border text-[0.625rem] ${activity.done ? "border-primary bg-primary text-white" : "border-line-strong text-transparent hover:border-primary"}`}
                      >
                        ✓
                      </button>
                    </form>
                    <Link href={`/atividades/${activity.id}`} className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${activity.done ? "text-muted line-through" : "text-ink"}`}>{activity.title}</p>
                      <p className="text-xs text-muted">
                        {ACTIVITY_KIND_LABEL[activity.kind]} · {formatLocalDateTime(activity.starts_at)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pt-5 text-sm text-ink-soft">Nenhuma atividade ainda. Agende o próximo passo:</p>
            )}
            <details className="border-t border-line px-5 py-4" open={deal.activities.length === 0 && isOpen}>
              <summary className="cursor-pointer text-sm font-medium text-primary">+ Agendar próximo passo</summary>
              <div className="mt-4">
                <ActivityForm
                  compact
                  staff={staff}
                  clients={clients}
                  deals={dealOptions}
                  properties={properties}
                  defaults={{ client_id: deal.client_id, deal_id: deal.id, property_id: deal.property_id ?? undefined, starts_at: suggestion }}
                  returnTo={`/negocios/${deal.id}`}
                />
              </div>
            </details>
          </Panel>

          {session?.profile.role === "admin" ? (
            <form action={deleteDeal} className="text-right">
              <input type="hidden" name="id" value={deal.id} />
              <ConfirmSubmit message="Excluir este negócio e as atividades ligadas a ele?" className="text-sm text-danger hover:underline">
                Excluir negócio
              </ConfirmSubmit>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
