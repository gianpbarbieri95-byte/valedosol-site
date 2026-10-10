"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

/**
 * Mede toques em telefone e WhatsApp de qualquer ponto do site (cabeçalho,
 * rodapé, chamadas), sem cada link precisar saber de medição. O botão de
 * WhatsApp do imóvel (abre um diálogo, não um link) mede por conta própria.
 * Nenhum número ou dado pessoal vai no evento.
 */
export function ClickTracker() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      const href = link?.getAttribute("href") ?? "";
      if (href.startsWith("tel:")) track("phone_click", { page: location.pathname });
      else if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href)) {
        track("whatsapp_click", { page: location.pathname, source: "link" });
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
