import "server-only";
import { platformDb } from "./db";

export type PlanFeatures = {
  maxLocations: number; maxStaff: number; maxResources: number; maxBookings: number;
  whatsappNotifications: boolean; advancedReports: boolean; customDomain: boolean;
  waitlist: boolean; deposits: boolean; recurringBookings: boolean;
};

export async function effectiveFeatures(tenantId: string): Promise<PlanFeatures> {
  const subscription = await platformDb.subscription.findFirst({
    where: { tenantId, status: { in: ["ACTIVE", "TRIALING"] } },
    include: { plan: true }, orderBy: { createdAt: "desc" }
  });
  if (!subscription) throw new Error("Tenant has no active subscription");
  const features = subscription.plan.features as PlanFeatures;
  const overrides = await platformDb.tenantFeatureOverride.findMany({ where: { tenantId } });
  const result = { ...features } as Record<string, boolean | number>;
  for (const override of overrides) {
    if (override.enabled !== null) result[override.key] = override.enabled;
    if (override.limit !== null) result[override.key] = override.limit;
  }
  return result as PlanFeatures;
}

export async function assertPlanCapacity(tenantId: string, resource: "locations" | "staff" | "resources" | "bookings") {
  const features = await effectiveFeatures(tenantId);
  const limits = { locations: features.maxLocations, staff: features.maxStaff, resources: features.maxResources, bookings: features.maxBookings };
  const counts = {
    locations: () => platformDb.location.count({ where: { tenantId, isActive: true } }),
    staff: () => platformDb.professional.count({ where: { tenantId, isActive: true } }),
    resources: () => platformDb.resource.count({ where: { tenantId, isActive: true } }),
    bookings: () => platformDb.booking.count({ where: { tenantId, createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } })
  };
  if (await counts[resource]() >= limits[resource]) throw new Error(`Límite del plan alcanzado: ${resource}`);
}
