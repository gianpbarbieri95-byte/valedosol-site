"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { storageUrl } from "@/lib/supabase/env";
import { MAX_PROPERTY_VIDEOS, MAX_VIDEO_BYTES, STORAGE_BUCKETS } from "@/lib/site";
import { slugify } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deletePropertyVideo, registerPropertyVideos } from "@/actions/admin/properties";
import { CloseIcon, PlayIcon } from "@/components/ui/icons";
import type { PropertyVideo } from "@/types/database";

/* Tipos aceitos pelo bucket property-videos (migration 0006). */
const ACCEPTED: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
const MAX_MB = Math.round(MAX_VIDEO_BYTES / 1024 / 1024);

/**
 * Vídeos do imóvel, ao lado das fotos. Mesmo caminho das fotos: o arquivo vai
 * direto do navegador ao Storage (sessão da equipe) e só o caminho passa pela
 * server action. Vídeo não é comprimido no aparelho — por isso o limite de
 * tamanho por arquivo.
 */
export function PropertyVideos({
  propertyId,
  propertyCode,
  videos,
}: {
  propertyId: string;
  propertyCode: string;
  videos: PropertyVideo[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const room = Math.max(0, MAX_PROPERTY_VIDEOS - videos.length);
  const full = room === 0;

  async function upload(chosen: File[]) {
    if (uploading || !chosen.length) return;
    setError(null);
    setNotice(null);

    if (full) {
      setError(`Este imóvel já tem ${MAX_PROPERTY_VIDEOS} vídeos, o limite. Remova algum para enviar outro.`);
      return;
    }

    const files = chosen.slice(0, room);
    const skipped = chosen.length - files.length;
    setUploading(true);
    setProgress({ done: 0, total: files.length });

    const supabase = createClient();
    const folder = slugify(propertyCode);
    const batch = Date.now();
    const paths: string[] = [];
    const failures: string[] = [];

    // Um por vez: vídeo é pesado e, no 4G, dois em paralelo só atrasam os dois.
    for (const [index, file] of files.entries()) {
      const extension = ACCEPTED[file.type] ?? (/\.(mp4|mov|webm)$/i.exec(file.name)?.[1]?.toLowerCase() ?? null);
      if (!extension) {
        failures.push(`${file.name} (envie MP4, MOV ou WEBM)`);
      } else if (file.size > MAX_VIDEO_BYTES) {
        failures.push(`${file.name} (acima de ${MAX_MB} MB)`);
      } else {
        const contentType = extension === "mov" ? "video/quicktime" : `video/${extension}`;
        const base = slugify(file.name.replace(/\.[^.]+$/, "")).slice(0, 50) || "video";
        const path = `${folder}/${batch}-${index}-${base}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKETS.video)
          .upload(path, file, { contentType, upsert: false });

        if (uploadError) failures.push(`${file.name} (${uploadError.message})`);
        else paths.push(path);
      }
      setProgress({ done: index + 1, total: files.length });
    }

    if (paths.length) {
      const result = await registerPropertyVideos(propertyId, paths);
      if (result.status === "error") failures.push(result.message ?? "Falha ao salvar os vídeos.");
      else
        setNotice(
          `${paths.length} ${paths.length === 1 ? "vídeo enviado" : "vídeos enviados"}.` +
            (skipped ? ` ${skipped} ficou de fora: o limite é de ${MAX_PROPERTY_VIDEOS} vídeos por imóvel.` : "")
        );
    }

    if (failures.length) {
      setError(
        failures.length === 1
          ? `Não foi possível enviar ${failures[0]}.`
          : `Não foi possível enviar ${failures.length} vídeos: ${failures.join("; ")}.`
      );
    }

    setUploading(false);
    setProgress({ done: 0, total: 0 });
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <section className="rounded-[var(--radius-md)] border border-line bg-surface p-4 sm:p-6">
      <h2 className="text-lg">Vídeos</h2>
      <p className="mt-1 text-sm text-ink-soft">
        {videos.length === 0
          ? `Opcional. Até ${MAX_PROPERTY_VIDEOS} vídeos por imóvel; aparecem na página do imóvel, abaixo das fotos.`
          : `${videos.length} de ${MAX_PROPERTY_VIDEOS} vídeos.`}
      </p>

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
          "mt-5 rounded-[var(--radius-sm)] border border-dashed px-4 py-5 text-center transition-colors sm:px-5 sm:py-6",
          dragOver ? "border-primary bg-primary-soft" : "border-line-strong bg-canvas"
        )}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || full}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <PlayIcon className="size-4" />
          Escolher vídeo
        </button>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {full
            ? `Limite de ${MAX_PROPERTY_VIDEOS} vídeos atingido. Remova algum para enviar outro.`
            : `MP4, MOV (iPhone) ou WEBM, até ${MAX_MB} MB cada. Vídeos curtos (até 1 minuto, em 1080p) cabem com folga.`}
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => void upload(Array.from(event.target.files ?? []))}
        />

        {uploading ? (
          <div role="status" className="mx-auto mt-5 max-w-sm text-left">
            <div className="flex justify-between text-[0.8125rem] text-primary">
              <span>Enviando vídeo…</span>
              <span className="tabular-nums">
                {progress.done} de {progress.total}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
            </div>
            <p className="mt-2 text-xs text-muted">Vídeo demora mais que foto. Não feche esta tela até terminar.</p>
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

      {videos.length ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video, index) => {
            const url = storageUrl(STORAGE_BUCKETS.video, video.storage_path);
            return (
              <li key={video.id} className="relative overflow-hidden rounded-[var(--radius-sm)] border border-line bg-black">
                {url ? (
                  // #t=0.1 faz o navegador mostrar o primeiro quadro como prévia.
                  <video src={`${url}#t=0.1`} controls preload="metadata" playsInline className="aspect-video w-full" />
                ) : null}
                <form
                  action={deletePropertyVideo}
                  onSubmit={(event) => {
                    if (!window.confirm("Remover este vídeo? Não dá para desfazer.")) event.preventDefault();
                  }}
                  className="absolute right-1.5 top-1.5"
                >
                  <input type="hidden" name="id" value={video.id} />
                  <input type="hidden" name="property_id" value={propertyId} />
                  <button
                    type="submit"
                    aria-label={`Remover vídeo ${index + 1}`}
                    className="grid size-9 place-items-center rounded-full bg-surface/90 text-ink-soft shadow-sm backdrop-blur-sm hover:text-danger"
                  >
                    <CloseIcon className="size-4" />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
