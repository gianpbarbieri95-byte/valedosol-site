import { requireStaff } from "@/lib/auth";
import { getStaffDirectory, isCrmInstalled } from "@/lib/queries/crm";
import { ClientForm } from "@/components/admin/crm-forms";
import { CrmPendingNotice, PageHeader, Panel } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  await requireStaff("/clientes/novo");
  const [installed, staff] = await Promise.all([isCrmInstalled(), getStaffDirectory()]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo cliente" breadcrumb={[{ href: "/clientes", label: "Clientes" }]} />
      {installed ? (
        <Panel>
          <ClientForm staff={staff} />
        </Panel>
      ) : (
        <CrmPendingNotice />
      )}
    </div>
  );
}
