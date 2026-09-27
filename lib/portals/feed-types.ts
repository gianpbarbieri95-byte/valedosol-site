import type { PropertyPurpose } from "@/types/database";

/** Imóvel já validado e normalizado para entrar num XML de portal. */
export interface FeedProperty {
  code: string;
  title: string;
  url: string;
  purpose: PropertyPurpose;
  /** Tipo no vocabulário do portal (já resolvido pelo mapeamento). */
  portalType: string;
  highlight: boolean;
  price: number;
  condo_fee: number | null;
  iptu: number | null;
  area_total: number | null;
  area_built: number | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  is_furnished: boolean;
  description: string;
  city: string;
  neighborhood: string;
  address: string | null;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  photos: { url: string; caption: string | null; updatedAt: string }[];
  updated_at: string;
}

export interface FeedContext {
  companyName: string;
  email: string;
  phone: string;
  website: string;
  /** UF, ex.: "SP". */
  state: string;
  stateName: string;
  generatedAt: Date;
}

/**
 * "Rua das Flores, 123" → rua e número separados, como os portais pedem.
 * Sem número reconhecível no fim, tudo vai como rua.
 */
export function splitAddress(address: string | null): { street: string; number: string } {
  const value = (address ?? "").trim().replace(/,\s*$/, "");
  const match = value.match(/^(.*?)[,\s]+(n[º°o.]?\s*)?(\d+[a-zA-Z]?)\s*$/);
  return match ? { street: match[1].trim(), number: match[3] } : { street: value, number: "" };
}
