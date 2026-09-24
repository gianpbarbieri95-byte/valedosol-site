import { getAdminSession, requireStaff } from "@/lib/auth";
import { listAdminRegions } from "@/lib/queries/admin";
import { getCities } from "@/lib/queries/taxonomies";
import { RegionManager } from "@/components/admin/region-manager";

export const dynamic = "force-dynamic";

export default async function AdminRegionsPage() {
  await requireStaff("/admin/regioes");
  const [regions, cities, session] = await Promise.all([
    listAdminRegions(),
    getCities(),
    getAdminSession(),
  ]);

  return (
    <div>
      <header>
        <h1 className="text-3xl">Regiões</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
          Bairros, condomínios e cidades que ganham página própria no site. Cada região vira um
          endereço em /regioes e reúne os imóveis ligados a ela.
        </p>
      </header>

      <div className="mt-8">
        <RegionManager
          regions={regions}
          cities={cities}
          isAdmin={session?.profile.role === "admin"}
        />
      </div>
    </div>
  );
}
