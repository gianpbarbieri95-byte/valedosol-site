import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isAdminHost } from "@/lib/admin-host";

export const metadata: Metadata = {
  // O painel nunca entra em índice de busca.
  robots: { index: false, follow: false },
};

/**
 * Camada mais externa do painel. Fica de propósito sem barra lateral e sem
 * verificação de sessão: a página de login mora aqui dentro.
 * A área autenticada tem o próprio layout em (painel)/layout.tsx.
 *
 * O painel só existe no host admin.* (ver lib/admin-host.ts). O proxy.ts já
 * responde 404 para /admin no site público; esta checagem repete a regra no
 * servidor, para que nenhuma tela do painel seja renderizada no domínio
 * público mesmo que o matcher do proxy mude um dia.
 */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  if (!isAdminHost((await headers()).get("host"))) notFound();

  return children;
}
