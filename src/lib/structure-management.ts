import "server-only";

import { platformDb } from "./db";

const now = () => new Date();
const activeBookingFilter = { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] as const };

export async function getStructureManagementData(tenantId: string) {
  const [locations, professionals, resources] = await Promise.all([
    platformDb.location.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: {
            serviceLocations: true,
            professionals: true,
            resources: true,
            bookings: true,
            bookingSessions: true,
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    platformDb.professional.findMany({
      where: { tenantId },
      include: {
        location: true,
        _count: { select: { services: true, bookings: true, bookingSessions: true } },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    platformDb.resource.findMany({
      where: { tenantId },
      include: {
        location: true,
        _count: { select: { services: true, bookings: true, bookingSessions: true } },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
  ]);
  return { locations, professionals, resources };
}

export async function updateLocation(
  tenantId: string,
  locationId: string,
  data: { name: string; address?: string },
  actorId: string,
) {
  const current = await platformDb.location.findFirst({ where: { id: locationId, tenantId } });
  if (!current) throw new Error("Sede inexistente");
  const updated = await platformDb.location.update({
    where: { id: current.id },
    data: { name: data.name, address: data.address || null },
  });
  await platformDb.auditLog.create({
    data: {
      scope: "TENANT",
      tenantId,
      actorId,
      action: "location.updated",
      entityType: "Location",
      entityId: current.id,
      metadata: { from: { name: current.name, address: current.address }, to: { name: updated.name, address: updated.address } },
    },
  });
  return updated;
}

export async function setLocationActive(tenantId: string, locationId: string, isActive: boolean, actorId: string) {
  const current = await platformDb.location.findFirst({ where: { id: locationId, tenantId } });
  if (!current) throw new Error("Sede inexistente");
  if (current.isActive === isActive) return current;

  if (!isActive) {
    const [futureBookings, futureSessions, activeLocations] = await Promise.all([
      platformDb.booking.count({ where: { tenantId, locationId, startsAt: { gte: now() }, status: activeBookingFilter } }),
      platformDb.bookingSession.count({ where: { tenantId, locationId, startsAt: { gte: now() }, status: "SCHEDULED" } }),
      platformDb.location.count({ where: { tenantId, isActive: true } }),
    ]);
    if (futureBookings || futureSessions) {
      throw new Error(`No podés desactivar esta sede: tiene ${futureBookings} reserva(s) y ${futureSessions} sesión(es) futuras. Cancelalas o reasignalas primero.`);
    }
    const activeServices = await platformDb.service.count({ where: { tenantId, isActive: true } });
    if (activeLocations <= 1 && activeServices > 0) throw new Error("No podés desactivar la única sede activa mientras existan servicios activos");
  }

  const updated = await platformDb.location.update({ where: { id: current.id }, data: { isActive } });
  await platformDb.auditLog.create({
    data: {
      scope: "TENANT",
      tenantId,
      actorId,
      action: isActive ? "location.reactivated" : "location.archived",
      entityType: "Location",
      entityId: current.id,
      metadata: { name: current.name },
    },
  });
  return updated;
}

export async function updateProfessional(
  tenantId: string,
  professionalId: string,
  data: { name: string; locationId?: string; color: string },
  actorId: string,
) {
  const current = await platformDb.professional.findFirst({ where: { id: professionalId, tenantId } });
  if (!current) throw new Error("Profesional inexistente");
  if (data.locationId && !await platformDb.location.findFirst({ where: { id: data.locationId, tenantId, isActive: true } })) {
    throw new Error("La sede seleccionada no es válida");
  }
  const updated = await platformDb.professional.update({
    where: { id: current.id },
    data: { name: data.name, locationId: data.locationId || null, color: data.color },
  });
  await platformDb.auditLog.create({
    data: {
      scope: "TENANT",
      tenantId,
      actorId,
      action: "professional.updated",
      entityType: "Professional",
      entityId: current.id,
      metadata: { from: { name: current.name, locationId: current.locationId }, to: { name: updated.name, locationId: updated.locationId } },
    },
  });
  return updated;
}

export async function setProfessionalActive(tenantId: string, professionalId: string, isActive: boolean, actorId: string) {
  const current = await platformDb.professional.findFirst({ where: { id: professionalId, tenantId } });
  if (!current) throw new Error("Profesional inexistente");
  if (current.isActive === isActive) return current;

  if (!isActive) {
    const [futureBookings, futureSessions] = await Promise.all([
      platformDb.booking.count({ where: { tenantId, professionalId, startsAt: { gte: now() }, status: activeBookingFilter } }),
      platformDb.bookingSession.count({ where: { tenantId, professionalId, startsAt: { gte: now() }, status: "SCHEDULED" } }),
    ]);
    if (futureBookings || futureSessions) {
      throw new Error(`No podés desactivar este profesional: tiene ${futureBookings} reserva(s) y ${futureSessions} sesión(es) futuras.`);
    }
  }

  const updated = await platformDb.professional.update({ where: { id: current.id }, data: { isActive } });
  await platformDb.auditLog.create({
    data: {
      scope: "TENANT",
      tenantId,
      actorId,
      action: isActive ? "professional.reactivated" : "professional.archived",
      entityType: "Professional",
      entityId: current.id,
      metadata: { name: current.name },
    },
  });
  return updated;
}

export async function updateResource(
  tenantId: string,
  resourceId: string,
  data: { name: string; locationId?: string; type?: string; capacity: number; color: string },
  actorId: string,
) {
  const current = await platformDb.resource.findFirst({ where: { id: resourceId, tenantId } });
  if (!current) throw new Error("Recurso inexistente");
  if (data.locationId && !await platformDb.location.findFirst({ where: { id: data.locationId, tenantId, isActive: true } })) {
    throw new Error("La sede seleccionada no es válida");
  }
  const updated = await platformDb.resource.update({
    where: { id: current.id },
    data: { name: data.name, locationId: data.locationId || null, type: data.type || null, capacity: data.capacity, color: data.color },
  });
  await platformDb.auditLog.create({
    data: {
      scope: "TENANT",
      tenantId,
      actorId,
      action: "resource.updated",
      entityType: "Resource",
      entityId: current.id,
      metadata: { from: { name: current.name, locationId: current.locationId, capacity: current.capacity }, to: { name: updated.name, locationId: updated.locationId, capacity: updated.capacity } },
    },
  });
  return updated;
}

export async function setResourceActive(tenantId: string, resourceId: string, isActive: boolean, actorId: string) {
  const current = await platformDb.resource.findFirst({ where: { id: resourceId, tenantId } });
  if (!current) throw new Error("Recurso inexistente");
  if (current.isActive === isActive) return current;

  if (!isActive) {
    const [futureBookings, futureSessions] = await Promise.all([
      platformDb.booking.count({ where: { tenantId, resourceId, startsAt: { gte: now() }, status: activeBookingFilter } }),
      platformDb.bookingSession.count({ where: { tenantId, resourceId, startsAt: { gte: now() }, status: "SCHEDULED" } }),
    ]);
    if (futureBookings || futureSessions) {
      throw new Error(`No podés desactivar este recurso: tiene ${futureBookings} reserva(s) y ${futureSessions} sesión(es) futuras.`);
    }
  }

  const updated = await platformDb.resource.update({ where: { id: current.id }, data: { isActive } });
  await platformDb.auditLog.create({
    data: {
      scope: "TENANT",
      tenantId,
      actorId,
      action: isActive ? "resource.reactivated" : "resource.archived",
      entityType: "Resource",
      entityId: current.id,
      metadata: { name: current.name },
    },
  });
  return updated;
}
