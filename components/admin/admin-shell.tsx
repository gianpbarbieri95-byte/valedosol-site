"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/actions/auth";
import { cn } from "@/lib/utils";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import type { UserRole } from "@/types/database";

interface NavItem {
  href: string;
  label: string;
  /** Sem esta chave, o item aparece para qualquer papel. */
  roles?: UserRole[];
}

const NAV: NavItem[] = [
  { href: "/admin/dashboard", label: "Início" },
  { href: "/admin/imoveis", label: "Imóveis" },
  { href: "/admin/leads", label: "Contatos" },
  { href: "/admin/regioes", label: "Regiões" },
  { href: "/admin/tipos-imovel", label: "Tipos de imóvel" },
  { href: "/admin/configuracoes", label: "Configurações", roles: ["admin"] },
];

/**
 * Moldura do painel.
 *
 * O menu esconde o que o papel não pode usar, mas isso é conveniência: o
 * bloqueio real está em requireAdmin() e nas policies de RLS.
 */
export function AdminShell({
  children,
  role,
  name,
  email,
}: {
  children: React.ReactNode;
  role: UserRole;
  name: string;
  email: string;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = NAV.filter((item) => !item.roles || item.roles.includes(role));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <nav aria-label="Painel" className="space-y-0.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMenuOpen(false)}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={cn(
            "block rounded-[var(--radius-sm)] px-3 py-2.5 text-sm transition-colors",
            isActive(item.href)
              ? "bg-primary-soft font-medium text-primary"
              : "text-ink-soft hover:bg-surface-alt hover:text-ink"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Topo no celular */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <Image src="/brand/logo.png" alt="" width={250} height={249} className="h-8 w-auto" />
          <span className="text-sm font-medium">Painel</span>
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          className="grid size-10 place-items-center rounded-[var(--radius-sm)] hover:bg-surface-alt"
        >
          {menuOpen ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
        </button>
      </header>

      {menuOpen ? (
        <div className="border-b border-line bg-surface p-4 lg:hidden">
          {nav}
          <SignOutButton className="mt-4 w-full" />
        </div>
      ) : null}

      <div className="lg:flex">
        {/* Barra lateral no desktop */}
        <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:flex lg:min-h-screen lg:flex-col">
          <div className="border-b border-line px-5 py-5">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/brand/logo.png" alt="" width={250} height={249} className="h-10 w-auto" />
              <span className="text-[0.8125rem] leading-tight text-ink-soft">
                Vale do Sol
                <br />
                <span className="text-muted">Painel</span>
              </span>
            </Link>
          </div>

          <div className="flex-1 p-3">{nav}</div>

          <div className="border-t border-line p-4">
            <p className="truncate text-sm font-medium text-ink">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
            <p className="mt-1 text-[0.6875rem] uppercase tracking-[0.1em] text-gold">
              {role === "admin" ? "Administrador" : "Editor"}
            </p>
            <SignOutButton className="mt-3 w-full" />
            <Link
              href="/"
              className="mt-2 block text-center text-xs text-muted transition-colors hover:text-ink-soft"
            >
              Ver o site
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-5 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={cn(
          "h-9 rounded-[var(--radius-sm)] border border-line px-3 text-[0.8125rem] text-ink-soft transition-colors hover:border-line-strong hover:text-ink",
          className
        )}
      >
        Sair
      </button>
    </form>
  );
}
