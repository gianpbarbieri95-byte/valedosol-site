"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveRegion, deleteRegion } from "@/actions/admin/content";
import { IDLE_STATE } from "@/lib/validations/lead";
import { slugify } from "@/lib/format";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { FormMessage, SubmitButton } from "@/components/forms/form-parts";
import { Button } from "@/components/ui/button";
import { RegionImageField } from "@/components/admin/region-image-field";
import type { Region } from "@/types/database";

export function RegionManager({ regions, cities, isAdmin }: { regions: Region[]; cities: string[]; isAdmin: boolean }) {
  const [editing, setEditing] = useState<Region | null>(null);
  const [creating, setCreating] = useState(false);

  // Identidade estável: sem isto, o temporizador de fechamento do formulário
  // reiniciaria a cada renderização deste componente.
  const closeForm = useCallback(() => {
    setCreating(false);
    setEditing(null);
  }, []);

  return (
    <div className="space-y-5">
      {!creating && !editing ? (
        <Button type="button" onClick={() => setCreating(true)}>
          + Nova região
        </Button>
      ) : (
        <RegionForm key={editing?.id ?? "nova"} region={editing} cities={cities} onDone={closeForm} />
      )}

      {regions.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-line-strong bg-surface px-5 py-10 text-center text-sm text-ink-soft">
          Nenhuma região cadastrada. Crie as regiões e bairros de Arujá em que a Vale do Sol atua.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface">
          {regions.map((region) => (
            <li key={region.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {region.name}
                  {!region.active ? <span className="ml-2 text-xs text-muted">(inativa)</span> : null}
                </p>
                <p className="truncate text-xs text-muted">
                  {region.city} · /regioes/{region.slug}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(region)}>
                  Editar
                </Button>
                {isAdmin ? <DeleteRegion id={region.id} name={region.name} /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RegionForm({
  region,
  cities,
  onDone,
}: {
  region: Region | null;
  cities: string[];
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveRegion, IDLE_STATE);
  const [name, setName] = useState(region?.name ?? "");
  const [slug, setSlug] = useState(region?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(region?.slug));
  const router = useRouter();

  // Salvou: mostra o aviso por um instante, fecha o formulário e recarrega a
  // lista. Dentro de useEffect — agendar isso no corpo do componente faria o
  // temporizador reiniciar a cada renderização.
  useEffect(() => {
    if (state.status !== "success") return;

    const timer = setTimeout(() => {
      onDone();
      router.refresh();
    }, 700);

    return () => clearTimeout(timer);
  }, [state.status, onDone, router]);

  return (
    <form action={action} className="space-y-5 rounded-[var(--radius-md)] border border-line bg-surface p-6">
      {region?.id ? <input type="hidden" name="id" value={region.id} /> : null}

      <h2 className="text-lg">{region ? `Editar ${region.name}` : "Nova região"}</h2>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome" htmlFor="r-nome" required error={state.errors?.name}>
          <Input
            id="r-nome"
            name="name"
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
            placeholder="Condomínio Arujá Hills III"
          />
        </Field>

        <Field label="Endereço da página" htmlFor="r-slug" required error={state.errors?.slug} hint="/regioes/este-texto">
          <Input
            id="r-slug"
            name="slug"
            required
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            onBlur={(event) => setSlug(slugify(event.target.value))}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Cidade" htmlFor="r-cidade" required error={state.errors?.city}>
          <Input id="r-cidade" name="city" required defaultValue={region?.city ?? "Arujá"} list="cidades" />
        </Field>

        <Field label="Ordem" htmlFor="r-ordem" hint="Menor aparece antes.">
          <Input id="r-ordem" name="sort_order" type="number" min={0} defaultValue={region?.sort_order ?? 0} />
        </Field>

        <Field label="Visível no site" htmlFor="r-ativa">
          <Select id="r-ativa" name="active" defaultValue={region ? (region.active ? "on" : "") : "on"}>
            <option value="on">Sim</option>
            <option value="">Não</option>
          </Select>
        </Field>
      </div>

      <datalist id="cidades">
        {cities.map((city) => (
          <option key={city} value={city} />
        ))}
      </datalist>

      <Field label="Descrição" htmlFor="r-descricao" hint="Texto curto que aparece no topo da página da região.">
        <Textarea id="r-descricao" name="description" rows={3} defaultValue={region?.description ?? ""} />
      </Field>

      <RegionImageField slug={slug} defaultPath={region?.image_path} />

      <FormMessage state={state} />

      <div className="flex gap-2">
        <SubmitButton size="md">{region ? "Salvar região" : "Criar região"}</SubmitButton>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function DeleteRegion({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="px-2 text-xs text-muted transition-colors hover:text-danger"
      >
        Excluir
      </button>
    );
  }

  return (
    <form action={deleteRegion} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-xs text-ink-soft">Excluir {name}?</span>
      <button type="submit" className="text-xs font-medium text-danger hover:underline">
        Sim
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="text-xs text-muted hover:text-ink">
        Não
      </button>
    </form>
  );
}
