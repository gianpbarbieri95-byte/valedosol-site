import "server-only";

import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { storageUrl } from "@/lib/supabase/env";
import { SITE, STORAGE_BUCKETS } from "@/lib/site";
import { DEFAULT_SETTINGS } from "@/lib/queries/settings";
import { isMissingTable } from "@/lib/queries/crm";
import { PORTALS, photoExtension, portalIssues, portalTypeFor } from "./definitions";
import { buildVrsyncXml } from "./vrsync";
import { buildChavesNaMaoXml } from "./chavesnamao";
import type { FeedContext, FeedProperty } from "./feed-types";
import type { ContactSettings, PortalId, Property, PropertyImage } from "@/types/database";

/**
 * Gera o XML que o portal busca na URL secreta.
 *
 * O portal não tem sessão, e portal_listings/portal_settings são fechadas
 * para anônimo pela RLS. Por isso a leitura usa a service role — só aqui,
 * no servidor, e depois de conferir o token. Mesmo assim, só entram imóveis
 * publicados e disponíveis, pela mesma regra de portalIssues() que a tela
 * de portais mostra à equipe.
 */

const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
  MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

function sameToken(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

type ListingRow = {
  highlight: boolean;
  property:
    | (Property & {
        property_type: { id: string; slug: string } | null;
        images: Pick<PropertyImage, "storage_path" | "alt_text" | "sort_order" | "is_cover" | "created_at">[];
      })
    | null;
};

export type FeedResult =
  | { status: "ok"; xml: string; count: number }
  | { status: "not-found" }
  | { status: "unavailable" };

export async function buildPortalFeed(portal: PortalId, token: string): Promise<FeedResult> {
  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch {
    return { status: "unavailable" };
  }

  const { data: settings, error: settingsError } = await supabase
    .from("portal_settings")
    .select("enabled, feed_token, type_map")
    .eq("portal", portal)
    .maybeSingle();

  // Migration do CRM ainda não aplicada: para o portal, o link não existe.
  if (settingsError && isMissingTable(settingsError)) return { status: "not-found" };
  if (settingsError) {
    console.error("[portais] falha ao ler portal_settings:", settingsError.message);
    return { status: "unavailable" };
  }
  // Portal desligado ou token errado: 404, sem dizer qual dos dois.
  if (!settings || !settings.enabled || !sameToken(settings.feed_token, token)) return { status: "not-found" };

  const typeMap = (settings.type_map ?? {}) as Record<string, string>;

  const [{ data: rows, error }, { data: contactRow }] = await Promise.all([
    supabase
      .from("portal_listings")
      .select(
        "highlight, property:properties(*, property_type:property_types(id, slug), images:property_images(storage_path, alt_text, sort_order, is_cover, created_at))"
      )
      .eq("portal", portal),
    supabase.from("site_settings").select("value").eq("key", "contact").maybeSingle(),
  ]);

  if (error) {
    console.error("[portais] falha ao ler imóveis:", error.message);
    return { status: "unavailable" };
  }

  const contact = { ...DEFAULT_SETTINGS.contact, ...((contactRow?.value ?? {}) as Partial<ContactSettings>) };
  const state = (contact.state || "SP").trim().toUpperCase().slice(0, 2);
  const definition = PORTALS[portal];

  const properties: FeedProperty[] = [];
  for (const row of (rows ?? []) as unknown as ListingRow[]) {
    const property = row.property;
    if (!property) continue;

    const images = [...(property.images ?? [])].sort(
      (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order
    );
    const usable = definition.photoExtensions
      ? images.filter((image) => definition.photoExtensions!.includes(photoExtension(image.storage_path)))
      : images;
    const photos = usable
      .slice(0, definition.maxPhotos ?? usable.length)
      .map((image) => ({
        url: storageUrl(STORAGE_BUCKETS.property, image.storage_path) ?? "",
        caption: image.alt_text,
        updatedAt: image.created_at,
      }))
      .filter((photo) => photo.url);

    const issues = portalIssues(portal, typeMap, {
      publication_state: property.publication_state,
      status: property.status,
      price: property.price,
      price_on_request: property.price_on_request,
      description: property.description,
      neighborhood: property.neighborhood,
      city: property.city,
      property_type: property.property_type,
      photos: images.map((image) => image.storage_path),
    });
    if (issues.length) continue;

    properties.push({
      code: property.code,
      title: property.title,
      url: `${SITE.url}/imoveis/${property.slug}`,
      purpose: property.purpose,
      portalType: portalTypeFor(portal, typeMap, property.property_type)!,
      highlight: row.highlight,
      price: Number(property.price),
      condo_fee: property.condo_fee,
      iptu: property.iptu,
      area_total: property.area_total,
      area_built: property.area_built,
      bedrooms: property.bedrooms,
      suites: property.suites,
      bathrooms: property.bathrooms,
      parking_spaces: property.parking_spaces,
      is_furnished: property.is_furnished,
      description: (property.description ?? "").trim(),
      city: property.city,
      neighborhood: (property.neighborhood ?? "").trim(),
      address: property.address,
      zip_code: property.zip_code,
      latitude: property.latitude,
      longitude: property.longitude,
      photos,
      updated_at: property.updated_at,
    });
  }

  properties.sort((a, b) => a.code.localeCompare(b.code));

  const context: FeedContext = {
    companyName: SITE.name,
    email: contact.email,
    phone: contact.phone,
    website: SITE.url,
    state,
    stateName: UF_NAMES[state] ?? state,
    generatedAt: new Date(),
  };

  const xml = portal === "vrsync" ? buildVrsyncXml(properties, context) : buildChavesNaMaoXml(properties, context);
  return { status: "ok", xml, count: properties.length };
}
