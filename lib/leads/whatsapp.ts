import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/public";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { digitsOnly, propertyWhatsAppMessage } from "@/lib/format";
import { whatsappLeadSchema } from "@/lib/validations/lead";

/**
 * Registra quem clicou em "falar pelo WhatsApp" na página de um imóvel.
 *
 * A conversa em si acontece no WhatsApp, fora do site; o que chega aqui é o
 * nome e o telefone que a pessoa deixou antes de abrir a conversa. Vai para a
 * mesma caixa de contatos dos formulários (leads), com source "site_whatsapp".
 *
 * Mesma porta de entrada dos formulários: service role só no servidor,
 * validação, limite por IP e campo-armadilha contra robô.
 */

export const WHATSAPP_LEAD_SOURCE = "site_whatsapp";

/** A mesma pessoa clicando de novo no mesmo imóvel dentro deste prazo não vira outro contato. */
const DUPLICATE_WINDOW_MS = 12 * 60 * 60 * 1000;

export type WhatsAppLeadResult = "saved" | "duplicate" | "ignored" | "invalid" | "limited" | "error";

export async function recordWhatsAppLead(input: Record<string, string>, headers: Headers): Promise<WhatsAppLeadResult> {
  if (!isSupabaseConfigured()) return "error";

  if (!rateLimit(clientKey(headers, "whatsapp"), 10).allowed) return "limited";

  const parsed = whatsappLeadSchema.safeParse(input);
  if (!parsed.success) return "invalid";
  if (parsed.data.website) return "ignored";

  const supabase = createAdminClient();

  // Código e título vêm do banco, não do navegador.
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, code, title")
    .eq("id", parsed.data.property_id)
    // Só imóvel que o visitante consegue ver (mesma regra da RLS pública).
    .eq("publication_state", "published")
    .neq("status", "inativo")
    .maybeSingle();
  if (propertyError) {
    console.error("[whatsapp] falha ao ler o imóvel:", propertyError.message);
    return "error";
  }
  if (!property) return "invalid";

  const phoneTail = digitsOnly(parsed.data.phone).slice(-10);
  const { data: recent, error: recentError } = await supabase
    .from("leads")
    .select("phone")
    .eq("source", WHATSAPP_LEAD_SOURCE)
    .eq("property_id", property.id)
    .gte("created_at", new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString())
    .limit(200);
  if (recentError) {
    console.error("[whatsapp] falha ao conferir contatos recentes:", recentError.message);
    return "error";
  }
  if ((recent ?? []).some((lead) => digitsOnly(lead.phone).endsWith(phoneTail))) return "duplicate";

  const { error } = await supabase.from("leads").insert({
    name: parsed.data.name,
    phone: parsed.data.phone,
    // O texto que abriu no WhatsApp da pessoa, para a equipe saber de onde veio a conversa.
    message: propertyWhatsAppMessage({ code: property.code, title: property.title, name: parsed.data.name }),
    property_id: property.id,
    property_code: property.code,
    source: WHATSAPP_LEAD_SOURCE,
    page_url: parsed.data.page_url ?? null,
    details: { canal: "whatsapp" },
  });

  if (error) {
    console.error("[whatsapp] falha ao gravar o contato:", error.message);
    return "error";
  }
  return "saved";
}
