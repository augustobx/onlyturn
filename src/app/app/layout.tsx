import { requireTenantSession } from "@/lib/auth";
import { platformDb } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { SetupAwareContent } from "@/components/setup-aware-content";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const { session, tenant } = await requireTenantSession();
  const pendingRegistrations = await platformDb.customerAccount.count({ where: { tenantId: tenant.id, status: "PENDING" } });
  return <AppShell tenantName={tenant.name} userName={session.user.name} pendingRegistrations={pendingRegistrations}><SetupAwareContent>{children}</SetupAwareContent></AppShell>;
}
