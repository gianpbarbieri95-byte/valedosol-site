import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getCodeSeries, listAdminPropertyTypes, listAdminRegions } from "@/lib/queries/admin";
import { PropertyForm } from "@/components/admin/property-form";

export const dynamic = "force-dynamic";

export default async function NewPropertyPage() {
  await requireStaff("/admin/imoveis/novo");
  const [types, regions, codeSeries] = await Promise.all([
    listAdminPropertyTypes(),
    listAdminRegions(),
    getCodeSeries(),
  ]);

  return (
    <div>
      <nav aria-label="Você está em" className="text-[0.8125rem] text-muted">
        <Link href="/admin/imoveis" className="hover:text-ink">
          Imóveis
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink-soft">Novo</span>
      </nav>

      <h1 className="mt-4 text-3xl">Novo imóvel</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Cadastre os dados agora; as fotos entram na próxima tela.
      </p>

      <div className="mt-8">
        <PropertyForm types={types} regions={regions} codeSeries={codeSeries} />
      </div>
    </div>
  );
}
