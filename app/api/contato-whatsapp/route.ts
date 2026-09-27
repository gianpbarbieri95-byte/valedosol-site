import type { NextRequest } from "next/server";
import { recordWhatsAppLead, type WhatsAppLeadResult } from "@/lib/leads/whatsapp";

/**
 * Recebe o nome e o telefone de quem abriu o WhatsApp pela página do imóvel.
 *
 * É um route handler, e não uma server action, porque o navegador envia com
 * navigator.sendBeacon no mesmo clique que abre o WhatsApp: o envio termina
 * mesmo que a pessoa já tenha saído para o aplicativo.
 */

const STATUS: Record<WhatsAppLeadResult, number> = {
  saved: 201,
  duplicate: 200,
  ignored: 200,
  invalid: 400,
  limited: 429,
  error: 503,
};

export async function POST(request: NextRequest) {
  // Só o próprio site envia para cá.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (originHost !== host) return Response.json({ status: "forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ status: "invalid" }, { status: 400 });
  }

  const input: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") input[key] = value;
  }

  const result = await recordWhatsAppLead(input, request.headers);
  return Response.json({ status: result }, { status: STATUS[result] });
}
