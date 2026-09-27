import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { ChevronLeftIcon } from "@/components/ui/icons";

/**
 * Moldura das telas de senha (esqueci / senha nova): mesma marca do login,
 * sem o painel lateral — são telas de uma tarefa só.
 */
export function AuthCard({
  title,
  description,
  back,
  children,
}: {
  title: string;
  description?: string;
  back: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-canvas px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
      <div className="mx-auto flex w-full max-w-[26rem] items-center justify-between gap-4">
        <Link href={SITE.url} className="inline-flex rounded-[var(--radius-md)] bg-white p-1.5 shadow-float">
          <Image src="/brand/logo.png" alt={SITE.name} width={250} height={249} unoptimized priority className="size-12" />
        </Link>
        <Link
          href={back.href}
          className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-sm)] px-3 text-[0.8125rem] text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink"
        >
          <ChevronLeftIcon className="size-4" />
          {back.label}
        </Link>
      </div>

      <div className="mx-auto mt-10 w-full max-w-[26rem] sm:my-auto sm:rounded-[var(--radius-md)] sm:border sm:border-line sm:bg-surface sm:p-8">
        <h1 className="text-title lining-nums">{title}</h1>
        {description ? <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{description}</p> : null}
        <div className="mt-8">{children}</div>
      </div>

      <p className="mt-10 text-center text-xs tracking-[0.06em] text-muted">
        {SITE.creci} · Arujá-SP · Desde 1975
      </p>
    </main>
  );
}
