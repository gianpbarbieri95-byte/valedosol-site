import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getCodeSeries, listAdminPropertyTypes, listAdminRegions } from "@/lib/queries/admin";
import { PropertyForm } from "@/components/admin/property-form";

export const dynamic = "force-dynamic";

export default async function NewPropertyPage() {
  await requireStaff("/imoveis/novo");
  const [types, regions, codeSeries] = await Promise.all([
    listAdminPropertyTypes(),
    listAdminRegions(),
    getCodeSeries(),
  ]);

  return (
    <div>
      <nav aria-label="Você está em" className="text-[0.8125rem] text-muted">
        <Link href="/imoveis" className="hover:text-ink">
          Imóveis
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink-soft">Novo</span>
      </nav>

      <h1 className="mt-4 text-3xl">Novo imóvel</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Preencha os dados principais; as fotos entram logo em seguida, na próxima tela.
      </p>

      <div className="mt-8">
        <PropertyForm types={types} regions={regions} codeSeries={codeSeries} />
      </div>
    </div>
  );
}
