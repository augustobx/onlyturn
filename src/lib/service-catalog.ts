import "server-only";
import type { AssignmentStrategy, BookingType, RequirementMode } from "@prisma/client";
import { platformDb } from "./db";

export type UniversalServiceInput = {
  name: string;
  description?: string;
  category?: string;
  bookingType: BookingType;
  assignmentStrategy: AssignmentStrategy;
  durationMinutes: number;
  preparationMinutes: number;
  bufferMinutes: number;
  priceCents?: number;
  color: string;
  minPartySize: number;
  maxPartySize: number;
  professionalMode: RequirementMode;
  resourceMode: RequirementMode;
  allowWaitlist: boolean;
  allowRecurring: boolean;
  onlineEnabled: boolean;
  locationId: string;
  professionalIds: string[];
  resourceIds: string[];
};

async function validateAssignments(
  tenantId: string,
  input: Pick<UniversalServiceInput, "locationId" | "professionalIds" | "resourceIds" | "professionalMode" | "resourceMode" | "bookingType" | "minPartySize" | "maxPartySize">,
) {
  const [location, professionals, resources] = await Promise.all([
    platformDb.location.findFirst({ where: { id: input.locationId, tenantId, isActive: true }, select: { id: true } }),
    input.professionalIds.length
      ? platformDb.professional.findMany({ where: { id: { in: input.professionalIds }, tenantId, isActive: true }, select: { id: true } })
      : Promise.resolve([]),
    input.resourceIds.length
      ? platformDb.resource.findMany({ where: { id: { in: input.resourceIds }, tenantId, isActive: true }, select: { id: true } })
      : Promise.resolve([]),
  ]);

  if (!location) throw new Error("Sucursal inválida");
  if (professionals.length !== input.professionalIds.length) throw new Error("Hay profesionales que no pertenecen a este tenant");
  if (resources.length !== input.resourceIds.length) throw new Error("Hay recursos que no pertenecen a este tenant");
  if (input.professionalMode === "REQUIRED" && !input.professionalIds.length) throw new Error("Seleccioná al menos un profesional para un servicio que lo requiere");
  if (input.resourceMode === "REQUIRED" && !input.resourceIds.length) throw new Error("Seleccioná al menos un recurso para un servicio que lo requiere");
  if (input.bookingType === "RESOURCE" && input.resourceMode === "NONE") throw new Error("Una reserva de recurso necesita al menos un recurso habilitado");
  if (input.minPartySize < 1 || input.maxPartySize < input.minPartySize) throw new Error("La cantidad de asistentes es inválida");
  if (["APPOINTMENT", "RESOURCE"].includes(input.bookingType) && input.maxPartySize > 100) throw new Error("La cantidad máxima de asistentes es demasiado alta para este tipo de reserva");
}

function normalizedAssignments(input: UniversalServiceInput) {
  return {
    professionalIds: input.professionalMode === "NONE" ? [] : [...new Set(input.professionalIds)],
    resourceIds: input.resourceMode === "NONE" ? [] : [...new Set(input.resourceIds)],
  };
}

export async function getUniversalServiceCatalog(tenantId: string) {
  return Promise.all([
    platformDb.location.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }),
    platformDb.service.findMany({
      where: { tenantId, isActive: true },
      include: {
        locations: { include: { location: true } },
        professionals: { include: { professional: true } },
        resources: { include: { resource: true } },
        _count: { select: { bookings: true, customFields: true, bookingSessions: true, waitlistEntries: true } },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    platformDb.professional.findMany({ where: { tenantId, isActive: true }, include: { location: true }, orderBy: { name: "asc" } }),
    platformDb.resource.findMany({ where: { tenantId, isActive: true }, include: { location: true }, orderBy: { name: "asc" } }),
  ] as const);
}

export async function createUniversalService(tenantId: string, input: UniversalServiceInput, actorId: string) {
  const assignments = normalizedAssignments(input);
  const normalized = { ...input, ...assignments };
  await validateAssignments(tenantId, normalized);

  return platformDb.$transaction(async (tx) => {
    const service = await tx.service.create({
      data: {
        tenantId,
        name: normalized.name,
        description: normalized.description || null,
        category: normalized.category || null,
        bookingType: normalized.bookingType,
        assignmentStrategy: normalized.assignmentStrategy,
        durationMinutes: normalized.durationMinutes,
        preparationMinutes: normalized.preparationMinutes,
        bufferMinutes: normalized.bufferMinutes,
        priceCents: normalized.priceCents,
        color: normalized.color,
        capacity: normalized.maxPartySize,
        minPartySize: normalized.minPartySize,
        maxPartySize: normalized.maxPartySize,
        professionalMode: normalized.professionalMode,
        resourceMode: normalized.resourceMode,
        allowWaitlist: normalized.allowWaitlist,
        allowRecurring: normalized.allowRecurring,
        onlineEnabled: normalized.onlineEnabled,
        locations: { create: { tenantId, locationId: normalized.locationId } },
        ...(normalized.professionalIds.length
          ? { professionals: { create: normalized.professionalIds.map((professionalId) => ({ tenantId, professionalId })) } }
          : {}),
        ...(normalized.resourceIds.length
          ? { resources: { create: normalized.resourceIds.map((resourceId) => ({ tenantId, resourceId })) } }
          : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        scope: "TENANT",
        tenantId,
        actorId,
        action: "service.created",
        entityType: "Service",
        entityId: service.id,
        metadata: {
          category: normalized.category || null,
          bookingType: normalized.bookingType,
          assignmentStrategy: normalized.assignmentStrategy,
          durationMinutes: normalized.durationMinutes,
          professionalMode: normalized.professionalMode,
          resourceMode: normalized.resourceMode,
          maxPartySize: normalized.maxPartySize,
          onlineEnabled: normalized.onlineEnabled,
        },
      },
    });
    return service;
  });
}

export async function updateUniversalService(tenantId: string, serviceId: string, input: UniversalServiceInput, actorId: string) {
  const assignments = normalizedAssignments(input);
  const normalized = { ...input, ...assignments };
  await validateAssignments(tenantId, normalized);
  const existing = await platformDb.service.findFirst({ where: { id: serviceId, tenantId, isActive: true }, select: { id: true } });
  if (!existing) throw new Error("Servicio inexistente");

  return platformDb.$transaction(async (tx) => {
    await Promise.all([
      tx.serviceLocation.deleteMany({ where: { tenantId, serviceId } }),
      tx.serviceProfessional.deleteMany({ where: { tenantId, serviceId } }),
      tx.serviceResource.deleteMany({ where: { tenantId, serviceId } }),
    ]);

    const service = await tx.service.update({
      where: { id: serviceId },
      data: {
        name: normalized.name,
        description: normalized.description || null,
        category: normalized.category || null,
        bookingType: normalized.bookingType,
        assignmentStrategy: normalized.assignmentStrategy,
        durationMinutes: normalized.durationMinutes,
        preparationMinutes: normalized.preparationMinutes,
        bufferMinutes: normalized.bufferMinutes,
        priceCents: normalized.priceCents,
        color: normalized.color,
        capacity: normalized.maxPartySize,
        minPartySize: normalized.minPartySize,
        maxPartySize: normalized.maxPartySize,
        professionalMode: normalized.professionalMode,
        resourceMode: normalized.resourceMode,
        allowWaitlist: normalized.allowWaitlist,
        allowRecurring: normalized.allowRecurring,
        onlineEnabled: normalized.onlineEnabled,
        locations: { create: { tenantId, locationId: normalized.locationId } },
        ...(normalized.professionalIds.length
          ? { professionals: { create: normalized.professionalIds.map((professionalId) => ({ tenantId, professionalId })) } }
          : {}),
        ...(normalized.resourceIds.length
          ? { resources: { create: normalized.resourceIds.map((resourceId) => ({ tenantId, resourceId })) } }
          : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        scope: "TENANT",
        tenantId,
        actorId,
        action: "service.updated",
        entityType: "Service",
        entityId: service.id,
        metadata: { bookingType: normalized.bookingType, assignmentStrategy: normalized.assignmentStrategy },
      },
    });
    return service;
  });
}

export async function archiveUniversalService(tenantId: string, serviceId: string, actorId: string) {
  const service = await platformDb.service.findFirst({ where: { id: serviceId, tenantId, isActive: true }, select: { id: true, name: true } });
  if (!service) throw new Error("Servicio inexistente");
  const [futureBookings, futureSessions] = await Promise.all([
    platformDb.booking.count({
      where: {
        tenantId,
        serviceId,
        startsAt: { gte: new Date() },
        status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
      },
    }),
    platformDb.bookingSession.count({ where: { tenantId, serviceId, startsAt: { gte: new Date() }, status: "SCHEDULED" } }),
  ]);
  if (futureBookings || futureSessions) throw new Error(`No podés archivar este servicio porque tiene actividad futura (${futureBookings} reserva(s), ${futureSessions} sesión(es))`);

  await platformDb.$transaction([
    platformDb.service.update({ where: { id: serviceId }, data: { isActive: false, onlineEnabled: false } }),
    platformDb.auditLog.create({
      data: {
        scope: "TENANT",
        tenantId,
        actorId,
        action: "service.archived",
        entityType: "Service",
        entityId: service.id,
        metadata: { name: service.name },
      },
    }),
  ]);
}
