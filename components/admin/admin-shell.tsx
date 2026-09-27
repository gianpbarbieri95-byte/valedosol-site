"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/actions/auth";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { ChevronDownIcon, ExternalIcon, GearIcon, LogoutIcon, PlusIcon } from "@/components/admin/icons";
import type { UserRole } from "@/types/database";

interface NavLink {
  href: string;
  label: string;
  description?: string;
  /** Sem esta chave, o item aparece para qualquer papel. */
  roles?: UserRole[];
}

interface NavGroup {
  label: string;
  /** Link direto (sem submenu). */
  href?: string;
  items?: NavLink[];
  /** Prefixos de caminho que acendem o item. */
  match: string[];
}

const NAV: NavGroup[] = [
  { label: "Início", href: "/dashboard", match: ["/dashboard"] },
  {
    label: "Negócios",
    match: ["/negocios"],
    items: [
      { href: "/negocios", label: "Funil de negócios", description: "Do primeiro contato à proposta" },
      { href: "/negocios?fechados=1", label: "Ganhos e perdidos" },
      { href: "/negocios/novo", label: "Novo negócio" },
    ],
  },
  { label: "Atividades", href: "/atividades", match: ["/atividades"] },
  {
    label: "Clientes",
    match: ["/clientes", "/leads"],
    items: [
      { href: "/clientes", label: "Todos os clientes", description: "Compradores, locatários e proprietários" },
      { href: "/clientes/novo", label: "Novo cliente" },
      { href: "/leads", label: "Contatos do site", description: "Mensagens que chegaram pelo site" },
    ],
  },
  {
    label: "Imóveis",
    match: ["/imoveis", "/regioes", "/tipos-imovel"],
    items: [
      { href: "/imoveis", label: "Todos os imóveis" },
      { href: "/imoveis/novo", label: "Cadastrar imóvel" },
      { href: "/regioes", label: "Regiões" },
      { href: "/tipos-imovel", label: "Tipos de imóvel" },
    ],
  },
  { label: "Portais", href: "/portais", match: ["/portais"] },
];

/**
 * Moldura do painel: menu no topo, com submenus.
 *
 * O menu esconde o que o papel não pode usar, mas isso é conveniência: o
 * bloqueio real está em requireAdmin() e nas policies de RLS.
 */
export function AdminShell({
  children,
  role,
  name,
  email,
  newLeads = 0,
}: {
  children: React.ReactNode;
  role: UserRole;
  name: string;
  email: string;
  /** Contatos do site ainda não atendidos — vira um selo no menu. */
  newLeads?: number;
}) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  const isActive = (group: NavGroup) =>
    group.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  // Troca de página fecha os menus.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reação à navegação, não estado derivado
    setOpenGroup(null);
    setMobileOpen(false);
  }, [pathname]);

  // Clique fora ou Esc fecha o submenu aberto.
  useEffect(() => {
    if (!openGroup) return;
    const onPointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpenGroup(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenGroup(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openGroup]);

  const visibleItems = (group: NavGroup) => (group.items ?? []).filter((item) => !item.roles || item.roles.includes(role));
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-canvas">
      <header ref={headerRef} className="sticky top-0 z-40 bg-primary-deep text-white shadow-[0_1px_0_rgb(0_0_0/0.2)]">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-3 sm:px-4 lg:gap-1 lg:px-6">
          <Link href="/dashboard" className="mr-2 flex shrink-0 items-center gap-2.5 lg:mr-4">
            <span className="grid size-9 place-items-center rounded-[var(--radius-sm)] bg-white">
              <Image src="/brand/logo.png" alt="" width={250} height={249} className="size-8" />
            </span>
            <span className="text-[0.8125rem] leading-tight">
              <span className="block font-medium">Vale do Sol</span>
              <span className="block text-[0.6875rem] uppercase tracking-[0.14em] text-gold-bright">Painel</span>
            </span>
          </Link>

          {/* Menu do desktop */}
          <nav aria-label="Painel" className="hidden h-full items-stretch lg:flex">
            {NAV.map((group) => {
              const active = isActive(group);
              const itemClass = cn(
                "relative flex h-full items-center gap-1 px-3 text-[0.875rem] transition-colors xl:px-3.5",
                active ? "bg-primary text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
                // Traço dourado sob o item da seção atual.
                active && "after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:bg-gold-bright"
              );

              if (group.href) {
                return (
                  <Link key={group.label} href={group.href} aria-current={active ? "page" : undefined} className={itemClass}>
                    {group.label}
                  </Link>
                );
              }

              const open = openGroup === group.label;
              const badge = group.label === "Clientes" && newLeads > 0 ? newLeads : 0;
              return (
                <div key={group.label} className="relative flex">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-haspopup="true"
                    onClick={() => setOpenGroup(open ? null : group.label)}
                    className={itemClass}
                  >
                    {group.label}
                    {badge ? (
                      <span className="ml-1 rounded-full bg-gold-bright px-1.5 text-[0.6875rem] font-semibold leading-[1.125rem] text-primary-deep">
                        {badge}
                      </span>
                    ) : null}
                    <ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} />
                  </button>
                  {open ? (
                    <div className="absolute left-0 top-full min-w-64 overflow-hidden rounded-b-[var(--radius-md)] border border-t-0 border-black/10 bg-primary py-1.5 shadow-float">
                      {visibleItems(group).map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="block px-4 py-2.5 transition-colors hover:bg-white/10"
                        >
                          <span className="flex items-center justify-between gap-3 text-[0.875rem] text-white">
                            {item.label}
                            {item.href === "/leads" && newLeads > 0 ? (
                              <span className="rounded-full bg-gold-bright px-1.5 text-[0.6875rem] font-semibold text-primary-deep">
                                {newLeads} {newLeads === 1 ? "novo" : "novos"}
                              </span>
                            ) : null}
                          </span>
                          {item.description ? (
                            <span className="mt-0.5 block text-xs text-white/60">{item.description}</span>
                          ) : null}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {pathname !== "/imoveis/novo" ? (
              <Link
                href="/imoveis/novo"
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] bg-gold-bright px-3 text-[0.8125rem] font-medium text-primary-deep transition-colors hover:bg-[#e2b654]"
              >
                <PlusIcon className="size-4" />
                <span className="hidden sm:inline">Novo imóvel</span>
                <span className="sm:hidden">Imóvel</span>
              </Link>
            ) : null}

            {role === "admin" ? (
              <Link
                href="/configuracoes"
                aria-label="Configurações do site"
                title="Configurações do site"
                className={cn(
                  "hidden size-9 place-items-center rounded-[var(--radius-sm)] transition-colors lg:grid",
                  pathname.startsWith("/configuracoes") ? "bg-primary text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                )}
              >
                <GearIcon className="size-5" />
              </Link>
            ) : null}

            {/* Menu do usuário (desktop) */}
            <div className="relative hidden lg:block">
              <button
                type="button"
                aria-expanded={openGroup === "__user"}
                aria-haspopup="true"
                onClick={() => setOpenGroup(openGroup === "__user" ? null : "__user")}
                className="flex h-9 items-center gap-2 rounded-[var(--radius-sm)] pl-1 pr-2 text-white/90 transition-colors hover:bg-white/10"
              >
                <span className="grid size-7 place-items-center rounded-full bg-gold-bright text-[0.6875rem] font-semibold text-primary-deep">
                  {initials || "?"}
                </span>
                <span className="max-w-32 truncate text-[0.8125rem]">{name.split(" ")[0]}</span>
                <ChevronDownIcon className="size-3.5" />
              </button>
              {openGroup === "__user" ? (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] w-64 overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface text-ink shadow-float">
                  <div className="border-b border-line px-4 py-3">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="truncate text-xs text-muted">{email}</p>
                    <p className="mt-1 text-[0.6875rem] uppercase tracking-[0.1em] text-gold">
                      {role === "admin" ? "Administrador" : "Editor"}
                    </p>
                  </div>
                  <UserMenuLinks role={role} />
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
              className="grid size-10 place-items-center rounded-[var(--radius-sm)] hover:bg-white/10 lg:hidden"
            >
              {mobileOpen ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
            </button>
          </div>
        </div>

        {/* Menu do celular */}
        {mobileOpen ? (
          <div className="max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-white/10 bg-primary-deep pb-4 lg:hidden">
            <nav aria-label="Painel" className="px-3 pt-2">
              {NAV.map((group) =>
                group.href ? (
                  <Link
                    key={group.label}
                    href={group.href}
                    aria-current={isActive(group) ? "page" : undefined}
                    className={cn(
                      "block rounded-[var(--radius-sm)] px-3 py-3 text-[0.9375rem]",
                      isActive(group) ? "bg-primary text-white" : "text-white/85"
                    )}
                  >
                    {group.label}
                  </Link>
                ) : (
                  <div key={group.label} className="py-1">
                    <p className="px-3 pb-1 pt-3 text-[0.6875rem] uppercase tracking-[0.14em] text-gold-bright">
                      {group.label}
                    </p>
                    {visibleItems(group).map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center justify-between rounded-[var(--radius-sm)] px-3 py-2.5 text-[0.9375rem]",
                          pathname === item.href ? "bg-primary text-white" : "text-white/85"
                        )}
                      >
                        {item.label}
                        {item.href === "/leads" && newLeads > 0 ? (
                          <span className="rounded-full bg-gold-bright px-1.5 text-[0.6875rem] font-semibold text-primary-deep">
                            {newLeads}
                          </span>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                )
              )}
            </nav>
            <div className="mx-3 mt-3 rounded-[var(--radius-md)] bg-surface text-ink">
              <div className="border-b border-line px-4 py-3">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-muted">{email}</p>
              </div>
              <UserMenuLinks role={role} />
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto min-w-0 max-w-[1440px] px-3 py-5 sm:px-4 sm:py-7 lg:px-6 lg:py-8">{children}</main>
    </div>
  );
}

function UserMenuLinks({ role }: { role: UserRole }) {
  const linkClass = "flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink";
  return (
    <div className="py-1.5">
      {role === "admin" ? (
        <Link href="/configuracoes" className={linkClass}>
          <GearIcon className="size-4" />
          Configurações do site
        </Link>
      ) : null}
      <Link href="/nova-senha" className={linkClass}>
        <span aria-hidden className="grid size-4 place-items-center text-xs">•••</span>
        Trocar senha
      </Link>
      <Link href={SITE.url} target="_blank" rel="noopener" className={linkClass}>
        <ExternalIcon className="size-4" />
        Ver o site
      </Link>
      <form action={signOut} className="border-t border-line pt-1.5">
        <button type="submit" className={cn(linkClass, "w-full text-left")}>
          <LogoutIcon className="size-4" />
          Sair
        </button>
      </form>
    </div>
  );
}
