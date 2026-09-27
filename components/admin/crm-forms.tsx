"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { saveActivity, saveClient, saveDeal } from "@/actions/admin/crm";
import { IDLE_STATE, type FormState } from "@/lib/validations/lead";
import {
  ACTIVITY_KINDS,
  ACTIVITY_KIND_LABEL,
  CLIENT_KINDS,
  CLIENT_KIND_LABEL,
  DEAL_STAGES,
  DEAL_STAGE_LABEL,
  DEAL_TEMPERATURES,
  DEAL_TEMPERATURE_LABEL,
} from "@/lib/crm";
import { toLocalInput } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/forms/form-parts";
import { DecimalInput } from "@/components/admin/form-controls";
import type { Activity, Client, Deal, StaffMember } from "@/types/database";

/**
 * Formulários do CRM.
 *
 * Envio pelo onSubmit (e não por action={...}): com action, o React 19
 * limpa os campos não controlados depois de cada envio, e um erro de
 * validação apagaria tudo o que foi digitado.
 */
function useStickyForm(action: (state: FormState, data: FormData) => Promise<FormState>) {
  const [state, dispatch, pending] = useActionState(action, IDLE_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status !== "error") return;
    const first = Object.keys(state.errors ?? {})[0];
    const element = first ? formRef.current?.elements.namedItem(first) : null;
    if (element instanceof HTMLElement) {
      element.scrollIntoView({ block: "center", behavior: "smooth" });
      element.focus({ preventScroll: true });
    }
  }, [state]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };

  return { state, pending, formRef, onSubmit };
}

const checkboxClass = "size-5 shrink-0 rounded-[2px] border-line-strong accent-[var(--color-primary)] sm:size-4";

function StaffSelect({ id, staff, defaultValue }: { id: string; staff: StaffMember[]; defaultValue?: string | null }) {
  return (
    <Select id={id} name="assigned_to" defaultValue={defaultValue ?? ""}>
      <option value="">Eu mesmo(a)</option>
      {staff.map((member) => (
        <option key={member.id} value={member.id}>
          {member.name}
        </option>
      ))}
    </Select>
  );
}

/* ---------------------------------------------------------------- cliente */

export function ClientForm({ client, staff }: { client?: Client | null; staff: StaffMember[] }) {
  const { state, pending, formRef, onSubmit } = useStickyForm(saveClient);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-5">
      {client?.id ? <input type="hidden" name="id" value={client.id} /> : null}

      <Field label="Nome" htmlFor="c-nome" required error={state.errors?.name}>
        <Input id="c-nome" name="name" required defaultValue={client?.name ?? ""} autoComplete="off" />
      </Field>

      <fieldset>
        <legend className="mb-2 text-[0.8125rem] font-medium text-ink-soft">Perfil</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {CLIENT_KINDS.map((kind) => (
            <label key={kind} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm sm:min-h-0">
              <input
                type="checkbox"
                name="kinds"
                value={kind}
                defaultChecked={client?.kinds.includes(kind)}
                className={checkboxClass}
              />
              {CLIENT_KIND_LABEL[kind]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Telefone / WhatsApp" htmlFor="c-tel" error={state.errors?.phone}>
          <Input id="c-tel" name="phone" type="tel" inputMode="tel" defaultValue={client?.phone ?? ""} placeholder="(11) 99999-9999" />
        </Field>
        <Field label="Outro telefone" htmlFor="c-tel2" error={state.errors?.phone_secondary}>
          <Input id="c-tel2" name="phone_secondary" type="tel" inputMode="tel" defaultValue={client?.phone_secondary ?? ""} />
        </Field>
        <Field label="E-mail" htmlFor="c-email" error={state.errors?.email}>
          <Input id="c-email" name="email" type="email" inputMode="email" autoCapitalize="none" defaultValue={client?.email ?? ""} />
        </Field>
        <Field label="CPF / CNPJ" htmlFor="c-doc" error={state.errors?.document}>
          <Input id="c-doc" name="document" defaultValue={client?.document ?? ""} inputMode="numeric" />
        </Field>
        <Field label="Como chegou" htmlFor="c-origem" hint="Site, indicação, placa, portal…">
          <Input id="c-origem" name="source" defaultValue={client?.source ?? ""} list="c-origens" />
          <datalist id="c-origens">
            {["Site", "Indicação", "Placa", "Portal", "Instagram", "Facebook", "WhatsApp", "Telefone", "Visita à loja"].map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </Field>
        <Field label="Responsável" htmlFor="c-resp">
          <StaffSelect id="c-resp" staff={staff} defaultValue={client?.assigned_to} />
        </Field>
      </div>

      <Field label="Anotações" htmlFor="c-notas" hint="O que a pessoa procura, faixa de preço, preferências.">
        <Textarea id="c-notas" name="notes" rows={4} defaultValue={client?.notes ?? ""} />
      </Field>

      <FormMessage state={state} />
      <div>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Salvando…" : client?.id ? "Salvar cliente" : "Cadastrar cliente"}
        </Button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------- negócio */

export interface ClientOption {
  id: string;
  name: string;
  phone: string | null;
}

export interface PropertyOption {
  id: string;
  code: string;
  title: string;
  purpose: string;
  price: number | null;
}

export function DealForm({
  deal,
  clients,
  properties,
  staff,
  defaults,
}: {
  deal?: Deal | null;
  clients: ClientOption[];
  properties: PropertyOption[];
  staff: StaffMember[];
  defaults?: { client_id?: string; property_id?: string };
}) {
  const { state, pending, formRef, onSubmit } = useStickyForm(saveDeal);
  const [stage, setStage] = useState(deal?.stage ?? "qualificando");
  const [clientFilter, setClientFilter] = useState("");
  const [propertyId, setPropertyId] = useState(deal?.property_id ?? defaults?.property_id ?? "");
  const [purpose, setPurpose] = useState(deal?.purpose ?? "venda");
  const [title, setTitle] = useState(deal?.title ?? "");

  const visibleClients = clientFilter.trim()
    ? clients.filter((client) =>
        `${client.name} ${client.phone ?? ""}`.toLowerCase().includes(clientFilter.trim().toLowerCase())
      )
    : clients;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-5">
      {deal?.id ? <input type="hidden" name="id" value={deal.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Cliente" htmlFor="d-cliente" required error={state.errors?.client_id}>
          {clients.length > 12 ? (
            <Input
              aria-label="Filtrar clientes"
              placeholder="Filtrar por nome ou telefone…"
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
              className="mb-2"
            />
          ) : null}
          <Select id="d-cliente" name="client_id" required defaultValue={deal?.client_id ?? defaults?.client_id ?? ""}>
            <option value="" disabled>
              Escolha o cliente
            </option>
            {visibleClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
                {client.phone ? ` — ${client.phone}` : ""}
              </option>
            ))}
          </Select>
          <Link href="/clientes/novo" className="mt-1.5 inline-block text-xs font-medium text-primary hover:underline">
            + Cadastrar cliente novo
          </Link>
        </Field>

        <Field label="Imóvel de interesse" htmlFor="d-imovel" error={state.errors?.property_id}>
          <Select
            id="d-imovel"
            name="property_id"
            value={propertyId}
            onChange={(event) => {
              setPropertyId(event.target.value);
              const chosen = properties.find((property) => property.id === event.target.value);
              if (chosen) {
                setPurpose(chosen.purpose === "locacao" ? "locacao" : "venda");
                if (!title.trim()) setTitle(`${chosen.code} ${chosen.title}`.slice(0, 200));
              }
            }}
          >
            <option value="">Ainda não definido</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.code} — {property.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Título" htmlFor="d-titulo" required error={state.errors?.title} hint="Como o negócio aparece no funil.">
        <Input
          id="d-titulo"
          name="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Casa até R$ 800 mil no Arujá Hills"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Finalidade" htmlFor="d-finalidade" required>
          <Select id="d-finalidade" name="purpose" value={purpose} onChange={(event) => setPurpose(event.target.value as "venda" | "locacao")}>
            <option value="venda">Venda</option>
            <option value="locacao">Locação</option>
          </Select>
        </Field>
        <Field label="Etapa" htmlFor="d-etapa" required>
          <Select id="d-etapa" name="stage" value={stage} onChange={(event) => setStage(event.target.value as typeof stage)}>
            {DEAL_STAGES.map((value) => (
              <option key={value} value={value}>
                {DEAL_STAGE_LABEL[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Valor do negócio" htmlFor="d-valor" error={state.errors?.value}>
          <DecimalInput id="d-valor" name="value" prefix="R$" defaultValue={deal?.value} />
        </Field>
        <Field label="Temperatura" htmlFor="d-temp">
          <Select id="d-temp" name="temperature" defaultValue={deal?.temperature ?? ""}>
            <option value="">Sem avaliação</option>
            {DEAL_TEMPERATURES.map((value) => (
              <option key={value} value={value}>
                {DEAL_TEMPERATURE_LABEL[value]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {stage === "perdido" ? (
        <Field label="Motivo da perda" htmlFor="d-motivo">
          <Input id="d-motivo" name="lost_reason" defaultValue={deal?.lost_reason ?? ""} placeholder="Comprou com outra imobiliária, desistiu…" />
        </Field>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Responsável" htmlFor="d-resp">
          <StaffSelect id="d-resp" staff={staff} defaultValue={deal?.assigned_to} />
        </Field>
      </div>

      <Field label="Anotações" htmlFor="d-notas">
        <Textarea id="d-notas" name="notes" rows={4} defaultValue={deal?.notes ?? ""} />
      </Field>

      <FormMessage state={state} />
      <div>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Salvando…" : deal?.id ? "Salvar negócio" : "Criar negócio"}
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------- atividade */

export function ActivityForm({
  activity,
  staff,
  clients,
  deals,
  properties,
  defaults,
  returnTo,
  compact = false,
}: {
  activity?: Activity | null;
  staff: StaffMember[];
  clients: ClientOption[];
  deals: { id: string; title: string; client: { name: string } | null }[];
  properties: PropertyOption[];
  defaults?: { client_id?: string; deal_id?: string; property_id?: string; starts_at?: string };
  /** Para onde voltar depois de salvar (tela do negócio, agenda…). */
  returnTo?: string;
  /** Versão curta, dentro da ficha do negócio ou do cliente. */
  compact?: boolean;
}) {
  const { state, pending, formRef, onSubmit } = useStickyForm(saveActivity);
  const [allDay, setAllDay] = useState(activity?.all_day ?? false);
  const startDefault = activity ? toLocalInput(activity.starts_at) : (defaults?.starts_at ?? "");

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-4">
      {activity?.id ? <input type="hidden" name="id" value={activity.id} /> : null}
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

      <div className={cn("grid gap-4", !compact && "sm:grid-cols-[10rem_1fr]")}>
        <Field label="Tipo" htmlFor="a-tipo" required>
          <Select id="a-tipo" name="kind" defaultValue={activity?.kind ?? "ligacao"}>
            {ACTIVITY_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {ACTIVITY_KIND_LABEL[kind]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="O que fazer" htmlFor="a-titulo" required error={state.errors?.title}>
          <Input id="a-titulo" name="title" required defaultValue={activity?.title ?? ""} placeholder="Ligar para confirmar a visita" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={allDay ? "Dia" : "Início"} htmlFor="a-inicio" required error={state.errors?.starts_at}>
          <Input
            id="a-inicio"
            name="starts_at"
            type={allDay ? "date" : "datetime-local"}
            required
            defaultValue={allDay ? startDefault.slice(0, 10) : startDefault}
            key={allDay ? "dia" : "hora"}
          />
        </Field>
        {!allDay ? (
          <Field label="Término (opcional)" htmlFor="a-fim" error={state.errors?.ends_at}>
            <Input id="a-fim" name="ends_at" type="datetime-local" defaultValue={toLocalInput(activity?.ends_at)} />
          </Field>
        ) : null}
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm sm:min-h-0">
        <input type="checkbox" name="all_day" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} className={checkboxClass} />
        Dia inteiro, sem horário
      </label>

      <div className={cn("grid gap-4", !compact && "sm:grid-cols-3")}>
        <Field label="Cliente" htmlFor="a-cliente">
          <Select id="a-cliente" name="client_id" defaultValue={activity?.client_id ?? defaults?.client_id ?? ""}>
            <option value="">Nenhum</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Negócio" htmlFor="a-negocio">
          <Select id="a-negocio" name="deal_id" defaultValue={activity?.deal_id ?? defaults?.deal_id ?? ""}>
            <option value="">Nenhum</option>
            {deals.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.title}
                {deal.client ? ` — ${deal.client.name}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Imóvel" htmlFor="a-imovel">
          <Select id="a-imovel" name="property_id" defaultValue={activity?.property_id ?? defaults?.property_id ?? ""}>
            <option value="">Nenhum</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.code} — {property.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className={cn("grid gap-4", !compact && "sm:grid-cols-2")}>
        <Field label="Responsável" htmlFor="a-resp">
          <StaffSelect id="a-resp" staff={staff} defaultValue={activity?.assigned_to} />
        </Field>
      </div>

      <Field label="Anotações" htmlFor="a-notas">
        <Textarea id="a-notas" name="notes" rows={compact ? 2 : 3} defaultValue={activity?.notes ?? ""} />
      </Field>

      <FormMessage state={state} />
      <div>
        <Button type="submit" size={compact ? "sm" : "md"} disabled={pending} aria-busy={pending}>
          {pending ? "Salvando…" : activity?.id ? "Salvar atividade" : "Agendar"}
        </Button>
      </div>
    </form>
  );
}
