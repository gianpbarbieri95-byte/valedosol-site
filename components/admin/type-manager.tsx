"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { savePropertyType, deletePropertyType } from "@/actions/admin/content";
import { IDLE_STATE } from "@/lib/validations/lead";
import { slugify } from "@/lib/format";
import { Field, Input, Select } from "@/components/ui/primitives";
import { FormMessage, SubmitButton } from "@/components/forms/form-parts";
import type { PropertyType } from "@/types/database";

export function TypeManager({ types, isAdmin }: { types: PropertyType[]; isAdmin: boolean }) {
  const [state, action] = useActionState(savePropertyType, IDLE_STATE);
  const [editing, setEditing] = useState<PropertyType | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") return;
    const timer = setTimeout(() => {
      setEditing(null);
      setName("");
      setSlug("");
      router.refresh();
    }, 700);
    return () => clearTimeout(timer);
  }, [state.status, router]);

  function startEdit(type: PropertyType) {
    setEditing(type);
    setName(type.name);
    setSlug(type.slug);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
      <form action={action} className="space-y-5 rounded-[var(--radius-md)] border border-line bg-surface p-6">
        {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

        <h2 className="text-lg">{editing ? `Editar ${editing.name}` : "Novo tipo"}</h2>

        <Field label="Nome" htmlFor="t-nome" required error={state.errors?.name}>
          <Input
            id="t-nome"
            name="name"
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!editing) setSlug(slugify(event.target.value));
            }}
            placeholder="Casa em Condomínio"
          />
        </Field>

        <Field
          label="Identificador"
          htmlFor="t-slug"
          required
          error={state.errors?.slug}
          hint="Usado no filtro da busca: /imoveis?tipo=este-texto"
        >
          <Input
            id="t-slug"
            name="slug"
            required
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            onBlur={(event) => setSlug(slugify(event.target.value))}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Ordem" htmlFor="t-ordem">
            <Input id="t-ordem" name="sort_order" type="number" min={0} defaultValue={editing?.sort_order ?? 0} key={editing?.id ?? "novo-ordem"} />
          </Field>

          <Field label="Ativo" htmlFor="t-ativo">
            <Select id="t-ativo" name="active" defaultValue={editing ? (editing.active ? "on" : "") : "on"} key={editing?.id ?? "novo-ativo"}>
              <option value="on">Sim</option>
              <option value="">Não</option>
            </Select>
          </Field>
        </div>

        <FormMessage state={state} />

        <div className="flex gap-2">
          <SubmitButton size="md">{editing ? "Salvar" : "Criar tipo"}</SubmitButton>
          {editing ? (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setName("");
                setSlug("");
              }}
              className="h-11 px-3 text-sm text-ink-soft hover:text-ink"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface">
        {types.map((type) => (
          <li key={type.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div>
              <p className="text-sm font-medium text-ink">
                {type.name}
                {!type.active ? <span className="ml-2 text-xs text-muted">(inativo)</span> : null}
              </p>
              <p className="text-xs text-muted">{type.slug}</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => startEdit(type)}
                className="text-xs text-ink-soft transition-colors hover:text-primary"
              >
                Editar
              </button>

              {isAdmin ? (
                <form action={deletePropertyType}>
                  <input type="hidden" name="id" value={type.id} />
                  <button type="submit" className="text-xs text-muted transition-colors hover:text-danger">
                    Excluir
                  </button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
