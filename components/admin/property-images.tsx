"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { storageUrl } from "@/lib/supabase/env";
import { STORAGE_BUCKETS } from "@/lib/site";
import { slugify } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  deletePropertyImage,
  registerPropertyImages,
  reorderPropertyImages,
  setCoverImage,
} from "@/actions/admin/properties";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/ui/icons";
import type { PropertyImage } from "@/types/database";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Fotos do imóvel: envio, ordem, capa e exclusão.
 *
 * O upload vai direto do navegador para o Storage usando a sessão do usuário
 * (as policies do bucket exigem equipe autenticada). Só os caminhos passam
 * pela server action — empurrar 15 fotos por server action seria lento e
 * esbarraria no limite de tamanho do corpo da requisição.
 */
export function PropertyImages({
  propertyId,
  propertyCode,
  images,
}: {
  propertyId: string;
  propertyCode: string;
  images: PropertyImage[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  const sorted = order
    ? (order.map((id) => images.find((image) => image.id === id)).filter(Boolean) as PropertyImage[])
    : images;

  async function upload(files: File[]) {
    setError(null);

    const valid: File[] = [];
    for (const file of files) {
      if (!ACCEPTED.includes(file.type)) {
        setError(`${file.name}: envie JPG, PNG, WEBP ou AVIF.`);
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name}: acima de 10 MB.`);
        return;
      }
      valid.push(file);
    }

    if (!valid.length) return;

    setUploading(true);
    setProgress({ done: 0, total: valid.length });

    const supabase = createClient();
    const folder = `${slugify(propertyCode)}`;
    const paths: string[] = [];

    for (const [index, file] of valid.entries()) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${folder}/${Date.now()}-${index}-${slugify(file.name.replace(/\.[^.]+$/, "")).slice(0, 50)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKETS.property)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        setError(`Falha ao enviar ${file.name}: ${uploadError.message}`);
        setUploading(false);
        // As que já subiram são registradas, para o trabalho não se perder.
        if (paths.length) await registerPropertyImages(propertyId, paths);
        router.refresh();
        return;
      }

      paths.push(path);
      setProgress({ done: index + 1, total: valid.length });
    }

    const result = await registerPropertyImages(propertyId, paths);
    if (result.status === "error") setError(result.message ?? "Falha ao salvar as fotos.");

    setUploading(false);
    setProgress({ done: 0, total: 0 });
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...sorted.map((image) => image.id)];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  function saveOrder() {
    if (!order) return;
    startTransition(async () => {
      const result = await reorderPropertyImages(propertyId, order);
      if (result.status === "error") setError(result.message ?? null);
      setOrder(null);
      router.refresh();
    });
  }

  return (
    <section className="rounded-[var(--radius-md)] border border-line bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg">Fotos</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {images.length === 0
              ? "Nenhuma foto ainda."
              : `${images.length} ${images.length === 1 ? "foto" : "fotos"}. A capa é a primeira que aparece no site.`}
          </p>
        </div>

        {order ? (
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={saveOrder} disabled={pending}>
              {pending ? "Salvando…" : "Salvar ordem"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOrder(null)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        ) : null}
      </div>

      {/* Área de envio */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void upload(Array.from(event.dataTransfer.files));
        }}
        className={cn(
          "mt-5 rounded-[var(--radius-sm)] border border-dashed px-5 py-8 text-center transition-colors",
          dragOver ? "border-primary bg-primary-soft" : "border-line-strong bg-canvas"
        )}
      >
        <p className="text-sm text-ink-soft">
          Arraste as fotos aqui ou{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            escolha os arquivos
          </button>
        </p>
        <p className="mt-1.5 text-xs text-muted">JPG, PNG, WEBP ou AVIF, até 10 MB cada.</p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length) void upload(files);
          }}
        />

        {uploading ? (
          <p role="status" className="mt-4 text-sm text-primary">
            Enviando {progress.done} de {progress.total}…
          </p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-[var(--radius-sm)] border border-danger/20 bg-[#fbf0ef] px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {sorted.length ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((image, index) => {
            const url = storageUrl(STORAGE_BUCKETS.property, image.storage_path);

            return (
              <li key={image.id} className="group relative overflow-hidden rounded-[var(--radius-sm)] border border-line">
                <div className="relative aspect-[4/3] bg-surface-alt">
                  {url ? (
                    <Image src={url} alt={image.alt_text ?? ""} fill sizes="240px" className="object-cover" />
                  ) : null}

                  {image.is_cover ? (
                    <span className="absolute left-2 top-2">
                      <Badge tone="primary">Capa</Badge>
                    </span>
                  ) : null}

                  <form action={deletePropertyImage} className="absolute right-2 top-2">
                    <input type="hidden" name="id" value={image.id} />
                    <input type="hidden" name="property_id" value={propertyId} />
                    <button
                      type="submit"
                      aria-label="Remover foto"
                      className="grid size-7 place-items-center rounded-full bg-surface/90 text-ink-soft opacity-0 backdrop-blur-sm transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <CloseIcon className="size-4" />
                    </button>
                  </form>
                </div>

                <div className="flex items-center justify-between gap-1 border-t border-line bg-surface px-2 py-1.5">
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label="Mover para trás"
                      className="grid size-7 place-items-center rounded-[var(--radius-xs)] text-ink-soft hover:bg-surface-alt disabled:opacity-30"
                    >
                      <ChevronLeftIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === sorted.length - 1}
                      aria-label="Mover para frente"
                      className="grid size-7 place-items-center rounded-[var(--radius-xs)] text-ink-soft hover:bg-surface-alt disabled:opacity-30"
                    >
                      <ChevronRightIcon className="size-4" />
                    </button>
                  </div>

                  {!image.is_cover ? (
                    <form action={setCoverImage}>
                      <input type="hidden" name="id" value={image.id} />
                      <input type="hidden" name="property_id" value={propertyId} />
                      <button type="submit" className="px-1.5 text-xs text-ink-soft hover:text-primary">
                        Usar como capa
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
