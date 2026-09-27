import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { countNewLeads, getPropertyHealth, listNewLeads, type PropertyHealthRow } from "@/lib/queries/admin";
import {
  CrmNotInstalledError,
  getCrmSummary,
  isCrmInstalled,
  listPendingActivities,
  type ActivityRow,
  type CrmSummary,
} from "@/lib/queries/crm";
import { toggleActivityDone } from "@/actions/admin/crm";
import { ACTIVITY_KIND_LABEL, DEAL_STAGE_LABEL, OPEN_STAGES, STALE_PROPERTY_DAYS } from "@/lib/crm";
import { addLocalDays, daysSince, formatLocalDay, formatLocalTime, startOfLocalDay, zonedParts, zonedToDate } from "@/lib/datetime";
import { formatPrice } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/site";
import { ButtonLink } from "@/components/ui/button";
import { BedIcon } from "@/components/ui/icons";
import {
  AlertIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  CameraOffIcon,
  CheckCircleIcon,
  InboxIcon,
  UsersIcon,
} from "@/components/admin/icons";
import { CrmPendingNotice, Panel, Pill, StatTile } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const LEAD_SOURCE_LABEL: Record<string, string> = {
  site_imovel: "Interesse em imóvel",
  site_whatsapp: "WhatsApp do imóvel",
  site_contato: "Fale conosco",
  site_venda_imovel: "Quer vender",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; senha?: string }>;
}) {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const tomorrow = addLocalDays(todayStart, 1);
  const today = zonedParts(now);
  const monthStart = zonedToDate(today.year, today.month, 1);

  const [session, health, leads, newLeadsCount, crmInstalled, { erro, senha }] = await Promise.all([
    requireStaff(),
    getPropertyHealth(),
    listNewLeads(6),
    countNewLeads(),
    isCrmInstalled(),
    searchParams,
  ]);

  let crm: CrmSummary | null = null;
  let activities: ActivityRow[] = [];
  if (crmInstalled) {
    try {
      [crm, activities] = await Promise.all([getCrmSummary(monthStart), listPendingActivities(tomorrow, { limit: 12 })]);
    } catch (error) {
      if (!(error instanceof CrmNotInstalledError)) throw error;
    }
  }

  const firstName = (session.profile.name ?? session.email).split(" ")[0];
  const stalePercent = health.total ? Math.round((health.stale.length / health.total) * 100) : 0;
  const funnelMax = crm ? Math.max(1, ...OPEN_STAGES.map((stage) => crm!.byStage[stage])) : 1;

  return (
    <div>
      {erro === "sem-permissao" ? (
        <p role="alert" className="mb-6 rounded-[var(--radius-sm)] border border-gold/30 bg-gold-soft px-4 py-3 text-sm text-[#7a5a10]">
          Essa área é exclusiva de administradores. Fale com quem administra o painel se precisar de acesso.
        </p>
      ) : null}
      {senha === "alterada" ? (
        <p role="status" className="mb-6 rounded-[var(--radius-sm)] border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-primary">
          Senha nova salva. Use-a na próxima vez que entrar.
        </p>
      ) : null}

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Olá, {firstName}</h1>
          <p className="mt-1 text-sm text-ink-soft first-letter:uppercase">
            {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(now)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {crmInstalled ? (
            <ButtonLink href="/negocios/novo" variant="outline" size="sm">
              + Negócio
            </ButtonLink>
          ) : null}
          <ButtonLink href="/imoveis/novo" size="sm">
            + Novo imóvel
          </ButtonLink>
        </div>
      </header>

      {!crmInstalled ? <CrmPendingNotice className="mb-6" /> : null}

      {/* Cartões de número */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile tone="deep" href="/clientes" label="Clientes" value={crm ? crm.clients : "—"} icon={<UsersIcon />} />
        <StatTile
          tone="primary"
          href="/negocios"
          label="Negócios abertos"
          value={crm ? crm.openDeals : "—"}
          detail={crm && crm.openValue ? `${formatPrice(crm.openValue)} em negociação` : undefined}
          icon={<BriefcaseIcon />}
        />
        <StatTile
          tone="gold"
          href="/imoveis?estado=published"
          label="Imóveis publicados"
          value={
            <>
              {health.published}
              <span className="text-[0.55em] opacity-70">/{health.total}</span>
            </>
          }
          icon={<BuildingIcon />}
        />
        <StatTile tone="bright" href="/leads?status=novo" label="Contatos novos do site" value={newLeadsCount} icon={<InboxIcon />} />
        <StatTile tone="ink" href="/imoveis?semfoto=1" label="Imóveis sem foto" value={health.withoutPhoto.length} icon={<CameraOffIcon />} />
        <StatTile
          tone="danger"
          href="/imoveis?desatualizados=1"
          label="Imóveis desatualizados"
          detail={`há mais de ${STALE_PROPERTY_DAYS} dias`}
          value={health.stale.length}
          icon={<AlertIcon />}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* Atividades de hoje */}
        <Panel
          title="Agenda de hoje"
          icon={<CalendarIcon className="size-4" />}
          action={
            crmInstalled ? (
              <Link href="/atividades" className="text-xs font-medium text-primary hover:underline">
                Abrir agenda
              </Link>
            ) : null
          }
          bodyClassName="p-0 sm:p-0"
        >
          {!crmInstalled ? (
            <p className="p-5 text-sm text-muted">Disponível depois da instalação do CRM.</p>
          ) : activities.length === 0 ? (
            <div className="p-5 text-sm text-ink-soft">
              <p>Nada pendente para hoje.</p>
              <Link href="/atividades?nova=1" className="mt-2 inline-block font-medium text-primary hover:underline">
                + Agendar atividade
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {activities.map((activity) => {
                const overdue = new Date(activity.starts_at) < todayStart;
                return (
                  <li key={activity.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <form action={toggleActivityDone}>
                      <input type="hidden" name="id" value={activity.id} />
                      <input type="hidden" name="done" value="1" />
                      <button
                        type="submit"
                        aria-label={`Concluir: ${activity.title}`}
                        title="Marcar como feita"
                        className="mt-0.5 grid size-6 place-items-center rounded-full border border-line-strong text-transparent transition-colors hover:border-primary hover:text-primary"
                      >
                        <CheckCircleIcon className="size-4" />
                      </button>
                    </form>
                    <Link href={`/atividades/${activity.id}`} className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span className={overdue ? "font-medium text-danger" : "font-medium text-ink-soft"}>
                          {overdue ? `Atrasada · ${formatLocalDay(activity.starts_at)}` : activity.all_day ? "Dia todo" : formatLocalTime(activity.starts_at)}
                        </span>
                        <span>{ACTIVITY_KIND_LABEL[activity.kind]}</span>
                      </p>
                      <p className="truncate text-sm text-ink">{activity.title}</p>
                      {activity.client ? <p className="truncate text-xs text-muted">{activity.client.name}</p> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Imóveis desatualizados */}
        <Panel
          accent="danger"
          title="Imóveis desatualizados"
          icon={<AlertIcon className="size-4" />}
          action={
            <Link href="/imoveis?desatualizados=1" className="text-xs font-medium text-primary hover:underline">
              Ver todos
            </Link>
          }
        >
          <p className="flex items-baseline gap-2">
            <span className="font-display text-4xl leading-none text-danger lining-nums">{health.stale.length}</span>
            <span className="text-xs uppercase tracking-[0.08em] text-muted">sem atualização há {STALE_PROPERTY_DAYS} dias</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-alt" aria-hidden>
            <div className="h-full rounded-full bg-danger/70" style={{ width: `${stalePercent}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">{stalePercent}% do acervo à venda ou locação</p>
          <PropertyMiniList rows={health.stale.slice(0, 5)} badge={(row) => `${daysSince(row.updated_at)}d`} empty="Tudo em dia." />
        </Panel>

        {/* Novos imóveis */}
        <Panel
          accent="gold"
          title="Novos imóveis"
          icon={<BuildingIcon className="size-4" />}
          action={
            <Link href="/imoveis" className="text-xs font-medium text-primary hover:underline">
              Ver imóveis
            </Link>
          }
        >
          <p className="flex items-baseline gap-2">
            <span className="font-display text-4xl leading-none text-gold lining-nums">{health.recent.length}</span>
            <span className="text-xs uppercase tracking-[0.08em] text-muted">cadastrados nos últimos 30 dias</span>
          </p>
          <PropertyMiniList
            rows={health.recent.slice(0, 5)}
            badge={(row) => formatLocalDay(row.created_at)}
            empty="Nenhum imóvel novo neste mês."
          />
        </Panel>

        {/* Funil */}
        <Panel
          title="Funil de negócios"
          icon={<BriefcaseIcon className="size-4" />}
          action={
            crmInstalled ? (
              <Link href="/negocios" className="text-xs font-medium text-primary hover:underline">
                Abrir funil
              </Link>
            ) : null
          }
        >
          {crm ? (
            <>
              <ul className="space-y-3">
                {OPEN_STAGES.map((stage) => (
                  <li key={stage}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink-soft">{DEAL_STAGE_LABEL[stage]}</span>
                      <span className="font-medium text-ink">{crm!.byStage[stage]}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-alt" aria-hidden>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(crm!.byStage[stage] / funnelMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-line pt-3 text-sm text-ink-soft">
                <strong className="font-medium text-primary">{crm.wonThisMonth}</strong>{" "}
                {crm.wonThisMonth === 1 ? "negócio fechado" : "negócios fechados"} neste mês
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">Disponível depois da instalação do CRM.</p>
          )}
        </Panel>

        {/* Contatos novos */}
        <Panel
          accent="gold"
          title="Contatos novos do site"
          icon={<InboxIcon className="size-4" />}
          action={
            <Link href="/leads?status=novo" className="text-xs font-medium text-primary hover:underline">
              Ver contatos
            </Link>
          }
          bodyClassName="p-0 sm:p-0"
        >
          {leads.length === 0 ? (
            <p className="p-5 text-sm text-ink-soft">Nenhum contato aguardando atendimento.</p>
          ) : (
            <ul className="divide-y divide-line">
              {leads.map((lead) => (
                <li key={lead.id}>
                  <Link href="/leads?status=novo" className="block px-4 py-3 transition-colors hover:bg-canvas sm:px-5">
                    <p className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink">{lead.name}</span>
                      <span className="shrink-0 text-xs text-muted">{formatLocalDay(lead.created_at)}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {LEAD_SOURCE_LABEL[lead.source] ?? lead.source}
                      {lead.property_code ? ` · ${lead.property_code}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Sem foto */}
        <Panel
          accent="none"
          title="Imóveis sem foto"
          icon={<CameraOffIcon className="size-4" />}
          action={
            <Link href="/imoveis?semfoto=1" className="text-xs font-medium text-primary hover:underline">
              Ver todos
            </Link>
          }
        >
          <PropertyMiniList
            rows={health.withoutPhoto.slice(0, 6)}
            badge={(row) => STATUS_LABEL[row.status]}
            empty="Todos os imóveis têm foto."
          />
        </Panel>
      </div>
    </div>
  );
}

function PropertyMiniList({
  rows,
  badge,
  empty,
}: {
  rows: PropertyHealthRow[];
  badge: (row: PropertyHealthRow) => string;
  empty: string;
}) {
  if (rows.length === 0) return <p className="mt-4 text-sm text-ink-soft">{empty}</p>;
  return (
    <ul className="mt-4 space-y-1.5">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/imoveis/${row.id}`}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[var(--radius-sm)] bg-canvas px-3 py-2 text-sm transition-colors hover:bg-surface-alt"
          >
            <Pill>{badge(row)}</Pill>
            <span className="min-w-0">
              <span className="block truncate text-ink">{row.property_type?.name ?? row.title}</span>
              <span className="block truncate text-xs text-muted">{row.code}</span>
            </span>
            <span className="text-right text-xs text-ink-soft">
              {row.bedrooms ? (
                <span className="inline-flex items-center gap-1">
                  {row.bedrooms} <BedIcon className="size-3.5" />
                </span>
              ) : null}
              <span className="block">{formatPrice(row.price, { purpose: row.purpose as "venda" | "locacao", onRequest: row.price_on_request })}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
