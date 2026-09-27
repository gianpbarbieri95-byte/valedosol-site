import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Peças visuais do painel: cabeçalho de página, painel com título, cartão de
 * número e aviso de instalação pendente. Cores só pelos tokens do tema.
 */

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: { href: string; label: string }[];
}) {
  return (
    <header className="mb-6 sm:mb-7">
      {breadcrumb?.length ? (
        <nav aria-label="Você está em" className="mb-2 flex flex-wrap items-center gap-1.5 text-sm text-muted">
          {breadcrumb.map((crumb) => (
            <span key={crumb.href} className="flex items-center gap-1.5">
              <Link href={crumb.href} className="hover:text-ink">
                {crumb.label}
              </Link>
              <span aria-hidden>/</span>
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-balance text-3xl">{title}</h1>
          {description ? <div className="mt-1.5 text-sm text-ink-soft">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Painel branco com faixa de cor no topo, como os blocos do início. */
export function Panel({
  title,
  icon,
  action,
  accent = "primary",
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  accent?: "primary" | "gold" | "danger" | "none";
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-md)] border border-line bg-surface shadow-card",
        accent === "primary" && "border-t-[3px] border-t-primary",
        accent === "gold" && "border-t-[3px] border-t-gold-bright",
        accent === "danger" && "border-t-[3px] border-t-danger",
        className
      )}
    >
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 className="flex items-center gap-2 font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-ink">
            {icon ? <span className="text-primary">{icon}</span> : null}
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

const TILE_TONES = {
  deep: "bg-primary-deep text-white",
  primary: "bg-primary text-white",
  gold: "bg-gold text-white",
  bright: "bg-gold-bright text-primary-deep",
  danger: "bg-danger text-white",
  ink: "bg-ink text-white",
} as const;

/** Cartão de número do início: cor sólida, número grande, ícone ao fundo. */
export function StatTile({
  label,
  value,
  detail,
  href,
  tone,
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  href: string;
  tone: keyof typeof TILE_TONES;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative isolate flex min-h-28 flex-col justify-end overflow-hidden rounded-[var(--radius-md)] p-4 shadow-card transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-lift sm:min-h-32 sm:p-5",
        TILE_TONES[tone]
      )}
    >
      <span aria-hidden className="absolute -left-3 -top-2 -z-10 opacity-15 [&_svg]:size-28 sm:[&_svg]:size-32">
        {icon}
      </span>
      <span className="text-right font-display text-[2.25rem] leading-none lining-nums sm:text-[2.75rem]">{value}</span>
      <span className="mt-1.5 text-right text-[0.8125rem] leading-snug opacity-90 sm:text-sm">{label}</span>
      {detail ? <span className="text-right text-xs opacity-75">{detail}</span> : null}
    </Link>
  );
}

/** Mostrado nas telas do CRM enquanto a migration 0005 não foi aplicada. */
export function CrmPendingNotice({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn("rounded-[var(--radius-md)] border border-gold/30 bg-gold-soft px-5 py-4 text-sm leading-relaxed text-[#7a5a10]", className)}
    >
      <p className="font-medium">Instalação pendente no banco de dados</p>
      <p className="mt-1">
        Clientes, negócios, atividades e portais precisam das tabelas novas. Peça a quem administra o Supabase
        para rodar o arquivo <code className="font-mono text-[0.8125rem]">supabase/migrations/0005_crm_portais.sql</code>{" "}
        no SQL Editor. Ele só cria tabelas novas — nada do que já existe é alterado.
      </p>
    </div>
  );
}

/** Selo pequeno e colorido (estágio, tipo de cliente, temperatura). */
export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "gold" | "danger" | "success";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium leading-4",
        tone === "neutral" && "bg-surface-alt text-ink-soft",
        tone === "primary" && "bg-primary-soft text-primary",
        tone === "gold" && "bg-gold-soft text-gold",
        tone === "danger" && "bg-danger/10 text-danger",
        tone === "success" && "bg-primary text-white",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Aviso de resultado vindo de ?ok= na URL depois de salvar/excluir. */
export function FlashMessage({ message, tone = "success" }: { message?: string | null; tone?: "success" | "error" }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className={cn(
        "mb-6 rounded-[var(--radius-sm)] border px-4 py-3 text-sm",
        tone === "success" ? "border-primary/20 bg-primary-soft text-primary" : "border-danger/30 bg-danger/10 text-danger"
      )}
    >
      {message}
    </p>
  );
}
