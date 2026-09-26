import Link from "next/link";
import { notFound } from "next/navigation";

import { getAdminSession, requireStaff } from "@/lib/auth";
import { getAdminProperty, listAdminPropertyTypes, listAdminRegions } from "@/lib/queries/admin";
import { deleteProperty } from "@/actions/admin/properties";
import { formatDateTime } from "@/lib/format";

import { PropertyForm } from "@/components/admin/property-form";
import { PropertyImages } from "@/components/admin/property-images";
import { DeletePropertyButton } from "@/components/admin/delete-property-button";

export const dynamic = "force-dynamic";

export default async function EditPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criado?: string }>;
}) {
  await requireStaff();
  const [{ id }, { criado }, session] = await Promise.all([params, searchParams, getAdminSession()]);

  const [property, types, regions] = await Promise.all([
    getAdminProperty(id),
    listAdminPropertyTypes(),
    listAdminRegions(),
  ]);

  if (!property) notFound();

  return (
    <div>
      <nav aria-label="Você está em" className="text-[0.8125rem] text-muted">
        <Link href="/admin/imoveis" className="hover:text-ink">
          Imóveis
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink-soft">{property.code}</span>
      </nav>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-balance text-3xl">{property.title}</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Atualizado em {formatDateTime(property.updated_at)}
            {property.publication_state === "published" ? (
              <>
                {" · "}
                <a
                  href={`/imoveis/${property.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  ver no site
                </a>
              </>
            ) : null}
          </p>
        </div>

        {session?.profile.role === "admin" ? (
          <form action={deleteProperty}>
            <input type="hidden" name="id" value={property.id} />
            <DeletePropertyButton title={property.title} />
          </form>
        ) : null}
      </header>

      {criado ? (
        <p
          role="status"
          className="mt-6 rounded-[var(--radius-sm)] border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-primary"
        >
          Imóvel cadastrado. Agora envie as fotos e escolha a capa. Se ele ainda estiver como rascunho, mude a publicação para “Publicado” e salve.
        </p>
      ) : null}

      <div className="mt-8 space-y-5">
        <PropertyImages
          propertyId={property.id}
          propertyCode={property.code}
          images={property.images ?? []}
        />

        <PropertyForm property={property} types={types} regions={regions} />
      </div>
    </div>
  );
}
