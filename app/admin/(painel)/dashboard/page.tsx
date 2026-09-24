import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getDashboardStats } from "@/lib/queries/admin";
import { STATUS_LABEL, type PropertyStatus } from "@/lib/site";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const [session, stats, { erro }] = await Promise.all([
    requireStaff(),
    getDashboardStats(),
    searchParams,
  ]);

  const cards = [
    { label: "Imóveis publicados", value: stats.published, href: "/admin/imoveis?estado=published" },
    { label: "Rascunhos", value: stats.drafts, href: "/admin/imoveis?estado=draft" },
    { label: "Em destaque", value: stats.featured, href: "/admin/imoveis" },
    { label: "Contatos novos", value: stats.leadsNew, href: "/admin/leads?status=novo", highlight: true },
  ];

  const statusEntries = (Object.keys(stats.byStatus) as PropertyStatus[]).filter(
    (status) => stats.byStatus[status] > 0
  );

  return (
    <div>
      {erro === "sem-permissao" ? (
        <p
          role="alert"
          className="mb-6 rounded-[var(--radius-sm)] border border-gold/30 bg-gold-soft px-4 py-3 text-sm text-[#7a5a10]"
        >
          Essa área é exclusiva de administradores. Fale com quem administra o painel se precisar de acesso.
        </p>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Olá, {(session.profile.name ?? session.email).split(" ")[0]}</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            {stats.total === 0
              ? "Nenhum imóvel cadastrado ainda."
              : `${stats.total} ${stats.total === 1 ? "imóvel cadastrado" : "imóveis cadastrados"} no total.`}
          </p>
        </div>

        <ButtonLink href="/admin/imoveis/novo">+ Novo imóvel</ButtonLink>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group rounded-[var(--radius-md)] border border-line bg-surface p-5 transition-colors hover:border-line-strong"
          >
            <p className="text-sm text-ink-soft">{card.label}</p>
            <p
              className={`mt-2 font-display text-[2.5rem] leading-none ${
                card.highlight && card.value > 0 ? "text-gold" : "text-primary"
              }`}
            >
              {card.value}
            </p>
          </Link>
        ))}
      </div>

      {statusEntries.length ? (
        <section className="mt-10">
          <h2 className="text-lg">Situação do acervo</h2>
          <div className="mt-4 grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
            {statusEntries.map((status) => (
              <Link
                key={status}
                href={`/admin/imoveis?status=${status}`}
                className="bg-surface px-5 py-4 transition-colors hover:bg-surface-alt"
              >
                <p className="text-xs uppercase tracking-[0.1em] text-muted">{STATUS_LABEL[status]}</p>
                <p className="mt-1 text-2xl font-medium text-ink">{stats.byStatus[status]}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-lg">Atalhos</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/admin/imoveis/novo", label: "Cadastrar imóvel" },
            { href: "/admin/imoveis", label: "Ver imóveis" },
            { href: "/admin/leads", label: "Ver contatos" },
            ...(session.profile.role === "admin"
              ? [{ href: "/admin/configuracoes", label: "Configurações" }]
              : []),
          ].map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="flex items-center justify-between rounded-[var(--radius-sm)] border border-line bg-surface px-4 py-3.5 text-sm text-ink transition-colors hover:border-line-strong"
            >
              {shortcut.label}
              <ArrowRightIcon className="size-4 text-muted" />
            </Link>
          ))}
        </div>
      </section>

      {stats.total === 0 ? (
        <section className="mt-10 rounded-[var(--radius-md)] border border-dashed border-line-strong bg-surface p-7">
          <h2 className="text-xl">Primeiros passos</h2>
          <ol className="mt-4 space-y-2 text-sm leading-relaxed text-ink-soft">
            <li>1. Cadastre os tipos de imóvel que a Vale do Sol trabalha (já vêm preenchidos).</li>
            <li>2. Cadastre as regiões e bairros de Arujá em que vocês atuam.</li>
            <li>3. Cadastre o primeiro imóvel, envie as fotos e escolha a capa.</li>
            <li>4. Publique. Ele aparece no site em poucos minutos.</li>
          </ol>
        </section>
      ) : null}
    </div>
  );
}
