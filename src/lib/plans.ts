import "server-only";
import { z } from "zod";
import { platformDb } from "./db";

const planFeaturesSchema = z.object({
  maxLocations: z.number().int().positive(),
  maxStaff: z.number().int().positive(),
  maxResources: z.number().int().positive(),
  maxBookings: z.number().int().positive(),
  whatsappNotifications: z.boolean(),
  advancedReports: z.boolean(),
  customDomain: z.boolean(),
  waitlist: z.boolean(),
  deposits: z.boolean(),
  recurringBookings: z.boolean(),
}).strict();

export type PlanFeatures = z.infer<typeof planFeaturesSchema>;

export async function effectiveFeatures(tenantId: string): Promise<PlanFeatures> {
  const subscription = await platformDb.subscription.findFirst({
    where: { tenantId, status: { in: ["ACTIVE", "TRIALING"] } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) throw new Error("El tenant no tiene una suscripción activa");

  const features = planFeaturesSchema.parse(subscription.plan.features);
  const overrides = await platformDb.tenantFeatureOverride.findMany({ where: { tenantId } });
  const result: Record<string, boolean | number> = { ...features };

  for (const override of overrides) {
    if (!(override.key in features)) continue;
    const current = result[override.key];
    if (typeof current === "boolean" && override.enabled !== null) result[override.key] = override.enabled;
    if (typeof current === "number" && override.limit !== null && override.limit > 0) result[override.key] = override.limit;
  }

  return planFeaturesSchema.parse(result);
}

export async function assertPlanCapacity(
  tenantId: string,
  resource: "locations" | "staff" | "resources" | "bookings",
) {
  const features = await effectiveFeatures(tenantId);
  const limits = {
    locations: features.maxLocations,
    staff: features.maxStaff,
    resources: features.maxResources,
    bookings: features.maxBookings,
  };
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const counts = {
    locations: () => platformDb.location.count({ where: { tenantId, isActive: true } }),
    staff: () => platformDb.professional.count({ where: { tenantId, isActive: true } }),
    resources: () => platformDb.resource.count({ where: { tenantId, isActive: true } }),
    bookings: () => platformDb.booking.count({ where: { tenantId, createdAt: { gte: monthStart } } }),
  };

  const current = await counts[resource]();
  if (current >= limits[resource]) {
    const labels = { locations: "sedes", staff: "profesionales", resources: "recursos", bookings: "turnos mensuales" };
    throw new Error(`Límite del plan alcanzado para ${labels[resource]} (${current}/${limits[resource]})`);
  }
}
