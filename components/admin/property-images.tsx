"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { storageUrl } from "@/lib/supabase/env";
import { STORAGE_BUCKETS } from "@/lib/site";
import { slugify } from "@/lib/format";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/image-compress";
import {
  deletePropertyImage,
  registerPropertyImages,
  reorderPropertyImages,
  setCoverImage,
} from "@/actions/admin/properties";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/ui/icons";
import type { PropertyImage } from "@/types/database";

/* Tipos e limite aceitos pelo bucket (supabase/migrations/0003_storage.sql). */
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 10 * 1024 * 1024;
/** Envios em paralelo: rápido no Wi-Fi sem engasgar o 4G. */
const CONCURRENCY = 3;

type Phase = "preparing" | "uploading";

/**
 * Fotos do imóvel: envio, ordem, capa e exclusão.
 *
 * O upload vai direto do navegador para o Storage usando a sessão do usuário
 * (as policies do bucket exigem equipe autenticada). Só os caminhos passam
 * pela server action — empurrar 15 fotos por server action seria lento e
 * esbarraria no limite de tamanho do corpo da requisição.
 *
 * Antes de subir, cada foto é reduzida no próprio aparelho (lib/image-compress):
 * a foto do celular chega em segundos, e não em minutos.
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
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState<Phase>("preparing");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  const sorted = order
    ? (order.map((id) => images.find((image) => image.id === id)).filter(Boolean) as PropertyImage[])
    : images;

  async function upload(files: File[]) {
    if (uploading || !files.length) return;
    setError(null);
    setNotice(null);
    setUploading(true);
    setPhase("preparing");
    setProgress({ done: 0, total: files.length });

    const supabase = createClient();
    const folder = slugify(propertyCode);
    const batch = Date.now();
    // Mantém a ordem em que as fotos foram escolhidas, mesmo subindo em paralelo.
    const paths: Array<string | null> = new Array(files.length).fill(null);
    const failures: string[] = [];
    let next = 0;
    let done = 0;

    async function worker() {
      while (next < files.length) {
        const index = next++;
        const original = files[index];

        let file: File;
        try {
          file = await compressImage(original);
        } catch {
          failures.push(`${original.name} (formato não suportado — envie JPG ou PNG)`);
          setProgress({ done: ++done, total: files.length });
          continue;
        }

        if (!ACCEPTED.includes(file.type)) {
          failures.push(`${original.name} (envie JPG, PNG, WEBP ou AVIF)`);
        } else if (file.size > MAX_BYTES) {
          failures.push(`${original.name} (acima de 10 MB)`);
        } else {
          setPhase("uploading");
          const extension = file.type === "image/jpeg" ? "jpg" : (file.type.split("/")[1] ?? "jpg");
          const base = slugify(original.name.replace(/\.[^.]+$/, "")).slice(0, 50) || "foto";
          const path = `${folder}/${batch}-${index}-${base}.${extension}`;

          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKETS.property)
            .upload(path, file, { contentType: file.type, upsert: false });

          if (uploadError) failures.push(`${original.name} (${uploadError.message})`);
          else paths[index] = path;
        }

        setProgress({ done: ++done, total: files.length });
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));

    // As que subiram são registradas mesmo se outras falharam: o trabalho não se perde.
    const uploaded = paths.filter((path): path is string => Boolean(path));
    if (uploaded.length) {
      const result = await registerPropertyImages(propertyId, uploaded);
      if (result.status === "error") failures.push(result.message ?? "Falha ao salvar as fotos.");
      else setNotice(`${uploaded.length} ${uploaded.length === 1 ? "foto enviada" : "fotos enviadas"}.`);
    }

    if (failures.length) {
      setError(
        failures.length === 1
          ? `Não foi possível enviar ${failures[0]}.`
          : `Não foi possível enviar ${failures.length} fotos: ${failures.join("; ")}.`
      );
    }

    setUploading(false);
    setProgress({ done: 0, total: 0 });
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
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

  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const pickerClass =
    "h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-4 text-sm font-medium " +
    "transition-colors disabled:opacity-50 sm:flex-none";

  return (
    <section className="rounded-[var(--radius-md)] border border-line bg-surface p-4 sm:p-6">
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
          <div className="flex w-full gap-2 sm:w-auto">
            <Button type="button" size="sm" onClick={saveOrder} disabled={pending} className="flex-1 sm:flex-none">
              {pending ? "Salvando…" : "Salvar ordem"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOrder(null)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        ) : null}
      </div>

      {/* Área de envio: arrastar no computador, câmera ou galeria no celular. */}
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
          "mt-5 rounded-[var(--radius-sm)] border border-dashed px-4 py-5 text-center transition-colors sm:px-5 sm:py-8",
          dragOver ? "border-primary bg-primary-soft" : "border-line-strong bg-canvas"
        )}
      >
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {/* Só em tela de toque: abre direto a câmera traseira. */}
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className={cn(pickerClass, "hidden bg-primary text-white hover:bg-primary-hover pointer-coarse:inline-flex")}
          >
            <CameraIcon className="size-5" />
            Tirar foto
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={uploading}
            className={cn(
              pickerClass,
              "inline-flex border border-line-strong bg-surface text-ink hover:border-primary hover:text-primary"
            )}
          >
            <span className="pointer-coarse:hidden">Escolher fotos no computador</span>
            <span className="hidden pointer-coarse:inline">Escolher fotos</span>
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          <span className="pointer-coarse:hidden">Ou arraste as fotos para cá. </span>
          Pode escolher várias de uma vez — elas são reduzidas automaticamente antes de enviar.
        </p>

        <input
          ref={galleryRef}
          type="file"
          multiple
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => void upload(Array.from(event.target.files ?? []))}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => void upload(Array.from(event.target.files ?? []))}
        />

        {uploading ? (
          <div role="status" className="mx-auto mt-5 max-w-sm text-left">
            <div className="flex justify-between text-[0.8125rem] text-primary">
              <span>{phase === "preparing" ? "Preparando fotos…" : "Enviando fotos…"}</span>
              <span className="tabular-nums">
                {progress.done} de {progress.total}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">Não feche esta tela até terminar.</p>
          </div>
        ) : null}
      </div>

      {notice && !uploading ? (
        <p role="status" className="mt-4 rounded-[var(--radius-sm)] border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-primary">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-[var(--radius-sm)] border border-danger/20 bg-[#fbf0ef] px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {sorted.length ? (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {sorted.map((image, index) => {
            const url = storageUrl(STORAGE_BUCKETS.property, image.storage_path);

            return (
              <li key={image.id} className="group relative overflow-hidden rounded-[var(--radius-sm)] border border-line">
                <div className="relative aspect-[4/3] bg-surface-alt">
                  {url ? (
                    <Image src={url} alt={image.alt_text ?? ""} fill sizes="(min-width: 1024px) 240px, 50vw" className="object-cover" />
                  ) : null}

                  {image.is_cover ? (
                    <span className="absolute left-2 top-2">
                      <Badge tone="primary">Capa</Badge>
                    </span>
                  ) : null}

                  <form
                    action={deletePropertyImage}
                    onSubmit={(event) => {
                      // Apagar é definitivo e, no celular, um toque sem querer acontece.
                      if (!window.confirm("Remover esta foto? Não dá para desfazer.")) event.preventDefault();
                    }}
                    className="absolute right-1.5 top-1.5"
                  >
                    <input type="hidden" name="id" value={image.id} />
                    <input type="hidden" name="property_id" value={propertyId} />
                    <button
                      type="submit"
                      aria-label={`Remover foto ${index + 1}`}
                      className={cn(
                        "grid size-9 place-items-center rounded-full bg-surface/90 text-ink-soft shadow-sm backdrop-blur-sm transition-opacity hover:text-danger",
                        // Com mouse, aparece no hover; no toque, fica sempre visível.
                        "pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100"
                      )}
                    >
                      <CloseIcon className="size-4" />
                    </button>
                  </form>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1 border-t border-line bg-surface p-1">
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label="Mover para trás"
                      className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-xs)] text-ink-soft hover:bg-surface-alt disabled:opacity-30 sm:size-8"
                    >
                      <ChevronLeftIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === sorted.length - 1}
                      aria-label="Mover para frente"
                      className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-xs)] text-ink-soft hover:bg-surface-alt disabled:opacity-30 sm:size-8"
                    >
                      <ChevronRightIcon className="size-4" />
                    </button>
                  </div>

                  {!image.is_cover ? (
                    <form action={setCoverImage} className="max-sm:w-full">
                      <input type="hidden" name="id" value={image.id} />
                      <input type="hidden" name="property_id" value={propertyId} />
                      <button
                        type="submit"
                        className="h-10 w-full whitespace-nowrap rounded-[var(--radius-xs)] px-2 text-xs text-ink-soft hover:bg-surface-alt hover:text-primary max-sm:border max-sm:border-line sm:h-8"
                      >
                        Tornar capa
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
