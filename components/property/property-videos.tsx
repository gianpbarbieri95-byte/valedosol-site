import { storageUrl } from "@/lib/supabase/env";
import { STORAGE_BUCKETS } from "@/lib/site";
import { formatDuration } from "@/lib/video";
import type { PropertyVideo } from "@/types/database";

/**
 * Vídeos na página do imóvel: o player nativo do navegador, que no celular
 * já oferece tela cheia e toca dentro da página no iPhone (playsInline).
 *
 * preload="none" com capa: o vídeo só começa a baixar quando a pessoa toca
 * em play — a página continua leve e o armazenamento não paga tráfego de quem
 * só passou por ali. Sem capa, baixa só o começo para mostrar o primeiro quadro.
 *
 * Vídeo em pé (9:16) não ocupa a tela inteira no computador: a largura é
 * limitada pela altura máxima, mantendo a proporção.
 */
export function PropertyVideoList({ videos, title }: { videos: PropertyVideo[]; title: string }) {
  return (
    <div className="space-y-6">
      {videos.map((video, index) => {
        const url = storageUrl(STORAGE_BUCKETS.video, video.storage_path);
        if (!url) return null;
        const poster = storageUrl(STORAGE_BUCKETS.video, video.poster_path) ?? undefined;
        const ratio = video.width && video.height ? video.width / video.height : 16 / 9;
        const duration = formatDuration(video.duration_seconds);
        const label = videos.length > 1 ? `Vídeo ${index + 1} de ${videos.length} — ${title}` : `Vídeo — ${title}`;

        return (
          <figure key={video.id}>
            <div
              className="mx-auto w-full overflow-hidden rounded-[var(--radius-xs)] bg-[#060f0b]"
              style={{ aspectRatio: `${ratio}`, maxWidth: `min(100%, calc(78vh * ${ratio.toFixed(4)}))` }}
            >
              <video
                controls
                playsInline
                preload={poster ? "none" : "metadata"}
                poster={poster}
                aria-label={label}
                className="size-full object-contain"
              >
                {/* Sem type de propósito: o Chrome recusa um "video/quicktime" declarado,
                    mas toca o .mov do iPhone (H.264) se simplesmente tentar. */}
                <source src={poster ? url : `${url}#t=0.1`} />
                <a href={url}>Baixar o vídeo</a>
              </video>
            </div>
            {duration ? (
              <figcaption className="label-caps mt-3 text-center text-[0.625rem] text-muted tabular">{duration}</figcaption>
            ) : null}
          </figure>
        );
      })}
    </div>
  );
}
