import "server-only";

import { z } from "zod";
import { platformDb } from "./db";
import { getPublicTenant } from "./booking-service";
import { normalizeEmail, normalizePhone } from "./security";

export const publicWaitlistSchema = z.object({
  tenantSlug: z.string().min(1),
  locationId: z.string().min(1),
  serviceId: z.string().min(1),
  professionalId: z.string().optional(),
  resourceId: z.string().optional(),
  sessionId: z.string().optional(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  partySize: z.coerce.number().int().min(1).max(1000).default(1),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().max(80).optional(),
  phone: z.string().min(6).max(30),
  email: z.union([z.email(), z.literal("")]).optional(),
});

export async function createPublicWaitlistEntry(raw: unknown) {
  const input = publicWaitlistSchema.parse(raw);
  const tenant = await getPublicTenant(input.tenantSlug);
  if (!tenant) throw new Error("Agenda no disponible");

  const service = await platformDb.service.findFirst({
    where: { id: input.serviceId, tenantId: tenant.id, isActive: true, onlineEnabled: true, allowWaitlist: true },
    include: {
      locations: { select: { locationId: true } },
      professionals: { select: { professionalId: true } },
      resources: { select: { resourceId: true } },
    },
  });
  if (!service) throw new Error("La lista de espera no está habilitada para esta opción");
  if (!service.locations.some((item) => item.locationId === input.locationId)) throw new Error("Sede inválida");
  if (input.professionalId && !service.professionals.some((item) => item.professionalId === input.professionalId)) throw new Error("Profesional inválido");
  if (input.resourceId && !service.resources.some((item) => item.resourceId === input.resourceId)) throw new Error("Recurso inválido");
  if (input.partySize < service.minPartySize || input.partySize > service.maxPartySize) throw new Error("Cantidad de asistentes inválida");

  let sessionId: string | undefined;
  if (input.sessionId) {
    const session = await platformDb.bookingSession.findFirst({
      where: { id: input.sessionId, tenantId: tenant.id, serviceId: service.id, locationId: input.locationId, status: "SCHEDULED" },
      select: { id: true },
    });
    if (!session) throw new Error("Sesión inválida");
    sessionId = session.id;
  }

  const normalizedPhone = normalizePhone(input.phone);
  const customer = await platformDb.customer.upsert({
    where: { tenantId_normalizedPhone: { tenantId: tenant.id, normalizedPhone } },
    create: {
      tenantId: tenant.id,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      normalizedPhone,
      email: input.email || null,
      normalizedEmail: normalizeEmail(input.email),
    },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email || null,
      normalizedEmail: normalizeEmail(input.email),
    },
  });

  const duplicate = await platformDb.waitlistEntry.findFirst({
    where: {
      tenantId: tenant.id,
      customerId: customer.id,
      serviceId: service.id,
      locationId: input.locationId,
      sessionId: sessionId ?? null,
      status: { in: ["WAITING", "OFFERED"] },
      ...(input.preferredDate ? { preferences: { path: ["preferredDate"], equals: input.preferredDate } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) return duplicate;

  return platformDb.waitlistEntry.create({
    data: {
      tenantId: tenant.id,
      customerId: customer.id,
      serviceId: service.id,
      locationId: input.locationId,
      professionalId: input.professionalId || null,
      resourceId: input.resourceId || null,
      sessionId: sessionId || null,
      partySize: input.partySize,
      preferences: { preferredDate: input.preferredDate || null },
    },
  });
}

export async function getWaitlistManagementData(tenantId: string) {
  return platformDb.waitlistEntry.findMany({
    where: { tenantId, status: { in: ["WAITING", "OFFERED"] } },
    include: {
      customer: true,
      service: true,
      location: true,
      professional: true,
      resource: true,
      session: true,
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 300,
  });
}

export async function cancelWaitlistEntry(tenantId: string, entryId: string, actorId: string) {
  const entry = await platformDb.waitlistEntry.findFirst({ where: { id: entryId, tenantId, status: { in: ["WAITING", "OFFERED"] } } });
  if (!entry) throw new Error("Entrada inexistente");

  await platformDb.$transaction([
    platformDb.waitlistEntry.update({ where: { id: entry.id }, data: { status: "CANCELLED" } }),
    platformDb.auditLog.create({
      data: {
        scope: "TENANT",
        tenantId,
        actorId,
        action: "waitlist.cancelled",
        entityType: "WaitlistEntry",
        entityId: entry.id,
      },
    }),
  ]);
}
