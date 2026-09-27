import { z } from "zod";
import { ACTIVITY_KINDS, CLIENT_KINDS, DEAL_STAGES, DEAL_TEMPERATURES } from "@/lib/crm";
import { PROPERTY_PURPOSES } from "@/lib/site";
import { parseLocalInput } from "@/lib/datetime";

/**
 * Validação dos formulários do CRM. Roda no servidor, que é quem decide;
 * a RLS confere de novo no banco.
 */

const optionalText = (max = 2000) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((value) => {
      const raw = (value ?? "").toString().trim();
      return raw === "" ? null : raw;
    })
    .pipe(z.string().max(max, "Texto muito longo").nullable());

const optionalUuid = (message: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((value) => {
      const raw = (value ?? "").toString().trim();
      return raw === "" ? null : raw;
    })
    .pipe(z.string().uuid(message).nullable());

const phone = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((value) => {
    const raw = (value ?? "").toString().trim();
    return raw === "" ? null : raw;
  })
  .pipe(
    z
      .string()
      .refine((value) => {
        const digits = value.replace(/\D/g, "");
        return digits.length >= 10 && digits.length <= 13;
      }, "Telefone inválido. Use DDD + número.")
      .nullable()
  );

const money = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (raw === "") return null;
    const parsed = Number(raw.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  })
  .pipe(z.number({ error: "Valor inválido" }).nonnegative("Use um valor positivo").nullable());

const localDateTime = (message: string) =>
  z
    .string()
    .trim()
    .transform((value, context) => {
      const date = parseLocalInput(value);
      if (!date) {
        context.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return date;
    });

export const clientSchema = z
  .object({
    id: optionalUuid("Cliente inválido"),
    name: z.string().trim().min(2, "Informe o nome").max(160, "Nome muito longo"),
    email: optionalText(160).pipe(z.string().email("E-mail inválido").nullable()),
    phone,
    phone_secondary: phone,
    document: optionalText(30),
    kinds: z.array(z.enum(CLIENT_KINDS)).default([]),
    source: optionalText(80),
    notes: optionalText(4000),
    assigned_to: optionalUuid("Responsável inválido"),
  })
  .refine((data) => data.phone || data.email, {
    message: "Informe ao menos um telefone ou e-mail",
    path: ["phone"],
  });

export type ClientInput = z.infer<typeof clientSchema>;

export const dealSchema = z.object({
  id: optionalUuid("Negócio inválido"),
  title: z.string().trim().min(2, "Dê um título ao negócio").max(200, "Título muito longo"),
  client_id: z.string().uuid("Escolha o cliente"),
  property_id: optionalUuid("Imóvel inválido"),
  purpose: z.enum(PROPERTY_PURPOSES),
  stage: z.enum(DEAL_STAGES),
  value: money,
  temperature: z
    .union([z.enum(DEAL_TEMPERATURES), z.literal(""), z.null(), z.undefined()])
    .optional()
    .transform((value) => (value ? value : null)),
  lost_reason: optionalText(500),
  notes: optionalText(4000),
  assigned_to: optionalUuid("Responsável inválido"),
});

export type DealInput = z.infer<typeof dealSchema>;

export const activitySchema = z
  .object({
    id: optionalUuid("Atividade inválida"),
    title: z.string().trim().min(2, "Descreva a atividade").max(200, "Título muito longo"),
    kind: z.enum(ACTIVITY_KINDS),
    starts_at: localDateTime("Informe data e hora"),
    ends_at: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform((value, context) => {
        const raw = (value ?? "").toString().trim();
        if (!raw) return null;
        const date = parseLocalInput(raw);
        if (!date) {
          context.addIssue({ code: "custom", message: "Horário de término inválido" });
          return z.NEVER;
        }
        return date;
      }),
    all_day: z
      .union([z.string(), z.boolean(), z.null(), z.undefined()])
      .optional()
      .transform((value) => value === true || value === "on" || value === "1"),
    client_id: optionalUuid("Cliente inválido"),
    deal_id: optionalUuid("Negócio inválido"),
    property_id: optionalUuid("Imóvel inválido"),
    notes: optionalText(4000),
    assigned_to: optionalUuid("Responsável inválido"),
  })
  .refine((data) => !data.ends_at || data.ends_at >= data.starts_at, {
    message: "O término precisa ser depois do início",
    path: ["ends_at"],
  });

export type ActivityInput = z.infer<typeof activitySchema>;
