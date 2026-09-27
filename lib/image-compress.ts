/**
 * Reduz a foto no navegador antes do envio.
 *
 * Foto de celular sai com 4000px e 5 a 12 MB: demora para subir no 4G e
 * passava do limite de 10 MB. O site nunca mostra nada acima de ~2000px,
 * então 2400px no lado maior sobra com folga para a galeria em tela cheia.
 *
 * O desenho passa por um <img>, que já aplica a rotação do EXIF — a foto
 * tirada em pé continua em pé.
 */

const MAX_SIDE = 2400;
const QUALITY = 0.85;
/** Abaixo disso, e já no tamanho certo, a foto vai como está. */
const KEEP_BELOW_BYTES = 1.5 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("formato não suportado"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export interface CompressOptions {
  maxSide?: number;
  quality?: number;
  keepBelowBytes?: number;
}

export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  const { maxSide = MAX_SIDE, quality = QUALITY, keepBelowBytes = KEEP_BELOW_BYTES } = options;
  const image = await loadImage(file);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const alreadyWebReady = ["image/jpeg", "image/webp"].includes(file.type);

  if (alreadyWebReady && longest <= maxSide && file.size <= keepBelowBytes) return file;

  const scale = Math.min(1, maxSide / longest);
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;

  // PNG com transparência viraria fundo preto no JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, quality);
  // Libera a memória do canvas já: no celular, 20 fotos seguidas pesam.
  canvas.width = 0;
  canvas.height = 0;

  // Saiu maior e não precisou diminuir (ou já era JPEG/WEBP): fica o original.
  if (!blob || (blob.size >= file.size && (alreadyWebReady || longest <= maxSide))) return file;

  const name = `${file.name.replace(/\.[^.]+$/, "") || "foto"}.jpg`;
  return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
}
