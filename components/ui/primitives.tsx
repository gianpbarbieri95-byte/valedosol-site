import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type PropertyStatus } from "@/lib/site";

/* ------------------------------------------------------------------ Badge */

type BadgeTone = "neutral" | "primary" | "gold" | "danger" | "muted";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-surface text-ink border-line",
  primary: "bg-primary text-white border-transparent",
  gold: "bg-gold-soft text-[#7a5a10] border-transparent",
  danger: "bg-danger text-white border-transparent",
  muted: "bg-surface-alt text-ink-soft border-transparent",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-xs)] border px-2 py-1",
        "text-[0.6875rem] font-medium uppercase tracking-[0.08em]",
        badgeTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Situação do imóvel. Disponível não vira selo: é o esperado, não notícia. */
export function StatusBadge({ status }: { status: PropertyStatus }) {
  if (status === "disponivel") return null;

  const tone: BadgeTone =
    status === "vendido" || status === "alugado" ? "danger" : status === "reservado" ? "gold" : "muted";

  return <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>;
}

/* ---------------------------------------------------------- SectionHeading */

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  action,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  /** "dark" para seções de fundo verde. */
  tone?: "light" | "dark";
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12",
        align === "center" && "md:flex-col md:items-center text-center",
        className
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow ? (
          <p className={cn("eyebrow mb-5", tone === "dark" && "text-gold-bright")}>{eyebrow}</p>
        ) : null}
        <h2 id={id} className={cn("text-balance text-display", tone === "dark" && "text-white")}>
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              "mt-5 max-w-xl text-pretty text-base leading-relaxed md:text-[1.0625rem]",
              tone === "dark" ? "text-white/70" : "text-ink-soft"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Campos */

export function Label({ className, children, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-1.5 block text-[0.8125rem] font-medium text-ink-soft", className)}
      {...props}
    >
      {children}
    </label>
  );
}

/* 16px no celular: abaixo disso o Safari do iPhone dá zoom na tela ao tocar
   no campo. Do sm para cima volta ao 14px do desenho. */
const fieldBase =
  "w-full rounded-[var(--radius-sm)] border border-line bg-surface px-3.5 text-base text-ink sm:text-sm " +
  "placeholder:text-muted transition-colors duration-150 " +
  "hover:border-line-strong focus:border-primary focus:outline-none " +
  "disabled:cursor-not-allowed disabled:bg-surface-alt";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        fieldBase,
        "h-11 appearance-none bg-[length:1.1rem] bg-[right_0.75rem_center] bg-no-repeat pr-9",
        // Seta desenhada em SVG inline para não depender de biblioteca de ícones
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 24 24%22 stroke=%22%237c847e%22 stroke-width=%221.6%22%3E%3Cpath stroke-linecap=%22round%22 stroke-linejoin=%22round%22 d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E')]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/** Rótulo + campo + mensagem de erro, com acessibilidade já ligada. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;

  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </Label>
      {children}
      {hint && !error ? (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- EmptyState */

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-md)]",
        "border border-dashed border-line-strong bg-surface px-6 py-16 text-center",
        className
      )}
    >
      <h3 className="text-xl">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-pretty text-sm leading-relaxed text-ink-soft">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("shimmer rounded-[var(--radius-sm)]", className)} />;
}
