import { requireStaff } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  // Segunda camada de proteção, depois do proxy.ts e antes da RLS.
  const session = await requireStaff();

  return (
    <AdminShell
      role={session.profile.role}
      name={session.profile.name ?? session.email}
      email={session.email}
    >
      {children}
    </AdminShell>
  );
}
