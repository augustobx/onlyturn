import "server-only";

import { platformDb } from "./db";

export type CreateBookingSessionInput = {
  serviceId: string;
  locationId: string;
  professionalId?: string;
  resourceId?: string;
  startsAt: Date;
  capacity: number;
  title?: string;
  notes?: string;
  onlineEnabled: boolean;
};

export async function getSessionManagementData(tenantId: string) {
  const now = new Date();
  return Promise.all([
    platformDb.service.findMany({
      where: { tenantId, isActive: true, bookingType: { in: ["CLASS", "EVENT"] } },
      include: {
        locations: { include: { location: true } },
        professionals: { include: { professional: true } },
        resources: { include: { resource: true } },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    platformDb.bookingSession.findMany({
      where: { tenantId, endsAt: { gte: now } },
      include: {
        service: true,
        location: true,
        professional: true,
        resource: true,
        bookings: {
          where: { status: { notIn: ["CANCELLED", "NO_SHOW"] } },
          select: { id: true, partySize: true, status: true, customer: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { startsAt: "asc" },
      take: 250,
    }),
  ] as const);
}

export async function createBookingSession(tenantId: string, input: CreateBookingSessionInput, actorId: string) {
  const service = await platformDb.service.findFirst({
    where: { id: input.serviceId, tenantId, isActive: true, bookingType: { in: ["CLASS", "EVENT"] } },
    include: {
      locations: { select: { locationId: true } },
      professionals: { select: { professionalId: true } },
      resources: { select: { resourceId: true } },
    },
  });
  if (!service) throw new Error("El tipo de reserva no admite sesiones");
  if (!service.locations.some((item) => item.locationId === input.locationId)) throw new Error("La sede no está habilitada para este servicio");
  if (service.professionalMode === "REQUIRED" && !input.professionalId) throw new Error("Seleccioná un profesional");
  if (service.resourceMode === "REQUIRED" && !input.resourceId) throw new Error("Seleccioná un recurso");
  if (input.professionalId && !service.professionals.some((item) => item.professionalId === input.professionalId)) throw new Error("Profesional no habilitado para este servicio");
  if (input.resourceId && !service.resources.some((item) => item.resourceId === input.resourceId)) throw new Error("Recurso no habilitado para este servicio");
  if (input.capacity < 1 || input.capacity > Math.max(service.maxPartySize, 1)) throw new Error(`El cupo debe estar entre 1 y ${Math.max(service.maxPartySize, 1)}`);

  const endsAt = new Date(input.startsAt.getTime() + service.durationMinutes * 60_000);
  const capacityStartsAt = new Date(input.startsAt.getTime() - service.preparationMinutes * 60_000);
  const capacityEndsAt = new Date(endsAt.getTime() + service.bufferMinutes * 60_000);

  return platformDb.$transaction(async (tx) => {
    const session = await tx.bookingSession.create({
      data: {
        tenantId,
        serviceId: service.id,
        locationId: input.locationId,
        professionalId: input.professionalId || null,
        resourceId: input.resourceId || null,
        title: input.title || null,
        startsAt: input.startsAt,
        endsAt,
        capacityStartsAt,
        capacityEndsAt,
        capacity: input.capacity,
        notes: input.notes || null,
        onlineEnabled: input.onlineEnabled,
        createdById: actorId,
      },
    });
    await tx.auditLog.create({
      data: {
        scope: "TENANT",
        tenantId,
        actorId,
        action: "booking_session.created",
        entityType: "BookingSession",
        entityId: session.id,
        metadata: { serviceId: service.id, startsAt: input.startsAt, capacity: input.capacity },
      },
    });
    return session;
  }, { isolationLevel: "Serializable" });
}

export async function cancelBookingSession(tenantId: string, sessionId: string, actorId: string) {
  const session = await platformDb.bookingSession.findFirst({
    where: { id: sessionId, tenantId, status: "SCHEDULED" },
    include: { bookings: { where: { status: { notIn: ["CANCELLED", "NO_SHOW"] } }, select: { id: true } } },
  });
  if (!session) throw new Error("Sesión inexistente");

  await platformDb.$transaction(async (tx) => {
    await tx.bookingSession.update({ where: { id: session.id }, data: { status: "CANCELLED", onlineEnabled: false } });
    if (session.bookings.length) {
      await tx.booking.updateMany({
        where: { id: { in: session.bookings.map((booking) => booking.id) } },
        data: {
          status: "CANCELLED",
          consumesCapacity: false,
          cancellationReason: "Sesión cancelada por el negocio",
          cancelledAt: new Date(),
        },
      });
    }
    await tx.auditLog.create({
      data: {
        scope: "TENANT",
        tenantId,
        actorId,
        action: "booking_session.cancelled",
        entityType: "BookingSession",
        entityId: session.id,
        metadata: { affectedBookings: session.bookings.length },
      },
    });
  });
}
