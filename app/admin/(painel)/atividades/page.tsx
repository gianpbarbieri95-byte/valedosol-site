import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import {
  CrmNotInstalledError,
  getStaffDirectory,
  listActivitiesBetween,
  listClientOptions,
  listOpenDealOptions,
  listPendingActivities,
  type ActivityRow,
} from "@/lib/queries/crm";
import { listPropertyOptions } from "@/lib/queries/admin";
import { toggleActivityDone } from "@/actions/admin/crm";
import { ACTIVITY_KIND_LABEL } from "@/lib/crm";
import {
  addLocalDays,
  formatLocalDay,
  formatLocalTime,
  parseDateKey,
  startOfLocalDay,
  startOfLocalWeek,
  toLocalDateKey,
  toLocalInput,
  zonedParts,
  zonedToDate,
} from "@/lib/datetime";
import { buildQuery, cn, firstParam } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { ActivityForm } from "@/components/admin/crm-forms";
import { CrmPendingNotice, PageHeader, Panel } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const FIRST_HOUR = 6;
const LAST_HOUR = 22;
const HOUR_REM = 3;
const WEEKDAY = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const KIND_COLOR: Record<string, string> = {
  visita: "border-l-gold-bright bg-gold-soft",
  reuniao: "border-l-gold bg-gold-soft",
  ligacao: "border-l-primary bg-primary-soft",
  whatsapp: "border-l-primary bg-primary-soft",
  email: "border-l-primary bg-primary-soft",
  tarefa: "border-l-ink-soft bg-surface-alt",
};

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short" });
const yearFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "short", year: "numeric" });

/** Faixas lado a lado quando atividades do mesmo dia se sobrepõem. */
function layoutDay(items: ActivityRow[]) {
  const sorted = [...items].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const laneEnds: number[] = [];
  const placed = sorted.map((item) => {
    const start = new Date(item.starts_at).getTime();
    const end = item.ends_at ? new Date(item.ends_at).getTime() : start + 45 * 60000;
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.push(end) - 1;
    else laneEnds[lane] = end;
    return { item, start, end: Math.max(end, start + 30 * 60000), lane };
  });
  return { placed, lanes: Math.max(1, laneEnds.length) };
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireStaff("/atividades");
  const params = await searchParams;
  const uuid = (value?: string) => (value && /^[0-9a-f-]{36}$/i.test(value) ? value : undefined);

  const now = new Date();
  const anchor = parseDateKey(firstParam(params.semana)) ?? now;
  const weekStart = startOfLocalWeek(anchor);
  const weekEnd = addLocalDays(weekStart, 7);
  const days = Array.from({ length: 7 }, (_, index) => addLocalDays(weekStart, index));
  const todayKey = toLocalDateKey(now);
  const assignedTo = uuid(firstParam(params.responsavel));
  const showForm = firstParam(params.nova) === "1";

  let week: ActivityRow[];
  let pending: ActivityRow[];
  try {
    [week, pending] = await Promise.all([
      listActivitiesBetween(weekStart, weekEnd, { assignedTo }),
      listPendingActivities(addLocalDays(startOfLocalDay(now), 1), { assignedTo, limit: 40 }),
    ]);
  } catch (error) {
    if (error instanceof CrmNotInstalledError) {
      return (
        <div>
          <PageHeader title="Atividades" />
          <CrmPendingNotice />
        </div>
      );
    }
    throw error;
  }

  const [staff, clients, deals, properties] = showForm
    ? await Promise.all([getStaffDirectory(), listClientOptions(), listOpenDealOptions(), listPropertyOptions()])
    : [await getStaffDirectory(), [], [], []];

  // Nova atividade: dia escolhido (ou hoje) às 9h, ou a próxima hora cheia.
  const chosenDay = parseDateKey(firstParam(params.data));
  const base = zonedParts(chosenDay ?? now);
  const suggestedHour = chosenDay ? 9 : Math.min(LAST_HOUR - 1, base.hour + 1);
  const suggestion = toLocalInput(zonedToDate(base.year, base.month, base.day, suggestedHour));

  const rangeLabel = `${monthFormatter.format(weekStart)} – ${yearFormatter.format(addLocalDays(weekStart, 6))}`;
  const nav = (date: Date) => `/atividades${buildQuery({ semana: toLocalDateKey(date), responsavel: assignedTo })}`;
  const byDay = new Map<string, ActivityRow[]>();
  for (const activity of week) {
    const key = toLocalDateKey(activity.starts_at);
    byDay.set(key, [...(byDay.get(key) ?? []), activity]);
  }
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, index) => FIRST_HOUR + index);

  return (
    <div>
      <PageHeader
        title="Atividades"
        description="Ligações, visitas, reuniões e tarefas da equipe."
        actions={
          <form method="get" className="flex items-center gap-2">
            <input type="hidden" name="semana" value={toLocalDateKey(weekStart)} />
            <label htmlFor="resp" className="sr-only">
              Responsável
            </label>
            <select
              id="resp"
              name="responsavel"
              defaultValue={assignedTo ?? ""}
              className="h-10 rounded-[var(--radius-sm)] border border-line bg-surface px-3 text-sm"
            >
              <option value="">Toda a equipe</option>
              <option value={session.userId}>Só as minhas</option>
              {staff
                .filter((member) => member.id !== session.userId)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
            <button type="submit" className="h-10 rounded-[var(--radius-sm)] border border-line bg-surface px-3 text-sm text-ink-soft hover:border-line-strong">
              Filtrar
            </button>
          </form>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* Coluna da esquerda: nova atividade + pendentes */}
        <Panel
          title="Pendentes"
          action={
            showForm ? null : (
              <Link
                href={`/atividades${buildQuery({ nova: 1, semana: firstParam(params.semana), responsavel: assignedTo })}`}
                className="inline-flex h-9 items-center rounded-[var(--radius-sm)] bg-gold-bright px-3 text-[0.8125rem] font-medium text-primary-deep hover:bg-[#e2b654]"
              >
                Adicionar atividade
              </Link>
            )
          }
          bodyClassName="p-0 sm:p-0"
          className="self-start"
        >
          {showForm ? (
            <div className="border-b border-line p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-sans text-sm font-medium text-ink">Nova atividade</h3>
                <Link href={`/atividades${buildQuery({ semana: firstParam(params.semana), responsavel: assignedTo })}`} className="text-xs text-muted hover:text-ink">
                  Cancelar
                </Link>
              </div>
              <ActivityForm
                compact
                staff={staff}
                clients={clients}
                deals={deals}
                properties={properties}
                defaults={{
                  client_id: uuid(firstParam(params.cliente)),
                  deal_id: uuid(firstParam(params.negocio)),
                  property_id: uuid(firstParam(params.imovel)),
                  starts_at: suggestion,
                }}
                returnTo={`/atividades${buildQuery({ semana: firstParam(params.semana), responsavel: assignedTo })}`}
              />
            </div>
          ) : null}

          {pending.length === 0 ? (
            <p className="p-5 text-sm text-ink-soft">Nenhuma atividade pendente até hoje.</p>
          ) : (
            <ul className="max-h-[36rem] divide-y divide-line overflow-y-auto">
              {pending.map((activity) => {
                const late = new Date(activity.starts_at) < startOfLocalDay(now);
                return (
                  <li key={activity.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                    <form action={toggleActivityDone}>
                      <input type="hidden" name="id" value={activity.id} />
                      <input type="hidden" name="done" value="1" />
                      <button
                        type="submit"
                        aria-label={`Concluir: ${activity.title}`}
                        className="mt-0.5 grid size-5 place-items-center rounded-full border border-line-strong text-[0.625rem] text-transparent hover:border-primary hover:text-primary"
                      >
                        ✓
                      </button>
                    </form>
                    <Link href={`/atividades/${activity.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{activity.title}</p>
                      <p className={cn("text-xs", late ? "font-medium text-danger" : "text-muted")}>
                        {late ? "Atrasada · " : ""}
                        {formatLocalDay(activity.starts_at)}
                        {activity.all_day ? "" : ` ${formatLocalTime(activity.starts_at)}`} · {ACTIVITY_KIND_LABEL[activity.kind]}
                      </p>
                      {activity.client ? <p className="truncate text-xs text-muted">{activity.client.name}</p> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Calendário da semana */}
        <section className="min-w-0 rounded-[var(--radius-md)] border border-line bg-surface shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <h2 className="font-display text-2xl text-ink sm:text-3xl">{rangeLabel}</h2>
            <div className="flex items-center gap-1">
              <Link href={nav(addLocalDays(weekStart, -7))} aria-label="Semana anterior" className="grid size-9 place-items-center rounded-[var(--radius-sm)] border border-line hover:border-line-strong">
                <ChevronLeftIcon className="size-4" />
              </Link>
              <Link href={nav(addLocalDays(weekStart, 7))} aria-label="Próxima semana" className="grid size-9 place-items-center rounded-[var(--radius-sm)] border border-line hover:border-line-strong">
                <ChevronRightIcon className="size-4" />
              </Link>
              <Link href={nav(now)} className="ml-1 inline-flex h-9 items-center rounded-[var(--radius-sm)] border border-line px-3 text-sm text-ink-soft hover:border-line-strong">
                Hoje
              </Link>
            </div>
          </div>

          {/* Celular: lista por dia */}
          <ol className="divide-y divide-line md:hidden">
            {days.map((day) => {
              const key = toLocalDateKey(day);
              const items = (byDay.get(key) ?? []).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
              return (
                <li key={key} className={cn("px-4 py-3", key === todayKey && "bg-gold-soft/60")}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">
                      {WEEKDAY[zonedParts(day).weekday]} {formatLocalDay(day)}
                      {key === todayKey ? <span className="ml-2 text-xs text-gold">hoje</span> : null}
                    </p>
                    <Link href={`/atividades${buildQuery({ nova: 1, data: key, semana: toLocalDateKey(weekStart) })}`} className="text-xs text-primary">
                      + agendar
                    </Link>
                  </div>
                  {items.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {items.map((activity) => (
                        <li key={activity.id}>
                          <Link href={`/atividades/${activity.id}`} className={cn("block rounded-[var(--radius-xs)] border-l-4 px-3 py-2 text-sm", KIND_COLOR[activity.kind], activity.done && "opacity-50 line-through")}>
                            <span className="text-xs text-muted">{activity.all_day ? "Dia todo" : formatLocalTime(activity.starts_at)}</span>{" "}
                            {activity.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {/* Desktop: grade da semana */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-line">
              <div />
              {days.map((day) => {
                const key = toLocalDateKey(day);
                return (
                  <Link
                    key={key}
                    href={`/atividades${buildQuery({ nova: 1, data: key, semana: toLocalDateKey(weekStart), responsavel: assignedTo })}`}
                    title="Agendar neste dia"
                    className={cn("border-l border-line px-2 py-2 text-center text-sm font-medium text-ink hover:bg-canvas", key === todayKey && "bg-gold-soft")}
                  >
                    {WEEKDAY[zonedParts(day).weekday]} {formatLocalDay(day).slice(0, 5)}
                  </Link>
                );
              })}
            </div>
            {/* Dia inteiro */}
            <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-line">
              <div className="px-1 py-2 text-right text-[0.6875rem] text-muted">dia inteiro</div>
              {days.map((day) => {
                const key = toLocalDateKey(day);
                const items = (byDay.get(key) ?? []).filter((activity) => activity.all_day);
                return (
                  <div key={key} className={cn("min-h-10 space-y-1 border-l border-line p-1", key === todayKey && "bg-gold-soft/70")}>
                    {items.map((activity) => (
                      <Link key={activity.id} href={`/atividades/${activity.id}`} className={cn("block truncate rounded-[var(--radius-xs)] border-l-4 px-1.5 py-0.5 text-xs text-ink", KIND_COLOR[activity.kind], activity.done && "opacity-50 line-through")}>
                        {activity.title}
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="max-h-[36rem] overflow-y-auto pt-2">
              <div className="relative grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]" style={{ height: `${hours.length * HOUR_REM}rem` }}>
                <div>
                  {hours.map((hour) => (
                    <div key={hour} className="relative border-b border-line/60 pr-2 text-right text-xs text-muted" style={{ height: `${HOUR_REM}rem` }}>
                      <span className="relative -top-2">{String(hour).padStart(2, "0")}</span>
                    </div>
                  ))}
                </div>
                {days.map((day) => {
                  const key = toLocalDateKey(day);
                  const { placed, lanes } = layoutDay((byDay.get(key) ?? []).filter((activity) => !activity.all_day));
                  const dayStart = zonedToDate(zonedParts(day).year, zonedParts(day).month, zonedParts(day).day, FIRST_HOUR).getTime();
                  return (
                    <div key={key} className={cn("relative border-l border-line", key === todayKey && "bg-gold-soft/50")}>
                      {hours.map((hour) => (
                        <div key={hour} className="border-b border-line/60" style={{ height: `${HOUR_REM}rem` }} />
                      ))}
                      {placed.map(({ item, start, end, lane }) => {
                        const top = Math.max(0, ((start - dayStart) / 3_600_000) * HOUR_REM);
                        const height = Math.max(1.4, ((end - start) / 3_600_000) * HOUR_REM);
                        return (
                          <Link
                            key={item.id}
                            href={`/atividades/${item.id}`}
                            className={cn(
                              "absolute overflow-hidden rounded-[var(--radius-xs)] border-l-4 px-1.5 py-1 text-[0.6875rem] leading-tight text-ink shadow-subtle hover:z-10 hover:shadow-lift",
                              KIND_COLOR[item.kind],
                              item.done && "opacity-50 line-through"
                            )}
                            style={{
                              top: `${Math.min(top, hours.length * HOUR_REM - 1.4)}rem`,
                              height: `${height}rem`,
                              left: `calc(${(lane / lanes) * 100}% + 2px)`,
                              width: `calc(${100 / lanes}% - 4px)`,
                            }}
                          >
                            <span className="block font-medium">{formatLocalTime(item.starts_at)}</span>
                            <span className="block truncate">{item.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
