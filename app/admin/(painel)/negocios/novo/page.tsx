import { requireStaff } from "@/lib/auth";
import { CrmNotInstalledError, getStaffDirectory, listClientOptions } from "@/lib/queries/crm";
import { listPropertyOptions } from "@/lib/queries/admin";
import { firstParam } from "@/lib/utils";
import { DealForm } from "@/components/admin/crm-forms";
import { CrmPendingNotice, PageHeader, Panel } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("/negocios/novo");
  const params = await searchParams;
  const uuid = (value?: string) => (value && /^[0-9a-f-]{36}$/i.test(value) ? value : undefined);

  let clients: Awaited<ReturnType<typeof listClientOptions>>;
  try {
    clients = await listClientOptions();
  } catch (error) {
    if (error instanceof CrmNotInstalledError) return <CrmPendingNotice />;
    throw error;
  }
  const [properties, staff] = await Promise.all([listPropertyOptions(), getStaffDirectory()]);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Novo negócio" breadcrumb={[{ href: "/negocios", label: "Negócios" }]} />
      <Panel>
        <DealForm
          clients={clients}
          properties={properties}
          staff={staff}
          defaults={{ client_id: uuid(firstParam(params.cliente)), property_id: uuid(firstParam(params.imovel)) }}
        />
      </Panel>
    </div>
  );
}
