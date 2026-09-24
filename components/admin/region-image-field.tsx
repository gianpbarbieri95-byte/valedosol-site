"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { storageUrl } from "@/lib/supabase/env";
import { STORAGE_BUCKETS } from "@/lib/site";
import { slugify } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/primitives";
import { CloseIcon } from "@/components/ui/icons";

const ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Foto de capa da região.
 *
 * Mesma mecânica das fotos do imóvel: o arquivo vai direto do navegador para
 * o Storage com a sessão de quem está logado, e só o caminho segue no
 * formulário. O campo de texto continua existindo (escondido) porque quem
 * salva a região é a server action, que lê `image_path` do FormData.
 */
export function RegionImageField({
  name = "image_path",
  slug,
  defaultPath,
}: {
  name?: string;
  slug: string;
  defaultPath?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState(defaultPath ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const preview = storageUrl(STORAGE_BUCKETS.region, path);

  async function enviar(file: File) {
    setErro(null);

    if (!ACEITOS.includes(file.type)) {
      setErro("Envie JPG, PNG, WEBP ou AVIF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setErro("Arquivo acima de 10 MB.");
      return;
    }

    setEnviando(true);

    const extensao = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    // O nome carrega o slug e um carimbo de tempo: trocar a foto não
    // esbarra no arquivo antigo em cache nem sobrescreve o de outra região.
    const destino = `${slugify(slug) || "regiao"}-${Date.now()}.${extensao}`;

    const supabase = createClient();
    const { error } = await supabase.storage
      .from(STORAGE_BUCKETS.region)
      .upload(destino, file, { contentType: file.type, upsert: false });

    setEnviando(false);

    if (error) {
      setErro(`Falha ao enviar: ${error.message}`);
      return;
    }

    setPath(destino);
  }

  return (
    <div>
      <Label htmlFor="r-imagem-arquivo">Foto da região</Label>

      <div className="flex flex-wrap items-start gap-4">
        <div
          className={cn(
            "relative aspect-[4/3] w-40 shrink-0 overflow-hidden rounded-[var(--radius-sm)]",
            "border border-line bg-surface-alt"
          )}
        >
          {preview ? (
            <Image src={preview} alt="" fill sizes="160px" className="object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center px-2 text-center text-[0.6875rem] text-muted">
              Sem foto
            </span>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <input
            ref={inputRef}
            id="r-imagem-arquivo"
            type="file"
            accept={ACEITOS.join(",")}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void enviar(file);
              event.target.value = "";
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={enviando}
              onClick={() => inputRef.current?.click()}
            >
              {enviando ? "Enviando…" : path ? "Trocar foto" : "Escolher foto"}
            </Button>

            {path ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setPath("")}>
                <CloseIcon className="size-4" />
                Remover
              </Button>
            ) : null}
          </div>

          <p className="text-xs text-muted">
            JPG, PNG, WEBP ou AVIF, até 10 MB. Uma foto deitada funciona melhor:
            o cartão corta as laterais no celular.
          </p>

          {path ? <p className="text-xs text-muted">Arquivo: {path}</p> : null}
          {erro ? (
            <p role="alert" className="text-xs text-danger">
              {erro}
            </p>
          ) : null}
        </div>
      </div>

      <input type="hidden" name={name} value={path} />
    </div>
  );
}
