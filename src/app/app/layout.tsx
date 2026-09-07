import { requireTenantSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { SetupAwareContent } from "@/components/setup-aware-content";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const { session, tenant } = await requireTenantSession();
  return <AppShell tenantName={tenant.name} userName={session.user.name}><SetupAwareContent>{children}</SetupAwareContent></AppShell>;
}
