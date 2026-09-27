import { headers } from "next/headers";
import { requireStaff } from "@/lib/auth";
import { requestOrigin } from "@/lib/admin-host";
import { listAdminPropertyTypes } from "@/lib/queries/admin";
import { CrmNotInstalledError, getPortalSettings, listPortalCandidates, listPortalListings } from "@/lib/queries/crm";
import { PORTALS, PORTAL_IDS, portalFeedPath, portalIssues, portalTypeFor } from "@/lib/portals/definitions";
import { regeneratePortalToken } from "@/actions/admin/portals";
import { SITE } from "@/lib/site";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { CopyField, PortalListingsForm, PortalSettingsForm } from "@/components/admin/portal-panels";
import { CrmPendingNotice, PageHeader, Panel, Pill } from "@/components/admin/ui";
import { GlobeIcon } from "@/components/admin/icons";

export const dynamic = "force-dynamic";

export default async function PortalsPage() {
  const session = await requireStaff("/portais");
  const isAdmin = session.profile.role === "admin";

  let data: Awaited<ReturnType<typeof load>>;
  try {
    data = await load();
  } catch (error) {
    if (error instanceof CrmNotInstalledError) {
      return (
        <div>
          <PageHeader title="Portais" />
          <CrmPendingNotice />
        </div>
      );
    }
    throw error;
  }
  const { settings, candidates, listings, types, origin } = data;

  return (
    <div>
      <PageHeader
        title="Portais imobiliários"
        description="Os portais leem um arquivo XML com os imóveis marcados e atualizam os anúncios sozinhos — sem cadastrar nada duas vezes."
      />

      <div className="space-y-8">
        {PORTAL_IDS.map((portal) => {
          const definition = PORTALS[portal];
          const config = settings.find((row) => row.portal === portal);
          if (!config) return null;
          const rows = candidates.map((property) => {
            const listing = listings.find((row) => row.portal === portal && row.property_id === property.id);
            const type = property.property_type;
            return {
              id: property.id,
              code: property.code,
              title: property.title,
              typeName: portalTypeFor(portal, config.type_map, type)
                ? definition.typeOptions.find((option) => option.value === portalTypeFor(portal, config.type_map, type))?.label ?? null
                : null,
              listed: Boolean(listing),
              highlight: listing?.highlight ?? false,
              issues: portalIssues(portal, config.type_map, {
                publication_state: property.publication_state,
                status: property.status,
                price: property.price,
                price_on_request: property.price_on_request,
                description: property.description,
                neighborhood: property.neighborhood,
                city: property.city,
                property_type: type ? { id: type.id, slug: type.slug } : null,
                photos: property.images.map((image) => image.storage_path),
              }),
            };
          });
          const inFeed = rows.filter((row) => row.listed && row.issues.length === 0).length;
          const feedUrl = `${origin}${portalFeedPath(portal, config.feed_token)}`;

          return (
            <section key={portal} aria-labelledby={`portal-${portal}`} className="grid gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
              <Panel
                title={
                  <span id={`portal-${portal}`} className="flex items-center gap-2">
                    {definition.name}
                  </span>
                }
                icon={<GlobeIcon className="size-4" />}
                action={config.enabled ? <Pill tone="success">Ligado</Pill> : <Pill>Desligado</Pill>}
                className="self-start"
              >
                <div className="space-y-5">
                  <p className="text-sm leading-relaxed text-ink-soft">
                    <strong className="font-medium text-ink">{inFeed}</strong>{" "}
                    {inFeed === 1 ? "imóvel está saindo" : "imóveis estão saindo"} no XML agora.
                  </p>

                  <div>
                    <p className="mb-1.5 text-[0.8125rem] font-medium text-ink-soft">Link do XML</p>
                    <CopyField value={feedUrl} label={`Link do XML — ${definition.name}`} />
                    <p className="mt-2 text-xs leading-relaxed text-muted">{definition.setup}</p>
                    {config.enabled ? (
                      <a href={feedUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                        Abrir o XML para conferir
                      </a>
                    ) : null}
                  </div>

                  {isAdmin ? (
                    <>
                      <PortalSettingsForm
                        portal={portal}
                        enabled={config.enabled}
                        options={definition.typeOptions}
                        types={types.map((type) => ({
                          id: type.id,
                          name: type.name,
                          chosen: config.type_map[type.id] ?? "",
                          fallback: definition.defaultTypeBySlug[type.slug] ?? null,
                        }))}
                      />
                      <form action={regeneratePortalToken} className="border-t border-line pt-4">
                        <input type="hidden" name="portal" value={portal} />
                        <ConfirmSubmit
                          message="Gerar um link novo? O link atual para de funcionar e precisa ser trocado na conta do portal."
                          className="text-xs text-ink-soft underline-offset-4 hover:text-danger hover:underline"
                        >
                          Gerar link novo (invalida o atual)
                        </ConfirmSubmit>
                      </form>
                    </>
                  ) : (
                    <p className="text-xs text-muted">Ligar o portal e ajustar tipos é feito por um administrador.</p>
                  )}
                </div>
              </Panel>

              <Panel title="Imóveis anunciados" accent="gold" bodyClassName="p-0 sm:p-0">
                {rows.length ? (
                  <PortalListingsForm portal={portal} rows={rows} />
                ) : (
                  <p className="p-5 text-sm text-ink-soft">Nenhum imóvel cadastrado ainda.</p>
                )}
              </Panel>
            </section>
          );
        })}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Os links do anúncio apontam para as páginas do site ({SITE.url.replace(/^https?:\/\//, "")}). Endereço, rua e
        número não aparecem nos portais: eles mostram só bairro e cidade.
      </p>
    </div>
  );
}

async function load() {
  const [settings, candidates, listings, types, requestHeaders] = await Promise.all([
    getPortalSettings(),
    listPortalCandidates(),
    listPortalListings(),
    listAdminPropertyTypes(),
    headers(),
  ]);
  return { settings, candidates, listings, types, origin: requestOrigin(requestHeaders) ?? "" };
}
