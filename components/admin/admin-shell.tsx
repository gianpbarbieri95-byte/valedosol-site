"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/actions/auth";
import { SITE } from "@/lib/site";
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
  { href: "/dashboard", label: "Início" },
  { href: "/imoveis", label: "Imóveis" },
  { href: "/leads", label: "Contatos" },
  { href: "/regioes", label: "Regiões" },
  { href: "/tipos-imovel", label: "Tipos de imóvel" },
  { href: "/configuracoes", label: "Configurações", roles: ["admin"] },
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
            "block rounded-[var(--radius-sm)] px-3 py-3 text-[0.9375rem] transition-colors lg:py-2.5 lg:text-sm",
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
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/brand/logo.png" alt="" width={250} height={249} className="h-8 w-auto" />
          <span className="text-sm font-medium">Painel</span>
        </Link>
        <div className="flex items-center gap-1.5">
          {/* Cadastrar é o que mais se faz no celular: fica sempre a um toque. */}
          {pathname !== "/imoveis/novo" ? (
            <Link
              href="/imoveis/novo"
              onClick={() => setMenuOpen(false)}
              className="inline-flex h-10 items-center rounded-[var(--radius-sm)] bg-primary px-3.5 text-[0.8125rem] font-medium text-white transition-colors hover:bg-primary-hover"
            >
              + Novo imóvel
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            className="grid size-10 place-items-center rounded-[var(--radius-sm)] hover:bg-surface-alt"
          >
            {menuOpen ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div className="sticky top-[4.0625rem] z-[35] max-h-[calc(100dvh-4.0625rem)] overflow-y-auto border-b border-line bg-surface p-4 shadow-lg lg:hidden">
          {nav}
          <div className="mt-4 border-t border-line pt-4">
            <p className="truncate text-sm font-medium text-ink">{name}</p>
            <p className="truncate text-xs text-muted">
              {email} ·{" "}
              <Link href="/nova-senha" onClick={() => setMenuOpen(false)} className="text-primary">
                trocar senha
              </Link>
            </p>
            <div className="mt-3 flex gap-2">
              <SignOutButton className="h-11 w-full" />
              <Link
                href={SITE.url}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-[var(--radius-sm)] border border-line text-[0.8125rem] text-ink-soft"
              >
                Ver o site
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="lg:flex">
        {/* Barra lateral no desktop */}
        <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:flex lg:min-h-screen lg:flex-col">
          <div className="border-b border-line px-5 py-5">
            <Link href={SITE.url} className="flex items-center gap-2.5">
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
            <div className="mt-2 flex justify-center gap-3 text-xs text-muted">
              <Link href="/nova-senha" className="transition-colors hover:text-ink-soft">
                Trocar senha
              </Link>
              <span aria-hidden>·</span>
              <Link href={SITE.url} className="transition-colors hover:text-ink-soft">
                Ver o site
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-5 sm:py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut} className="flex-1">
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
