import { getAdminSession, requireStaff } from "@/lib/auth";
import { listAdminPropertyTypes } from "@/lib/queries/admin";
import { TypeManager } from "@/components/admin/type-manager";

export const dynamic = "force-dynamic";

export default async function AdminPropertyTypesPage() {
  await requireStaff("/tipos-imovel");
  const [types, session] = await Promise.all([listAdminPropertyTypes(), getAdminSession()]);

  return (
    <div>
      <header>
        <h1 className="text-3xl">Tipos de imóvel</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
          Aparecem no filtro da busca e na página de cada imóvel. Um tipo já usado por algum imóvel
          não pode ser excluído — nesse caso ele é apenas desativado e some dos filtros.
        </p>
      </header>

      <div className="mt-8">
        <TypeManager types={types} isAdmin={session?.profile.role === "admin"} />
      </div>
    </div>
  );
}
