import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "gold" | "brass" | "danger" | "onDark";
type Size = "sm" | "md" | "lg";

const base =
  "group/btn inline-flex items-center justify-center gap-2.5 font-medium uppercase tracking-[0.12em] " +
  "transition-[background-color,color,border-color,box-shadow,transform] duration-300 " +
  "ease-[var(--ease-premium)] active:translate-y-px " +
  "disabled:pointer-events-none disabled:opacity-50 rounded-[var(--radius-sm)] " +
  "whitespace-nowrap " +
  // A seta dentro do botão desliza um fio no hover — o movimento é do ícone,
  // nunca do bloco inteiro, que continua um alvo de clique parado.
  "[&_svg[data-arrow]]:transition-transform [&_svg[data-arrow]]:duration-300 " +
  "hover:[&_svg[data-arrow]]:translate-x-1";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  outline:
    "border border-ink/25 bg-transparent text-ink hover:border-ink hover:bg-ink hover:text-white",
  ghost: "text-ink-soft hover:bg-surface-alt hover:text-ink",
  gold: "bg-gold text-white hover:bg-gold-hover",
  // O dourado sobre o verde escuro: o tom claro do logo, com texto escuro.
  brass: "bg-gold-bright text-primary-deep hover:bg-[#e2b654]",
  danger: "bg-danger text-white hover:brightness-95",
  // Sobre foto ou fundo escuro: vidro claro que não briga com a imagem.
  onDark: "border border-white/40 bg-transparent text-white hover:border-white hover:bg-white hover:text-primary-deep",
};

const sizes: Record<Size, string> = {
  sm: "h-10 px-4 text-[0.6875rem]",
  md: "h-12 px-6 text-[0.71875rem]",
  lg: "h-14 px-8 text-[0.75rem]",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: CommonProps & ComponentProps<"button">) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </Link>
  );
}

/** Link externo (WhatsApp, redes, mapas) com as proteções de rel corretas. */
export function ButtonExternal({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: CommonProps & ComponentProps<"a">) {
  return (
    <a
      className={cn(base, variants[variant], sizes[size], className)}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  );
}
