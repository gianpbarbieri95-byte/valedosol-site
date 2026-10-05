/**
 * Carregador do next/image: as fotos do Supabase Storage são redimensionadas
 * pelo próprio Supabase (render/image), não pelo otimizador da Vercel.
 *
 * O plano grátis da Vercel cobre 5 mil transformações por mês, e o catálogo
 * (~800 fotos × larguras × formatos) passava disso com folga. O Supabase cobra
 * por foto de origem, não por variante, e já entrega WebP quando o navegador
 * aceita.
 *
 * `resize=contain` com só a largura mantém a proporção e nunca amplia a foto.
 * Sem ele, o Supabase preserva a altura original e achata a imagem.
 *
 * Com loaderFile, a rota /_next/image fica desligada: o que não vem do
 * Storage (logo, pôster do vídeo) é servido como está.
 */

const OBJECT_PATH = "/storage/v1/object/public/";
const RENDER_PATH = "/storage/v1/render/image/public/";
/** Limite de largura do render do Supabase. */
const MAX_WIDTH = 2500;

type LoaderArgs = { src: string; width: number; quality?: number };

export default function imageLoader({ src, width, quality }: LoaderArgs): string {
  if (!src.includes(OBJECT_PATH)) return src;

  const params = new URLSearchParams({
    width: String(Math.min(width, MAX_WIDTH)),
    resize: "contain",
    quality: String(quality ?? 75),
  });
  return `${src.replace(OBJECT_PATH, RENDER_PATH)}?${params}`;
}
