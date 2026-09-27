import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminSession, requireStaff } from "@/lib/auth";
import { CrmNotInstalledError, getClient, getStaffDirectory } from "@/lib/queries/crm";
import { deleteClient, toggleActivityDone } from "@/actions/admin/crm";
import { ACTIVITY_KIND_LABEL, CLIENT_KIND_LABEL, DEAL_STAGE_LABEL } from "@/lib/crm";
import { formatLocalDateTime, formatLocalDay } from "@/lib/datetime";
import { formatPrice, phoneHref, whatsappUrl } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/site";
import { firstParam } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/ui/icons";
import { ClientForm } from "@/components/admin/crm-forms";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { CrmPendingNotice, FlashMessage, PageHeader, Panel, Pill } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  await requireStaff(`/clientes/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const query = await searchParams;

  let client: Awaited<ReturnType<typeof getClient>>;
  try {
    client = await getClient(id);
  } catch (error) {
    if (error instanceof CrmNotInstalledError) return <CrmPendingNotice />;
    throw error;
  }
  if (!client) notFound();

  const [staff, session] = await Promise.all([getStaffDirectory(), getAdminSession()]);
  const whatsapp = whatsappUrl(client.phone);
  const tel = phoneHref(client.phone);
  const ok = firstParam(query.ok);

  return (
    <div>
      <PageHeader
        title={client.name}
        breadcrumb={[{ href: "/clientes", label: "Clientes" }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {client.kinds.map((kind) => (
              <Pill key={kind} tone={kind === "proprietario" ? "gold" : "primary"}>
                {CLIENT_KIND_LABEL[kind]}
              </Pill>
            ))}
            <span className="text-muted">Cliente desde {formatLocalDay(client.created_at)}</span>
          </span>
        }
        actions={
          <>
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] border border-line bg-surface px-3 text-[0.8125rem] text-ink hover:border-line-strong"
              >
                <WhatsAppIcon className="size-4" /> WhatsApp
              </a>
            ) : null}
            {tel ? (
              <a href={tel} className="inline-flex h-10 items-center rounded-[var(--radius-sm)] border border-line bg-surface px-3 text-[0.8125rem] text-ink hover:border-line-strong">
                Ligar
              </a>
            ) : null}
          </>
        }
      />

      <FlashMessage message={ok === "criado" ? "Cliente cadastrado." : null} />
      <FlashMessage tone="error" message={firstParam(query.erro) === "excluir" ? "Não foi possível excluir o cliente." : null} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="Dados do cliente">
          <ClientForm client={client} staff={staff} />
        </Panel>

        <div className="space-y-5">
          <Panel
            title="Negócios"
            action={
              <Link href={`/negocios/novo?cliente=${client.id}`} className="text-xs font-medium text-primary hover:underline">
                + Novo negócio
              </Link>
            }
            bodyClassName="p-0 sm:p-0"
          >
            {client.deals.length === 0 ? (
              <p className="p-5 text-sm text-ink-soft">Nenhum negócio com este cliente ainda.</p>
            ) : (
              <ul className="divide-y divide-line">
                {client.deals.map((deal) => (
                  <li key={deal.id}>
                    <Link href={`/negocios/${deal.id}`} className="block px-5 py-3 hover:bg-canvas">
                      <p className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-ink">{deal.title}</span>
                        <Pill tone={deal.stage === "ganho" ? "success" : deal.stage === "perdido" ? "danger" : "primary"}>
                          {DEAL_STAGE_LABEL[deal.stage]}
                        </Pill>
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {deal.value ? formatPrice(deal.value, { purpose: deal.purpose }) : "Valor a definir"}
                        {deal.property ? ` · ${deal.property.code}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            accent="gold"
            title="Atividades"
            action={
              <Link href={`/atividades?nova=1&cliente=${client.id}`} className="text-xs font-medium text-primary hover:underline">
                + Agendar
              </Link>
            }
            bodyClassName="p-0 sm:p-0"
          >
            {client.activities.length === 0 ? (
              <p className="p-5 text-sm text-ink-soft">Nenhuma atividade registrada.</p>
            ) : (
              <ul className="divide-y divide-line">
                {client.activities.slice(0, 12).map((activity) => (
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
            )}
          </Panel>

          <Panel accent="none" title="Imóveis deste proprietário" bodyClassName="p-0 sm:p-0">
            {client.owned.filter((row) => row.property).length === 0 ? (
              <p className="p-5 text-sm text-ink-soft">
                Nenhum imóvel vinculado. O vínculo é feito no cadastro do imóvel, na etapa “Proprietários”.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {client.owned.map(({ property }) =>
                  property ? (
                    <li key={property.id}>
                      <Link href={`/imoveis/${property.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas">
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-ink">{property.title}</span>
                          <span className="block text-xs text-muted">{property.code}</span>
                        </span>
                        <Pill>{STATUS_LABEL[property.status]}</Pill>
                      </Link>
                    </li>
                  ) : null
                )}
              </ul>
            )}
          </Panel>

          {session?.profile.role === "admin" ? (
            <form action={deleteClient} className="text-right">
              <input type="hidden" name="id" value={client.id} />
              <ConfirmSubmit
                message={`Excluir ${client.name}? Os negócios e atividades deste cliente também serão excluídos.`}
                className="text-sm text-danger hover:underline"
              >
                Excluir cliente
              </ConfirmSubmit>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
