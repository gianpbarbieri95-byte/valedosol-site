import { z } from "zod";
import { PROPERTY_PURPOSES, PROPERTY_STATUSES, PUBLICATION_STATES } from "@/lib/site";

/** Campo numérico opcional vindo de <input>: "" vira null, não 0. */
// No Zod 4 um campo com transform só aceita ficar de fora do FormData se
// tiver .optional() antes — e o navegador não envia caixa desmarcada, nem o
// id de um imóvel novo, nem o código (que é gerado no servidor).
const optionalNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (raw === "") return null;
    const parsed = Number(raw.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  })
  .pipe(z.number().nonnegative("Use um número positivo").nullable());

const optionalInt = optionalNumber.pipe(
  z
    .number()
    .int("Use um número inteiro")
    .max(99, "Valor muito alto")
    .nullable()
);

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((value) => {
    const raw = (value ?? "").toString().trim();
    return raw === "" ? null : raw;
  });

const checkbox = z
  .union([z.string(), z.boolean(), z.undefined(), z.null()])
  .optional()
  .transform((value) => value === true || value === "on" || value === "1" || value === "true");

export const propertySchema = z.object({
  id: optionalText,

  title: z.string().trim().min(5, "Dê um título ao imóvel").max(200, "Título muito longo"),
  slug: z
    .string()
    .trim()
    .min(3, "O endereço da página é obrigatório")
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens"),
  // Gerado pelo sistema no cadastro (lib/property-code.ts). Na edição pode
  // ser corrigido à mão; vazio mantém o código atual.
  code: optionalText.pipe(z.string().max(30, "Código muito longo").nullable()),

  purpose: z.enum(PROPERTY_PURPOSES),
  property_type_id: optionalText.pipe(z.string().uuid("Selecione um tipo válido").nullable()),
  status: z.enum(PROPERTY_STATUSES),
  publication_state: z.enum(PUBLICATION_STATES),

  price: optionalNumber,
  price_on_request: checkbox,
  condo_fee: optionalNumber,
  iptu: optionalNumber,

  city: z.string().trim().min(2, "Informe a cidade").max(80),
  neighborhood: optionalText,
  address: optionalText,
  zip_code: optionalText,
  region_id: optionalText.pipe(z.string().uuid("Selecione uma região válida").nullable()),
  latitude: optionalNumber.pipe(z.number().min(-90).max(90).nullable()),
  longitude: optionalNumber.pipe(z.number().min(-180).max(180).nullable()),

  area_total: optionalNumber,
  area_built: optionalNumber,
  bedrooms: optionalInt,
  suites: optionalInt,
  bathrooms: optionalInt,
  parking_spaces: optionalInt,

  description: optionalText,
  /** Uma característica por linha no textarea. */
  highlights: z
    .union([z.string(), z.undefined(), z.null()])
    .optional()
    .transform((value) =>
      (value ?? "")
        .toString()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 60)
    ),

  is_featured: checkbox,
  is_furnished: checkbox,
  in_condo: checkbox,
  condo_name: optionalText,

  seo_title: optionalText,
  seo_description: optionalText,
});

export type PropertyInput = z.infer<typeof propertySchema>;

/**
 * Longitude negativa é o normal em Arujá (oeste de Greenwich), então o
 * schema aceita negativo — mas latitude e longitude só valem juntas.
 */
export function coordinatesAreConsistent(input: PropertyInput): boolean {
  return (input.latitude === null) === (input.longitude === null);
}

export const regionSchema = z.object({
  id: optionalText,
  name: z.string().trim().min(2, "Informe o nome da região").max(120),
  slug: z
    .string()
    .trim()
    .min(2, "Informe o endereço da página")
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens"),
  city: z.string().trim().min(2, "Informe a cidade").max(80),
  description: optionalText,
  image_path: optionalText,
  sort_order: optionalInt.transform((value) => value ?? 0),
  active: checkbox,
  seo_title: optionalText,
  seo_description: optionalText,
});

export const propertyTypeSchema = z.object({
  id: optionalText,
  name: z.string().trim().min(2, "Informe o nome do tipo").max(80),
  slug: z
    .string()
    .trim()
    .min(2, "Informe o identificador")
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens"),
  sort_order: optionalInt.transform((value) => value ?? 0),
  active: checkbox,
});
