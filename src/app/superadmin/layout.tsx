import { requireSuperAdmin } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSuperAdmin();
  return <AppShell tenantName="NanoLabs" userName={session.user.name} superAdmin>{children}</AppShell>;
}
