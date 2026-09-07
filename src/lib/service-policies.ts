import "server-only";

import { platformDb } from "./db";

export type ServiceBookingPolicy = {
  intervalMinutes?: number;
  minimumNoticeMinutes?: number;
  maximumAdvanceDays?: number;
  cancellationHours?: number;
  rescheduleHours?: number;
};

export async function getServicePolicies(tenantId: string) {
  return platformDb.service.findMany({
    where: { tenantId, isActive: true },
    select: {
      id: true,
      name: true,
      category: true,
      bookingType: true,
      bookingPolicy: true,
      onlineEnabled: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export async function updateServicePolicy(
  tenantId: string,
  serviceId: string,
  policy: ServiceBookingPolicy,
  actorId: string,
) {
  const service = await platformDb.service.findFirst({ where: { id: serviceId, tenantId, isActive: true }, select: { id: true } });
  if (!service) throw new Error("Servicio inexistente");

  const compact = Object.fromEntries(Object.entries(policy).filter(([, value]) => value !== undefined));
  await platformDb.$transaction([
    platformDb.service.update({ where: { id: service.id }, data: { bookingPolicy: compact } }),
    platformDb.auditLog.create({
      data: {
        scope: "TENANT",
        tenantId,
        actorId,
        action: "service.booking_policy_updated",
        entityType: "Service",
        entityId: service.id,
        metadata: compact,
      },
    }),
  ]);
}
