import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import {
  CrmNotInstalledError,
  getActivity,
  getStaffDirectory,
  listClientOptions,
  listOpenDealOptions,
} from "@/lib/queries/crm";
import { listPropertyOptions } from "@/lib/queries/admin";
import { deleteActivity, toggleActivityDone } from "@/actions/admin/crm";
import { ACTIVITY_KIND_LABEL } from "@/lib/crm";
import { formatLocalDateTime, toLocalDateKey } from "@/lib/datetime";
import { ActivityForm } from "@/components/admin/crm-forms";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { CrmPendingNotice, PageHeader, Panel, Pill } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff(`/atividades/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  let activity: Awaited<ReturnType<typeof getActivity>>;
  try {
    activity = await getActivity(id);
  } catch (error) {
    if (error instanceof CrmNotInstalledError) return <CrmPendingNotice />;
    throw error;
  }
  if (!activity) notFound();

  const [staff, clients, deals, properties] = await Promise.all([
    getStaffDirectory(),
    listClientOptions(),
    listOpenDealOptions(),
    listPropertyOptions(),
  ]);
  const dealOptions =
    activity.deal && !deals.some((deal) => deal.id === activity.deal!.id)
      ? [{ id: activity.deal.id, title: activity.deal.title, client: null }, ...deals]
      : deals;
  const week = `/atividades?semana=${toLocalDateKey(activity.starts_at)}`;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={activity.title}
        breadcrumb={[{ href: week, label: "Atividades" }]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone="primary">{ACTIVITY_KIND_LABEL[activity.kind]}</Pill>
            <span>{formatLocalDateTime(activity.starts_at)}</span>
            {activity.done ? <Pill tone="success">Feita</Pill> : null}
          </span>
        }
        actions={
          <form action={toggleActivityDone}>
            <input type="hidden" name="id" value={activity.id} />
            <input type="hidden" name="done" value={activity.done ? "0" : "1"} />
            <button
              type="submit"
              className={
                activity.done
                  ? "inline-flex h-10 items-center rounded-[var(--radius-sm)] border border-line bg-surface px-4 text-sm text-ink-soft hover:border-line-strong"
                  : "inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
              }
            >
              {activity.done ? "Reabrir" : "Marcar como feita"}
            </button>
          </form>
        }
      />

      {activity.client || activity.deal ? (
        <p className="mb-5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          {activity.client ? (
            <Link href={`/clientes/${activity.client.id}`} className="text-primary hover:underline">
              Cliente: {activity.client.name}
            </Link>
          ) : null}
          {activity.deal ? (
            <Link href={`/negocios/${activity.deal.id}`} className="text-primary hover:underline">
              Negócio: {activity.deal.title}
            </Link>
          ) : null}
        </p>
      ) : null}

      <Panel>
        <ActivityForm activity={activity} staff={staff} clients={clients} deals={dealOptions} properties={properties} />
      </Panel>

      <form action={deleteActivity} className="mt-4 text-right">
        <input type="hidden" name="id" value={activity.id} />
        <input type="hidden" name="returnTo" value={week} />
        <ConfirmSubmit message="Excluir esta atividade?" className="text-sm text-danger hover:underline">
          Excluir atividade
        </ConfirmSubmit>
      </form>
    </div>
  );
}
