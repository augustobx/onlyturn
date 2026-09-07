import { requireSuperAdmin } from "@/lib/auth";
import { platformDb } from "@/lib/db";
import { TenantsManager } from "./tenants-manager";

export default async function SuperAdminTenantsPage() {
  await requireSuperAdmin();

  const [tenants, plans] = await Promise.all([
    platformDb.tenant.findMany({
      include: {
        memberships: { where: { role: "OWNER", isActive: true }, include: { user: true }, take: 1 },
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { memberships: true, customers: true, bookings: true, locations: true, professionals: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    platformDb.plan.findMany({ where: { isActive: true }, orderBy: { priceCents: "asc" } }),
  ]);

  return (
    <TenantsManager
      plans={plans.map((plan) => ({ id: plan.id, name: plan.name, code: plan.code, priceCents: plan.priceCents }))}
      tenants={tenants.map((tenant) => {
        const owner = tenant.memberships[0]?.user;
        const subscription = tenant.subscriptions[0];
        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
          createdAt: tenant.createdAt.toISOString(),
          ownerName: owner?.name ?? null,
          ownerEmail: owner?.email ?? null,
          planName: subscription?.plan.name ?? null,
          planPriceCents: subscription?.plan.priceCents ?? null,
          subscriptionStatus: subscription?.status ?? null,
          membershipStart: subscription?.currentPeriodStart.toISOString() ?? null,
          membershipEnd: subscription?.currentPeriodEnd.toISOString() ?? null,
          memberships: tenant._count.memberships,
          customers: tenant._count.customers,
          bookings: tenant._count.bookings,
          locations: tenant._count.locations,
          professionals: tenant._count.professionals,
        };
      })}
    />
  );
}
