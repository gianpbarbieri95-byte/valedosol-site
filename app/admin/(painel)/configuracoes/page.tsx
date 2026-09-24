import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/queries/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  // Área de administrador: editor não entra (a RLS de site_settings também barra).
  await requireAdmin("/admin/configuracoes");
  const settings = await getSettings();

  return (
    <div className="max-w-4xl">
      <header>
        <h1 className="text-3xl">Configurações</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
          Telefone, WhatsApp, endereço e textos institucionais do site. O que ficar em branco
          simplesmente não aparece — o site não inventa informação.
        </p>
      </header>

      <div className="mt-6 rounded-[var(--radius-sm)] border border-gold/30 bg-gold-soft px-4 py-3 text-sm text-[#7a5a10]">
        <strong>O logo não é alterado por aqui.</strong> O arquivo oficial da Vale do Sol fica em{" "}
        <code className="text-xs">public/brand/logo.png</code> e só é trocado por quem cuida do
        código, para evitar substituição acidental da marca.
      </div>

      <div className="mt-8">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
