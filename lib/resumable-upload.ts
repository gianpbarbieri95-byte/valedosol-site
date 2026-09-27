"use client";

import { Upload, type DetailedError } from "tus-js-client";
import { createClient } from "@/lib/supabase/client";

/**
 * Envio retomável (protocolo TUS) direto do navegador para o Supabase Storage.
 *
 * Vídeo de celular tem dezenas ou centenas de MB. Num envio comum, uma queda
 * do 4G no meio perde tudo; aqui o arquivo sobe em pedaços de 6 MB (o tamanho
 * que o Supabase exige) e, se a conexão cair, continua de onde parou.
 *
 * Usa a sessão de quem está logado: as policies do bucket decidem quem pode
 * gravar, como no upload das fotos.
 */

const CHUNK_SIZE = 6 * 1024 * 1024;

export class UploadTooLargeError extends Error {}

export async function uploadResumable(
  file: Blob,
  { bucket, path, contentType, onProgress }: { bucket: string; path: string; contentType: string; onProgress?: (sent: number, total: number) => void }
): Promise<void> {
  const supabase = createClient();
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  async function accessToken(): Promise<string> {
    // getSession() renova o token vencido: um vídeo grande pode levar mais
    // que a validade de um token.
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Sessão expirada. Entre de novo no painel.");
    return data.session.access_token;
  }

  // Falha cedo, antes de ler o arquivo, se a sessão já caiu.
  await accessToken();

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${base}/storage/v1/upload/resumable`,
      chunkSize: CHUNK_SIZE,
      // Tenta de novo por até ~2 minutos: túnel, elevador, troca de antena.
      retryDelays: [0, 2000, 5000, 10000, 20000, 30000, 60000],
      // O authorization vai só no onBeforeRequest: definido aqui também, o XHR
      // juntaria os dois valores ("Bearer a, Bearer b") e o Supabase recusaria.
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      // Cada envio tem caminho próprio (com data e hora); retomar um envio de
      // outra visita gravaria no caminho antigo. A retomada vale dentro do
      // mesmo envio, que é onde a queda de conexão acontece.
      storeFingerprintForResuming: false,
      metadata: { bucketName: bucket, objectName: path, contentType, cacheControl: "31536000" },
      onBeforeRequest: async (request) => {
        request.setHeader("authorization", `Bearer ${await accessToken()}`);
      },
      onShouldRetry: (error: DetailedError) => {
        const status = error.originalResponse?.getStatus() ?? 0;
        // 4xx (sem permissão, arquivo grande demais, já existe) não melhora tentando de novo.
        return status === 0 || status === 409 || status === 423 || status >= 500;
      },
      onProgress: (sent, total) => onProgress?.(sent, total),
      onError: (error) => {
        const detailed = error as DetailedError;
        const status = detailed.originalResponse?.getStatus();
        const body = detailed.originalResponse?.getBody() ?? "";
        if (status === 413 || /maximum allowed size|too large|exceeded/i.test(body)) {
          reject(new UploadTooLargeError(body || "arquivo acima do limite"));
        } else {
          reject(new Error(body || error.message));
        }
      },
      onSuccess: () => resolve(),
    });

    upload.start();
  });
}
