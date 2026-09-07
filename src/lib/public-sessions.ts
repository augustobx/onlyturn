import "server-only";

import { platformDb } from "./db";

export async function getPublicSessions(input: { tenantId: string; locationId: string; serviceId: string }) {
  const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { id: input.tenantId }, select: { settings: true } });
  const settings = tenant.settings as { maximumAdvanceDays?: number };
  const maxDate = new Date(Date.now() + (settings.maximumAdvanceDays ?? 60) * 86_400_000);

  const service = await platformDb.service.findFirst({
    where: {
      id: input.serviceId,
      tenantId: input.tenantId,
      isActive: true,
      onlineEnabled: true,
      bookingType: { in: ["CLASS", "EVENT"] },
      locations: { some: { locationId: input.locationId } },
    },
    select: { id: true },
  });
  if (!service) throw new Error("Clase o evento no disponible");

  const sessions = await platformDb.bookingSession.findMany({
    where: {
      tenantId: input.tenantId,
      serviceId: input.serviceId,
      locationId: input.locationId,
      status: "SCHEDULED",
      onlineEnabled: true,
      startsAt: { gte: new Date(), lte: maxDate },
    },
    include: {
      professional: { select: { id: true, name: true } },
      resource: { select: { id: true, name: true, type: true } },
      bookings: {
        where: { status: { notIn: ["CANCELLED", "NO_SHOW"] } },
        select: { partySize: true },
      },
    },
    orderBy: { startsAt: "asc" },
    take: 100,
  });

  return sessions.map((session) => {
    const occupied = session.bookings.reduce((sum, booking) => sum + booking.partySize, 0);
    return {
      id: session.id,
      title: session.title,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      capacity: session.capacity,
      occupied,
      available: Math.max(0, session.capacity - occupied),
      professional: session.professional,
      resource: session.resource,
    };
  });
}
