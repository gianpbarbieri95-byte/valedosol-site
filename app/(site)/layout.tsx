import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getSettings } from "@/lib/queries/settings";
import { getRegions } from "@/lib/queries/taxonomies";
import { Analytics } from "@/components/analytics";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, regions] = await Promise.all([getSettings(), getRegions().catch(() => [])]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[var(--radius-sm)] focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Ir para o conteúdo
      </a>
      <Header contact={settings.contact} />
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <Footer
        contact={settings.contact}
        social={settings.social}
        regions={regions.map((region) => ({ slug: region.slug, name: region.name }))}
      />
      <Analytics />
      <VercelAnalytics />
    </div>
  );
}
