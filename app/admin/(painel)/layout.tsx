import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  // Segunda camada de proteção, depois do proxy.ts e antes da RLS.
  const session = await requireStaff();

  // Selo de "contatos novos" no menu. Falha aqui não pode derrubar o painel.
  const supabase = await createClient();
  const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "novo");

  return (
    <AdminShell
      role={session.profile.role}
      name={session.profile.name ?? session.email}
      email={session.email}
      newLeads={count ?? 0}
    >
      {children}
    </AdminShell>
  );
}
