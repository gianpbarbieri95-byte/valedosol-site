"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useScrolled } from "@/hooks/use-browser-state";
import { cn } from "@/lib/utils";
import { phoneHref, whatsappUrl } from "@/lib/format";
import { SITE } from "@/lib/site";
import type { ContactSettings } from "@/types/database";
import { CloseIcon, HeartIcon, MenuIcon, WhatsAppIcon } from "@/components/ui/icons";
import { ButtonLink } from "@/components/ui/button";

/**
 * Navegação do desktop: só o essencial, na ordem em que o visitante pensa —
 * primeiro o que ele procura, depois quem somos, por fim o proprietário.
 * "Falar conosco" é o único botão; o resto é texto.
 */
const NAV = [
  { href: "/imoveis", label: "Imóveis" },
  { href: "/imoveis?finalidade=venda", label: "Comprar" },
  { href: "/imoveis?finalidade=locacao", label: "Alugar" },
  { href: "/regioes", label: "Regiões" },
  { href: "/a-imobiliaria", label: "A Vale do Sol" },
  { href: "/venda-seu-imovel", label: "Venda seu imóvel" },
];

/** O menu de tela cheia leva a todas as páginas do site. */
const MENU = [
  { href: "/imoveis", label: "Imóveis" },
  { href: "/imoveis?finalidade=venda", label: "Comprar" },
  { href: "/imoveis?finalidade=locacao", label: "Alugar" },
  { href: "/regioes", label: "Regiões" },
  { href: "/a-imobiliaria", label: "A Vale do Sol" },
  { href: "/venda-seu-imovel", label: "Venda seu imóvel" },
  { href: "/contato", label: "Contato" },
];

export function Header({ contact }: { contact: ContactSettings }) {
  const scrolled = useScrolled();
  const scrolledFar = useScrolled(560);
  const pathname = usePathname();

  // O menu guarda em que página foi aberto. Navegar para outra rota o fecha
  // por derivação, sem um efeito que dispare renderização em cascata.
  const [menu, setMenu] = useState({ open: false, path: pathname });
  const menuOpen = menu.open && menu.path === pathname;
  const setMenuOpen = useCallback(
    (open: boolean) => setMenu({ open, path: window.location.pathname }),
    []
  );

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, setMenuOpen]);

  const whatsapp = whatsappUrl(contact.whatsapp);
  const tel = phoneHref(contact.phone);

  const isActive = (href: string) => {
    const [path, query] = href.split("?");
    // Comprar e Alugar são atalhos de filtro: quem acende na listagem é "Imóveis".
    if (query) return false;
    if (path === "/imoveis") return pathname.startsWith("/imoveis");
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  // Na home o cabeçalho flutua sobre a abertura escura e só ganha corpo
  // quando a página rola. Quem decide é o CSS (variante `hero:` em
  // globals.css), a partir de #home-hero e de data-scrolled — nunca o
  // pathname, que pode divergir entre o HTML da ISR e o navegador.

  return (
    <>
      <header
        data-header
        data-scrolled={scrolled ? "true" : "false"}
        className={cn(
          "group/header fixed inset-x-0 top-0 z-50",
          "transition-[background-color,border-color,backdrop-filter] duration-700 ease-[var(--ease-premium)]",
          "border-b border-line bg-canvas/92 backdrop-blur-md",
          "hero:border-white/10 hero:bg-transparent hero:backdrop-blur-none"
        )}
      >
        {/* Rolando a página, a barra encolhe um pouco e o logo acompanha:
            continua presente sem pesar sobre o conteúdo. */}
        <div className="container-site flex h-20 items-center justify-between gap-6 transition-[height] duration-500 ease-[var(--ease-premium)] lg:h-[7rem] lg:group-data-[scrolled=true]/header:h-20">
          {/*
            O logo oficial entra como está: sem recorte, filtro ou recriação.
            Ele foi desenhado para fundo claro, então sobre a abertura escura
            ganha uma placa clara atrás — o arquivo continua intacto.
          */}
          <Link
            href="/"
            className={cn(
              "flex shrink-0 items-center rounded-[var(--radius-xs)] transition-[background-color,padding] duration-700",
              "px-0 py-0 hero:bg-canvas hero:px-2.5 hero:py-1.5"
            )}
            aria-label={`${SITE.name} — início`}
          >
            <Image
              src="/brand/logo.png"
              alt={SITE.name}
              width={250}
              height={249}
              priority
              // Servido como está: a recompressão do otimizador borrava o texto fino.
              unoptimized
              className="h-16 w-auto transition-[height] duration-500 ease-[var(--ease-premium)] lg:h-[5.5rem] lg:group-data-[scrolled=true]/header:h-16"
            />
          </Link>

          <nav aria-label="Navegação principal" className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  data-active={active ? "true" : undefined}
                  className={cn(
                    "link-sweep px-2.5 pb-3 xl:px-3.5 pt-2.5 text-[0.8125rem] tracking-[0.02em] transition-colors duration-300",
                    active ? "text-ink" : "text-ink-soft hover:text-ink",
                    "hero:text-white/80 hero:hover:text-white"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {tel ? (
              <a
                href={tel}
                className={cn(
                  "hidden text-[0.8125rem] tabular transition-colors duration-300 xl:block",
                  "text-ink-soft hover:text-ink hero:text-white/70 hero:hover:text-white"
                )}
              >
                {contact.phone}
              </a>
            ) : null}

            <Link
              href="/favoritos"
              aria-label="Meus favoritos"
              className={cn(
                "grid size-11 place-items-center transition-colors duration-300",
                "text-ink-soft hover:text-ink hero:text-white/85 hero:hover:text-white"
              )}
            >
              <HeartIcon className="size-[1.15rem]" />
            </Link>

            <ButtonLink
              href="/contato"
              size="sm"
              variant="primary"
              className={cn(
                "max-md:!hidden border border-transparent",
                "hero:border-white/40 hero:bg-transparent hero:hover:border-white hero:hover:bg-white hero:hover:text-primary-deep"
              )}
            >
              Falar conosco
            </ButtonLink>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="menu-tela-cheia"
              aria-label="Abrir menu"
              className={cn(
                "-mr-2 grid size-11 place-items-center transition-colors lg:hidden",
                "text-ink hero:text-white"
              )}
            >
              <MenuIcon className="size-6" />
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------ Menu de tela cheia */}
      {menuOpen ? (
        <div
          id="menu-tela-cheia"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fade-in fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-primary-deep text-white"
        >
          <div className="container-site flex h-20 shrink-0 items-center justify-between lg:h-[7rem]">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="rounded-[var(--radius-xs)] bg-canvas px-2.5 py-1.5"
              aria-label={`${SITE.name} — início`}
            >
              <Image src="/brand/logo.png" alt={SITE.name} width={250} height={249} unoptimized className="h-16 w-auto" />
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Fechar menu"
              autoFocus
              className="-mr-2 grid size-11 place-items-center text-white"
            >
              <CloseIcon className="size-6" />
            </button>
          </div>

          <nav aria-label="Menu" className="container-site flex flex-1 flex-col justify-center py-8">
            <ul>
              {MENU.map((item, index) => (
                <li key={item.href} className="border-b border-white/10">
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="rise-in group flex items-baseline justify-between gap-4 py-3.5"
                    style={{ animationDelay: `${80 + index * 45}ms` }}
                  >
                    <span className="font-display text-[2.1rem] leading-none tracking-[-0.01em] transition-colors duration-300 group-hover:text-gold-bright sm:text-5xl">
                      {item.label}
                    </span>
                    <span aria-hidden className="text-xs text-white/35 tabular">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div
            className="rise-in container-site shrink-0 pb-10"
            style={{ animationDelay: "420ms" }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {whatsapp ? (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-14 items-center justify-center gap-2.5 rounded-[var(--radius-sm)] bg-gold text-[0.75rem] font-medium uppercase tracking-[0.12em] text-white"
                >
                  <WhatsAppIcon />
                  Falar pelo WhatsApp
                </a>
              ) : null}
              <Link
                href="/favoritos"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-14 items-center justify-center gap-2.5 rounded-[var(--radius-sm)] border border-white/25 text-[0.75rem] font-medium uppercase tracking-[0.12em]"
              >
                <HeartIcon className="size-4" />
                Meus favoritos
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-white/60">
              {tel ? <a href={tel} className="tabular">{contact.phone}</a> : null}
              <p className="label-caps text-[0.625rem] text-white/40">
                {SITE.creci} · Arujá desde {SITE.foundedYear}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/*
        Atalho de WhatsApp no celular: aparece depois da primeira dobra e fica
        num canto, sem cobrir conteúdo. A página do imóvel tem barra própria.
      */}
      {/* Na página do imóvel quem faz esse papel é a barra fixa de preço. */}
      {whatsapp ? (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Falar com a Vale do Sol pelo WhatsApp"
          tabIndex={scrolledFar ? 0 : -1}
          className={cn(
            "fixed bottom-5 right-5 z-40 grid size-13 place-items-center rounded-full bg-primary text-white shadow-float lg:hidden on-property:!hidden",
            "transition-[opacity,transform] duration-500 ease-[var(--ease-premium)]",
            scrolledFar && !menuOpen ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0"
          )}
        >
          <WhatsAppIcon className="size-6" />
        </a>
      ) : null}

      {/*
        O cabeçalho é fixo, então precisa de um espaço equivalente no fluxo.
        Na home esse espaço não existe: a abertura passa por baixo de propósito.
      */}
      <div aria-hidden className="h-20 on-home:hidden lg:h-[7rem]" />
    </>
  );
}
