"use client";

/**
 * Eventos de interesse do site.
 *
 * Se o Google Analytics não estiver configurado, `gtag` não existe e a função
 * simplesmente não faz nada — nenhum componente precisa saber disso.
 */

type TrackedEvent =
  | "view_property"
  | "search_property"
  | "whatsapp_click"
  | "lead_submit"
  | "favorite_property"
  | "contact_submit"
  | "sell_request_submit"
  | "property_interest_submit"
  | "phone_click"
  | "filter_apply";

declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: Record<string, unknown>) => void;
  }
}

export function track(event: TrackedEvent, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  try {
    window.gtag("event", event, params);
  } catch {
    // Medição nunca pode quebrar a navegação de quem está no site.
  }
}
