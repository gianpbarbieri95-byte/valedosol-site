import { z } from "zod";
import { isValidPhone } from "./phone";

/**
 * Validação dos formulários públicos.
 *
 * O mesmo schema roda no cliente (para avisar cedo) e no servidor (que é
 * quem decide). Validação de frontend aqui é conveniência, nunca garantia.
 */

const name = z
  .string()
  .trim()
  .min(2, "Informe seu nome")
  .max(120, "Nome muito longo");

const phone = z
  .string()
  .trim()
  .min(1, "Informe um telefone")
  .refine(isValidPhone, "Telefone inválido. Use DDD + número.");

const email = z
  .string()
  .trim()
  .max(160)
  .email("E-mail inválido")
  .optional()
  .or(z.literal("").transform(() => undefined));

const message = z.string().trim().max(2000, "Mensagem muito longa").optional();

/**
 * Campo-armadilha. Fica escondido no formulário: humano não preenche, boi de
 * spam preenche. Se vier com conteúdo, a mensagem é descartada em silêncio.
 */
export const honeypot = z.string().max(0).optional().or(z.string().transform(() => "preenchido"));

export const propertyInterestSchema = z.object({
  name,
  phone,
  email,
  message,
  property_id: z.string().uuid().optional(),
  property_code: z.string().trim().max(30).optional(),
  page_url: z.string().trim().max(500).optional(),
  website: honeypot,
});

/** Quem clicou em "falar pelo WhatsApp" na página de um imóvel. */
export const whatsappLeadSchema = z.object({
  name,
  phone,
  property_id: z.string().uuid(),
  page_url: z.string().trim().max(500).optional(),
  website: honeypot,
});

export const contactSchema = z.object({
  name,
  phone,
  email,
  subject: z.string().trim().max(80).optional(),
  message: z.string().trim().min(5, "Escreva sua mensagem").max(2000),
  page_url: z.string().trim().max(500).optional(),
  website: honeypot,
});

export const sellPropertySchema = z.object({
  name,
  phone,
  email,
  property_type: z.string().trim().max(60).optional(),
  city: z.string().trim().max(80).optional(),
  neighborhood: z.string().trim().max(80).optional(),
  purpose: z.enum(["venda", "locacao", "ambos"]).optional(),
  expected_price: z.string().trim().max(40).optional(),
  message,
  page_url: z.string().trim().max(500).optional(),
  website: honeypot,
});

export type PropertyInterestInput = z.infer<typeof propertyInterestSchema>;
export type WhatsAppLeadInput = z.infer<typeof whatsappLeadSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type SellPropertyInput = z.infer<typeof sellPropertySchema>;

/** Resultado padrão devolvido por toda server action de formulário. */
export interface FormState {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string>;
}

export const IDLE_STATE: FormState = { status: "idle" };

/** Converte os erros do zod no formato que os campos do formulário leem. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

/* -------------------------------------------------------- upload de arquivos */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "application/pdf"];
export const MAX_UPLOAD_FILES = 8;

export function validateUpload(file: File): string | null {
  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return `${file.name}: formato não aceito. Envie JPG, PNG, WEBP ou PDF.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${file.name}: arquivo acima de 8 MB.`;
  }
  return null;
}
