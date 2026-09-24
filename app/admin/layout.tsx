import type { Metadata } from "next";

export const metadata: Metadata = {
  // O painel nunca entra em índice de busca.
  robots: { index: false, follow: false },
};

/**
 * Camada mais externa do /admin. Fica de propósito sem barra lateral e sem
 * verificação de sessão: a página de login mora aqui dentro.
 * A área autenticada tem o próprio layout em (painel)/layout.tsx.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
