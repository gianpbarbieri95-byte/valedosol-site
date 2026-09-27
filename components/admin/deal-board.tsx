"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveDeal } from "@/actions/admin/crm";
import { DEAL_STAGE_HINT, DEAL_STAGE_LABEL, DEAL_TEMPERATURE_LABEL, OPEN_STAGES, formatCompactBRL } from "@/lib/crm";
import { formatLocalDay } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { DealCard } from "@/lib/queries/crm";
import type { DealStage } from "@/types/database";

type OpenStage = (typeof OPEN_STAGES)[number];


function relative(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h atrás`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ontem" : `${days}d atrás`;
}

const TEMPERATURE_DOT: Record<string, string> = {
  quente: "bg-danger",
  morna: "bg-gold-bright",
  fria: "bg-primary/40",
};

/**
 * Funil em colunas. Arrastar (mouse) ou escolher "Mover para" (toque e
 * teclado) muda a etapa. A tela muda na hora e a gravação vai em seguida;
 * se o servidor recusar, o cartão volta para onde estava.
 */
export function DealBoard({ deals: initial, now }: { deals: DealCard[]; now: number }) {
  const router = useRouter();
  const [deals, setDeals] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<{ stage: OpenStage; index: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Dados novos do servidor (depois de salvar em outra aba, por exemplo).
  const [source, setSource] = useState(initial);
  if (source !== initial) {
    setSource(initial);
    setDeals(initial);
  }

  const columns = OPEN_STAGES.map((stage) => ({
    stage,
    items: deals.filter((deal) => deal.stage === stage).sort((a, b) => a.position - b.position),
  }));

  function move(id: string, stage: OpenStage, index: number) {
    const column = columns.find((col) => col.stage === stage)!.items.filter((deal) => deal.id !== id);
    const before = column[index - 1]?.position;
    const after = column[index]?.position;
    const position =
      before === undefined && after === undefined
        ? 0
        : before === undefined
          ? after! - 1
          : after === undefined
            ? before + 1
            : (before + after) / 2;

    const previous = deals;
    const current = deals.find((deal) => deal.id === id);
    if (!current || (current.stage === stage && current.position === position)) return;

    setDeals((list) => list.map((deal) => (deal.id === id ? { ...deal, stage: stage as DealStage, position } : deal)));
    setError(null);
    startTransition(async () => {
      const result = await moveDeal({ id, stage, position });
      if (!result.ok) {
        setDeals(previous);
        setError(result.message ?? "Não foi possível mover o negócio.");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div>
      {error ? (
        <p role="alert" className="mb-4 rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="-mx-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-3 pb-4 sm:-mx-4 sm:px-4 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
        {columns.map(({ stage, items }) => {
          const total = items.reduce((sum, deal) => sum + Number(deal.value ?? 0), 0);
          return (
            <section
              key={stage}
              aria-label={DEAL_STAGE_LABEL[stage]}
              className={cn(
                "flex w-[82vw] max-w-sm shrink-0 snap-start flex-col rounded-[var(--radius-md)] bg-surface-alt/70 sm:w-80 lg:w-auto lg:max-w-none",
                dragging && over?.stage === stage && "ring-2 ring-gold-bright"
              )}
              onDragOver={(event) => {
                if (!dragging) return;
                event.preventDefault();
                if (!over || over.stage !== stage) setOver({ stage, index: items.length });
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragging && over) move(dragging, over.stage, over.index);
                setDragging(null);
                setOver(null);
              }}
            >
              <header className="rounded-t-[var(--radius-md)] bg-primary-deep px-4 py-3 text-white">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-sans text-[0.9375rem] font-medium text-white">{DEAL_STAGE_LABEL[stage]}</h2>
                  <span className="rounded-full bg-white/15 px-2 text-xs leading-5">{items.length}</span>
                </div>
                <p className="mt-0.5 text-xs text-white/65">
                  {total ? formatCompactBRL(total) : DEAL_STAGE_HINT[stage]}
                </p>
              </header>

              <ol className="flex min-h-40 flex-1 flex-col gap-2.5 p-2.5">
                {items.length === 0 ? (
                  <li className="grid flex-1 place-items-center rounded-[var(--radius-sm)] border border-dashed border-line-strong p-6 text-center text-sm text-muted">
                    Não há itens
                  </li>
                ) : null}
                {items.map((deal, index) => {
                  const next = deal.activities
                    .filter((activity) => !activity.done)
                    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
                  const late = next && new Date(next.starts_at).getTime() < now;
                  return (
                    <li
                      key={deal.id}
                      draggable
                      onDragStart={(event) => {
                        setDragging(deal.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", deal.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onDragOver={(event) => {
                        if (!dragging) return;
                        event.preventDefault();
                        event.stopPropagation();
                        const rect = event.currentTarget.getBoundingClientRect();
                        const after = event.clientY > rect.top + rect.height / 2;
                        setOver({ stage, index: after ? index + 1 : index });
                      }}
                      className={cn(
                        "group cursor-grab rounded-[var(--radius-sm)] border border-line bg-surface p-3 shadow-card transition-shadow hover:shadow-lift active:cursor-grabbing",
                        dragging === deal.id && "opacity-40",
                        dragging && over?.stage === stage && over.index === index && "border-t-2 border-t-gold-bright"
                      )}
                    >
                      <Link href={`/negocios/${deal.id}`} className="block" draggable={false}>
                        <p className="flex items-start gap-2">
                          <span
                            aria-hidden
                            className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", deal.temperature ? TEMPERATURE_DOT[deal.temperature] : "bg-line-strong")}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink">{deal.client?.name ?? "Cliente removido"}</span>
                            <span className="block truncate text-xs text-ink-soft">{deal.title}</span>
                          </span>
                        </p>
                        <p className="mt-2 text-xs text-ink-soft">
                          {deal.purpose === "locacao" ? "Locação" : "Compra"}:{" "}
                          {deal.value ? formatCompactBRL(Number(deal.value)) : "valor não definido"}
                          {deal.temperature ? ` · ${DEAL_TEMPERATURE_LABEL[deal.temperature]}` : ""}
                        </p>
                        <p className="mt-1 flex flex-wrap gap-x-3 text-[0.6875rem] text-muted">
                          <span>{relative(deal.created_at, now)}</span>
                          {next ? (
                            <span className={late ? "font-medium text-danger" : ""}>
                              {late ? "Atrasada" : "Próxima"}: {formatLocalDay(next.starts_at)}
                            </span>
                          ) : (
                            <span>Sem atividade agendada</span>
                          )}
                          {deal.property ? <span>{deal.property.code}</span> : null}
                        </p>
                      </Link>
                      <label className="mt-2 flex items-center gap-2 border-t border-line pt-2 text-[0.6875rem] text-muted lg:sr-only lg:group-focus-within:not-sr-only">
                        Mover para
                        <select
                          value={deal.stage}
                          onChange={(event) => {
                            const target = event.target.value as OpenStage;
                            move(deal.id, target, 0);
                          }}
                          className="h-8 flex-1 rounded-[var(--radius-xs)] border border-line bg-surface px-1.5 text-xs text-ink"
                        >
                          {OPEN_STAGES.map((value) => (
                            <option key={value} value={value}>
                              {DEAL_STAGE_LABEL[value]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
