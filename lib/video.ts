/**
 * Vídeo do imóvel no navegador, antes do envio.
 *
 * Nada aqui converte o vídeo: recodificar no celular seria lento e gastaria
 * bateria. O que se faz é ler duração e proporção, tirar um quadro para servir
 * de capa (JPG pequeno) e avisar quando o arquivo é HEVC (H.265), que o
 * iPhone grava por padrão e que parte dos navegadores Android/Windows não toca.
 */

export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

/** Mesmo teto do bucket (0007_videos.sql). O limite global do projeto pode ser menor. */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

export interface VideoInfo {
  duration: number | null;
  width: number | null;
  height: number | null;
  poster: Blob | null;
}

const POSTER_MAX_SIDE = 1280;
const INFO_TIMEOUT_MS = 20_000;

/**
 * Tipo do arquivo. Alguns celulares Android entregam o vídeo sem MIME; nesse
 * caso vale a extensão.
 */
export function videoMimeType(file: File): string | null {
  if (VIDEO_TYPES.includes(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "mp4" || extension === "m4v") return "video/mp4";
  if (extension === "mov" || extension === "qt") return "video/quicktime";
  if (extension === "webm") return "video/webm";
  return null;
}

export function videoExtension(mime: string): string {
  return mime === "video/quicktime" ? "mov" : mime === "video/webm" ? "webm" : "mp4";
}

/** Lê duração, tamanho e um quadro de capa. Se o navegador não decodificar, volta vazio. */
export function readVideoInfo(file: File): Promise<VideoInfo> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const empty: VideoInfo = { duration: null, width: null, height: null, poster: null };
    let settled = false;

    const finish = (info: VideoInfo) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(info);
    };

    const timer = setTimeout(() => finish(empty), INFO_TIMEOUT_MS);

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onerror = () => finish(empty);

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      // Um segundo para dentro evita o quadro preto do começo; em vídeo curto, 10%.
      video.currentTime = duration ? Math.min(1, duration / 10) : 0;
    };

    video.onseeked = () => {
      const width = video.videoWidth || null;
      const height = video.videoHeight || null;
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      if (!width || !height) return finish({ ...empty, duration });

      const scale = Math.min(1, POSTER_MAX_SIDE / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const context = canvas.getContext("2d");
      if (!context) return finish({ duration, width, height, poster: null });

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (poster) => {
          canvas.width = 0;
          canvas.height = 0;
          finish({ duration, width, height, poster });
        },
        "image/jpeg",
        0.8
      );
    };

    video.src = url;
  });
}

/**
 * HEVC deixa a marca "hvc1"/"hev1" na descrição das trilhas (átomo moov),
 * que fica no começo ou no fim do arquivo. Olhar 2 MB de cada ponta basta.
 */
export async function isHevc(file: File): Promise<boolean> {
  const span = 2 * 1024 * 1024;
  const parts = file.size <= span * 2 ? [file] : [file.slice(0, span), file.slice(file.size - span)];
  for (const part of parts) {
    const bytes = new Uint8Array(await part.arrayBuffer());
    for (let i = 0; i < bytes.length - 3; i++) {
      // "hvc1" ou "hev1"
      if (bytes[i] === 0x68 && ((bytes[i + 1] === 0x76 && bytes[i + 2] === 0x63) || (bytes[i + 1] === 0x65 && bytes[i + 2] === 0x76)) && bytes[i + 3] === 0x31) {
        return true;
      }
    }
  }
  return false;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1).replace(".", ",")} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
