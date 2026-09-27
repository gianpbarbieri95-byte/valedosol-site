"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { storageUrl } from "@/lib/supabase/env";
import { STORAGE_BUCKETS } from "@/lib/site";
import { slugify } from "@/lib/format";
import { cn } from "@/lib/utils";
import { uploadResumable, UploadTooLargeError } from "@/lib/resumable-upload";
import {
  MAX_VIDEO_BYTES,
  formatBytes,
  formatDuration,
  isHevc,
  readVideoInfo,
  videoExtension,
  videoMimeType,
} from "@/lib/video";
import { deletePropertyVideo, registerPropertyVideo, reorderPropertyVideos } from "@/actions/admin/videos";
import { Button } from "@/components/ui/button";
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "@/components/ui/icons";
import type { PropertyVideo } from "@/types/database";

interface Progress {
  index: number;
  total: number;
  name: string;
  phase: "preparing" | "uploading" | "saving";
  sent: number;
  size: number;
}

/**
 * Vídeos do imóvel: gravar ou escolher no celular, enviar, ordenar e apagar.
 *
 * O vídeo vai inteiro, como o celular gravou — sem conversão no aparelho. O
 * envio é retomável (lib/resumable-upload.ts): se o 4G cair, continua de onde
 * parou. Um vídeo por vez, porque cada um já ocupa a conexão inteira.
 */
export function PropertyVideos({
  propertyId,
  propertyCode,
  videos,
  installed,
}: {
  propertyId: string;
  propertyCode: string;
  videos: PropertyVideo[];
  installed: boolean;
}) {
  const router = useRouter();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();
  const uploading = progress !== null;

  // Sair da tela no meio do envio perde o vídeo: o navegador pergunta antes.
  useEffect(() => {
    if (!uploading) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  const sorted = order
    ? (order.map((id) => videos.find((video) => video.id === id)).filter(Boolean) as PropertyVideo[])
    : videos;

  async function upload(files: File[]) {
    if (uploading || !files.length) return;
    setError(null);
    setNotice(null);

    // Tela acesa durante o envio: com a tela apagada o celular pausa a conexão.
    let wakeLock: { release: () => Promise<void> } | null = null;
    try {
      wakeLock = await (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null;
    } catch {
      wakeLock = null;
    }

    const supabase = createClient();
    const folder = slugify(propertyCode) || "imovel";
    const failures: string[] = [];
    const warnings: string[] = [];
    let saved = 0;

    for (const [index, file] of files.entries()) {
      const base = { index, total: files.length, name: file.name, sent: 0, size: file.size };
      const mime = videoMimeType(file);

      if (!mime) {
        failures.push(`${file.name}: formato não aceito (envie MP4, MOV ou WEBM)`);
        continue;
      }
      if (file.size > MAX_VIDEO_BYTES) {
        failures.push(`${file.name}: ${formatBytes(file.size)}, acima de ${formatBytes(MAX_VIDEO_BYTES)}`);
        continue;
      }

      setProgress({ ...base, phase: "preparing" });
      const [info, hevc] = await Promise.all([readVideoInfo(file), isHevc(file).catch(() => false)]);
      if (hevc) warnings.push(file.name);

      const stamp = `${Date.now()}-${index}`;
      const name = slugify(file.name.replace(/\.[^.]+$/, "")).slice(0, 40) || "video";
      const videoPath = `${folder}/${stamp}-${name}.${videoExtension(mime)}`;
      let posterPath: string | null = `${folder}/${stamp}-${name}-capa.jpg`;

      if (info.poster) {
        const { error: posterError } = await supabase.storage
          .from(STORAGE_BUCKETS.video)
          .upload(posterPath, info.poster, { contentType: "image/jpeg", upsert: false });
        if (posterError) posterPath = null;
      } else {
        posterPath = null;
      }

      try {
        setProgress({ ...base, phase: "uploading" });
        await uploadResumable(file, {
          bucket: STORAGE_BUCKETS.video,
          path: videoPath,
          contentType: mime,
          onProgress: (sent) => setProgress({ ...base, phase: "uploading", sent }),
        });
      } catch (uploadError) {
        if (posterPath) await supabase.storage.from(STORAGE_BUCKETS.video).remove([posterPath]);
        failures.push(
          uploadError instanceof UploadTooLargeError
            ? `${file.name}: ${formatBytes(file.size)} passa do limite de tamanho do armazenamento (veja o aviso abaixo)`
            : `${file.name}: ${uploadError instanceof Error ? uploadError.message : "falha no envio"}`
        );
        continue;
      }

      setProgress({ ...base, phase: "saving", sent: file.size });
      const result = await registerPropertyVideo({
        property_id: propertyId,
        storage_path: videoPath,
        poster_path: posterPath,
        mime_type: mime as "video/mp4" | "video/quicktime" | "video/webm",
        size_bytes: file.size,
        duration_seconds: info.duration,
        width: info.width,
        height: info.height,
      });

      if (result.status === "error") {
        await supabase.storage.from(STORAGE_BUCKETS.video).remove([videoPath, posterPath].filter((p): p is string => Boolean(p)));
        failures.push(`${file.name}: ${result.message}`);
      } else {
        saved++;
      }
    }

    await wakeLock?.release().catch(() => undefined);
    setProgress(null);
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";

    const messages: string[] = [];
    if (saved) messages.push(`${saved} ${saved === 1 ? "vídeo enviado" : "vídeos enviados"}.`);
    if (warnings.length) {
      messages.push(
        `${warnings.join(", ")} ${warnings.length === 1 ? "foi gravado" : "foram gravados"} em HEVC (H.265): toca no iPhone e no Mac, mas pode não tocar em parte dos celulares Android e computadores Windows. No iPhone, para os próximos: Ajustes › Câmera › Formatos › "Mais Compatível".`
      );
    }
    if (messages.length) setNotice(messages.join(" "));
    if (failures.length) setError(`Não foi possível enviar: ${failures.join("; ")}.`);
    router.refresh();
  }

  function move(index: number, direction: -1 | 1) {
    const next = sorted.map((video) => video.id);
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  function saveOrder() {
    if (!order) return;
    startTransition(async () => {
      const result = await reorderPropertyVideos(propertyId, order);
      if (result.status === "error") setError(result.message ?? null);
      setOrder(null);
      router.refresh();
    });
  }

  const pickerClass =
    "h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-4 text-sm font-medium " +
    "transition-colors disabled:opacity-50 sm:flex-none";

  if (!installed) {
    return (
      <section className="rounded-[var(--radius-md)] border border-line bg-surface p-4 sm:p-6">
        <h2 className="text-lg">Vídeos</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Instalação pendente: rode <code>supabase/migrations/0007_videos.sql</code> no SQL Editor do Supabase para
          liberar o envio de vídeos.
        </p>
      </section>
    );
  }

  const percent = progress && progress.size ? Math.round((progress.sent / progress.size) * 100) : 0;

  return (
    <section className="rounded-[var(--radius-md)] border border-line bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg">Vídeos</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {videos.length === 0
              ? "Nenhum vídeo ainda. Um tour curto pelos ambientes costuma bastar."
              : `${videos.length} ${videos.length === 1 ? "vídeo" : "vídeos"}. Aparecem na página do imóvel, nesta ordem.`}
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

      <div className="mt-5 rounded-[var(--radius-sm)] border border-dashed border-line-strong bg-canvas px-4 py-5 text-center sm:px-5 sm:py-8">
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {/* Só em tela de toque: abre a câmera já em modo vídeo. */}
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className={cn(pickerClass, "hidden bg-primary text-white hover:bg-primary-hover pointer-coarse:inline-flex")}
          >
            <CameraIcon className="size-5" />
            Gravar vídeo
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={uploading}
            className={cn(pickerClass, "inline-flex border border-line-strong bg-surface text-ink hover:border-primary hover:text-primary")}
          >
            <span className="pointer-coarse:hidden">Escolher vídeos no computador</span>
            <span className="hidden pointer-coarse:inline">Escolher da galeria</span>
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          MP4 ou MOV, como o celular gravou. Em pé ou deitado, os dois funcionam. De preferência no Wi-Fi: um
          minuto em 1080p tem uns 100 MB.
        </p>

        <input
          ref={galleryRef}
          type="file"
          multiple
          accept="video/mp4,video/quicktime,video/webm,video/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => void upload(Array.from(event.target.files ?? []))}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => void upload(Array.from(event.target.files ?? []))}
        />

        {progress ? (
          <div role="status" className="mx-auto mt-5 max-w-sm text-left">
            <div className="flex justify-between gap-3 text-[0.8125rem] text-primary">
              <span className="truncate">
                {progress.phase === "preparing"
                  ? "Preparando o vídeo…"
                  : progress.phase === "saving"
                    ? "Salvando…"
                    : `Enviando${progress.total > 1 ? ` ${progress.index + 1} de ${progress.total}` : ""}…`}
              </span>
              <span className="shrink-0 tabular-nums">
                {progress.phase === "uploading" ? `${formatBytes(progress.sent)} de ${formatBytes(progress.size)}` : ""}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${progress.phase === "preparing" ? 2 : percent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              Mantenha esta tela aberta até terminar. Se a internet cair, o envio continua sozinho quando ela voltar.
            </p>
          </div>
        ) : null}
      </div>

      {notice && !uploading ? (
        <p role="status" className="mt-4 rounded-[var(--radius-sm)] border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-primary">
          {notice}
        </p>
      ) : null}

      {error ? (
        <div role="alert" className="mt-4 rounded-[var(--radius-sm)] border border-danger/20 bg-[#fbf0ef] px-4 py-3 text-sm text-danger">
          <p>{error}</p>
          {error.includes("limite de tamanho") ? (
            <p className="mt-2 text-xs text-ink-soft">
              O Supabase limita o tamanho de cada arquivo (no plano gratuito, 50 MB). Grave vídeos mais curtos ou em
              1080p, corte o vídeo no próprio celular antes de enviar, ou peça para aumentar o limite em Storage ›
              Settings (plano Pro).
            </p>
          ) : null}
        </div>
      ) : null}

      {sorted.length ? (
        <ul className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {sorted.map((video, index) => {
            const url = storageUrl(STORAGE_BUCKETS.video, video.storage_path);
            const poster = storageUrl(STORAGE_BUCKETS.video, video.poster_path) ?? undefined;
            const duration = formatDuration(video.duration_seconds);

            return (
              <li key={video.id} className="overflow-hidden rounded-[var(--radius-sm)] border border-line">
                <div className="relative aspect-video bg-[#060f0b]">
                  {url ? (
                    <video
                      src={poster ? url : `${url}#t=0.5`}
                      poster={poster}
                      controls
                      playsInline
                      preload="metadata"
                      className="size-full object-contain"
                    />
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
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-line bg-surface p-1 pl-3">
                  <p className="text-xs text-muted tabular-nums">
                    {[duration, video.size_bytes ? formatBytes(video.size_bytes) : null].filter(Boolean).join(" · ")}
                  </p>
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
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
