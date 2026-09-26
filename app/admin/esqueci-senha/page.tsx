import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/auth-card";
import { ResetRequestForm } from "./reset-request-form";

export const metadata: Metadata = {
  title: "Esqueci minha senha",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Esqueci minha senha"
      description="Informe o e-mail que você usa para entrar. Enviamos um link para você criar uma senha nova."
      back={{ href: "/admin/login", label: "Voltar ao login" }}
    >
      <ResetRequestForm />
    </AuthCard>
  );
}
