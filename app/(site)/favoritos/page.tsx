import type { Metadata } from "next";

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { FavoritesList } from "./favorites-list";

export const metadata: Metadata = {
  title: "Meus favoritos",
  description: "Os imóveis que você salvou no site da Vale do Sol Imóveis.",
  alternates: { canonical: "/favoritos" },
  // Lista pessoal do visitante: não faz sentido no índice de busca.
  robots: { index: false, follow: true },
};

export default function FavoritesPage() {
  return (
    <div className="container-site py-10 md:py-14">
      <Breadcrumb items={[{ label: "Meus favoritos" }]} />

      <header className="mt-8 max-w-2xl">
        <h1 className="text-balance text-[2.5rem] leading-[1.08] md:text-[3rem]">Meus favoritos</h1>
        <p className="mt-4 text-pretty leading-relaxed text-ink-soft">
          Os imóveis que você guardou para ver com calma.
        </p>
      </header>

      <div className="mt-12">
        <FavoritesList />
      </div>
    </div>
  );
}
