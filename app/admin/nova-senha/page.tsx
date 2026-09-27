import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { AuthCard } from "@/components/admin/auth-card";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = {
  title: "Senha nova",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Criar senha nova. Chega-se aqui pelo link do e-mail (a sessão já foi
 * aberta em /auth/confirmar) ou pelo menu do painel, para trocar.
 */
export default async function NewPasswordPage() {
  const session = await requireStaff("/nova-senha");

  return (
    <AuthCard
      title="Criar senha nova"
      description={`Conta: ${session.email}. Depois de salvar, é esta a senha para entrar no painel.`}
      back={{ href: "/dashboard", label: "Ir para o painel" }}
    >
      <NewPasswordForm email={session.email} />
    </AuthCard>
  );
}
