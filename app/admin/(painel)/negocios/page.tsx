import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { CrmNotInstalledError, getStaffDirectory, listDeals } from "@/lib/queries/crm";
import { DEAL_STAGE_LABEL, DEAL_TEMPERATURES, DEAL_TEMPERATURE_LABEL } from "@/lib/crm";
import { formatLocalDay } from "@/lib/datetime";
import { formatPrice } from "@/lib/format";
import { buildQuery, cn, firstParam } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { Select } from "@/components/ui/primitives";
import { DealBoard } from "@/components/admin/deal-board";
import { CrmPendingNotice, FlashMessage, PageHeader, Pill } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("/negocios");
  const params = await searchParams;
  const purpose = firstParam(params.finalidade);
  const assignedTo = firstParam(params.responsavel);
  const temperature = firstParam(params.temperatura);
  const closed = firstParam(params.fechados) === "1";
  // Instante da renderização, igual para servidor e navegador ("há 2 dias").
  const now = new Date().getTime();

  let deals: Awaited<ReturnType<typeof listDeals>>;
  try {
    deals = await listDeals({
      purpose: purpose === "venda" || purpose === "locacao" ? purpose : undefined,
      assignedTo: assignedTo && /^[0-9a-f-]{36}$/i.test(assignedTo) ? assignedTo : undefined,
      temperature: temperature && (DEAL_TEMPERATURES as readonly string[]).includes(temperature) ? temperature : undefined,
      closed,
    });
  } catch (error) {
    if (error instanceof CrmNotInstalledError) {
      return (
        <div>
          <PageHeader title="Negócios" />
          <CrmPendingNotice />
        </div>
      );
    }
    throw error;
  }
  const staff = await getStaffDirectory();
  const filters = { finalidade: purpose, responsavel: assignedTo, temperatura: temperature };
  const pillLink = (active: boolean) =>
    cn(
      "inline-flex h-10 items-center rounded-[var(--radius-sm)] border px-4 text-sm transition-colors",
      active ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink"
    );

  return (
    <div>
      <PageHeader
        title={closed ? "Negócios ganhos e perdidos" : "Funil de negócios"}
        description={closed ? "Os 100 fechamentos mais recentes." : `${deals.length} ${deals.length === 1 ? "negócio aberto" : "negócios abertos"}`}
        actions={
          <>
            <ButtonLink href={closed ? "/negocios" : "/negocios?fechados=1"} variant="outline" size="sm">
              {closed ? "Ver funil" : "Ganhos e perdidos"}
            </ButtonLink>
            <ButtonLink href="/negocios/novo" variant="gold" size="sm">
              Adicionar negócio
            </ButtonLink>
          </>
        }
      />

      <FlashMessage message={firstParam(params.ok) === "excluido" ? "Negócio excluído." : null} />

      {/* Filtros, como na barra do funil de referência */}
      <form method="get" className="mb-5 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-line bg-surface p-3">
        {closed ? <input type="hidden" name="fechados" value="1" /> : null}
        <Link href={`/negocios${buildQuery({ ...filters, finalidade: purpose === "venda" ? undefined : "venda", fechados: closed ? 1 : undefined })}`} className={pillLink(purpose === "venda")}>
          Venda
        </Link>
        <Link href={`/negocios${buildQuery({ ...filters, finalidade: purpose === "locacao" ? undefined : "locacao", fechados: closed ? 1 : undefined })}`} className={pillLink(purpose === "locacao")}>
          Locação
        </Link>
        {purpose ? <input type="hidden" name="finalidade" value={purpose} /> : null}
        <label className="sr-only" htmlFor="f-resp">
          Responsável
        </label>
        <div className="w-full sm:w-52">
        <Select id="f-resp" name="responsavel" defaultValue={assignedTo ?? ""} className="h-10">
          <option value="">Todos os corretores</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </Select>
        </div>
        <label className="sr-only" htmlFor="f-temp">
          Temperatura
        </label>
        <div className="w-full sm:w-44">
        <Select id="f-temp" name="temperatura" defaultValue={temperature ?? ""} className="h-10">
          <option value="">Toda temperatura</option>
          {DEAL_TEMPERATURES.map((value) => (
            <option key={value} value={value}>
              {DEAL_TEMPERATURE_LABEL[value]}
            </option>
          ))}
        </Select>
        </div>
        <button type="submit" className="h-10 rounded-[var(--radius-sm)] bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover">
          Buscar
        </button>
        {purpose || assignedTo || temperature ? (
          <Link href={closed ? "/negocios?fechados=1" : "/negocios"} className="px-2 text-sm text-ink-soft hover:text-ink">
            Limpar
          </Link>
        ) : null}
      </form>

      {closed ? (
        deals.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-ink-soft">
            Nenhum negócio fechado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface">
            {deals.map((deal) => (
              <li key={deal.id}>
                <Link href={`/negocios/${deal.id}`} className="grid gap-1 px-4 py-3 hover:bg-canvas sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4 sm:px-5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{deal.client?.name}</span>
                    <span className="block truncate text-xs text-muted">{deal.title}</span>
                  </span>
                  <span className="text-sm text-ink-soft">{deal.value ? formatPrice(deal.value, { purpose: deal.purpose }) : "—"}</span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    <Pill tone={deal.stage === "ganho" ? "success" : "danger"}>{DEAL_STAGE_LABEL[deal.stage]}</Pill>
                    {deal.closed_at ? formatLocalDay(deal.closed_at) : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <DealBoard deals={deals} now={now} />
      )}
    </div>
  );
}
