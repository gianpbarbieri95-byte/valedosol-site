import "server-only";

import {
  CrmNotInstalledError,
  getPortalSettings,
  getPropertyOwners,
  getPropertyPortalListings,
  isCrmInstalled,
  listClientOptions,
} from "@/lib/queries/crm";
import { PORTAL_IDS, portalIssues } from "@/lib/portals/definitions";
import type { PropertyCrmData } from "@/components/admin/property-form";
import type { PortalId, Property, PropertyImage, PropertyType } from "@/types/database";

/**
 * Dados das etapas "Proprietários" e "Publicação e portais" do cadastro de
 * imóvel. null quando o CRM ainda não foi instalado: o formulário então
 * simplesmente não mostra essas etapas.
 */
export async function getPropertyCrmData(
  property: (Property & { images?: PropertyImage[] }) | null,
  types: PropertyType[]
): Promise<PropertyCrmData | null> {
  if (!(await isCrmInstalled())) return null;

  try {
    const [clients, settings, owners, listings] = await Promise.all([
      listClientOptions(),
      getPortalSettings(),
      property ? getPropertyOwners(property.id) : Promise.resolve([]),
      property ? getPropertyPortalListings(property.id) : Promise.resolve([]),
    ]);

    const type = property?.property_type_id ? types.find((item) => item.id === property.property_type_id) ?? null : null;
    const portals: PropertyCrmData["portals"] = {};
    const issues: PropertyCrmData["portalIssues"] = {};

    for (const portal of PORTAL_IDS) {
      const listing = listings.find((row) => row.portal === portal);
      portals[portal] = { listed: Boolean(listing), highlight: listing?.highlight ?? false };
      const config = settings.find((row) => row.portal === portal);
      if (property) {
        issues[portal] = portalIssues(portal, config?.type_map ?? {}, {
          publication_state: property.publication_state,
          status: property.status,
          price: property.price,
          price_on_request: property.price_on_request,
          description: property.description,
          neighborhood: property.neighborhood,
          city: property.city,
          property_type: type ? { id: type.id, slug: type.slug } : null,
          photos: (property.images ?? []).map((image) => image.storage_path),
        });
      }
    }

    return {
      clients,
      ownerIds: owners.map((owner) => owner.id),
      portals,
      portalIssues: issues,
      enabledPortals: settings.filter((row) => row.enabled).map((row) => row.portal as PortalId),
    };
  } catch (error) {
    if (error instanceof CrmNotInstalledError) return null;
    throw error;
  }
}
