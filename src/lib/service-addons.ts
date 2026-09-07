import "server-only";

import { platformDb } from "./db";

export type ServiceAddonInput = {
  serviceId: string;
  name: string;
  description?: string;
  priceCents: number;
  durationMinutes: number;
  preparationMinutes: number;
};

async function validateAddonInput(tenantId: string, input: ServiceAddonInput) {
  const service = await platformDb.service.findFirst({
    where: { id: input.serviceId, tenantId, isActive: true },
    select: { id: true, bookingType: true },
  });
  if (!service) throw new Error("Servicio inexistente");
  if ((service.bookingType === "CLASS" || service.bookingType === "EVENT") && (input.durationMinutes || input.preparationMinutes)) {
    throw new Error("En clases y eventos los extras pueden sumar precio, pero no modificar la duración de una sesión ya programada");
  }
  return service;
}

export async function getServiceAddonManagementData(tenantId: string) {
  return Promise.all([
    platformDb.service.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, bookingType: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    platformDb.serviceAddon.findMany({
      where: { tenantId },
      include: { service: { select: { id: true, name: true, bookingType: true } } },
      orderBy: [{ isActive: "desc" }, { service: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    }),
  ] as const);
}

export async function createServiceAddon(tenantId: string, input: ServiceAddonInput, actorId: string) {
  const service = await validateAddonInput(tenantId, input);
  return platformDb.$transaction(async (tx) => {
    const maxSort = await tx.serviceAddon.aggregate({ where: { tenantId, serviceId: service.id }, _max: { sortOrder: true } });
    const addon = await tx.serviceAddon.create({
      data: {
        tenantId,
        serviceId: service.id,
        name: input.name,
        description: input.description || null,
        priceCents: input.priceCents,
        durationMinutes: input.durationMinutes,
        preparationMinutes: input.preparationMinutes,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
    await tx.auditLog.create({
      data: { scope: "TENANT", tenantId, actorId, action: "service_addon.created", entityType: "ServiceAddon", entityId: addon.id, metadata: { serviceId: service.id, priceCents: input.priceCents, durationMinutes: input.durationMinutes } },
    });
    return addon;
  });
}

export async function updateServiceAddon(tenantId: string, addonId: string, input: ServiceAddonInput, actorId: string) {
  await validateAddonInput(tenantId, input);
  const current = await platformDb.serviceAddon.findFirst({ where: { id: addonId, tenantId } });
  if (!current) throw new Error("Extra inexistente");
  const updated = await platformDb.serviceAddon.update({
    where: { id: current.id },
    data: {
      serviceId: input.serviceId,
      name: input.name,
      description: input.description || null,
      priceCents: input.priceCents,
      durationMinutes: input.durationMinutes,
      preparationMinutes: input.preparationMinutes,
    },
  });
  await platformDb.auditLog.create({
    data: { scope: "TENANT", tenantId, actorId, action: "service_addon.updated", entityType: "ServiceAddon", entityId: current.id, metadata: { serviceId: input.serviceId, priceCents: input.priceCents } },
  });
  return updated;
}

export async function setServiceAddonActive(tenantId: string, addonId: string, isActive: boolean, actorId: string) {
  const addon = await platformDb.serviceAddon.findFirst({ where: { id: addonId, tenantId } });
  if (!addon) throw new Error("Extra inexistente");
  if (isActive && !await platformDb.service.findFirst({ where: { id: addon.serviceId, tenantId, isActive: true } })) {
    throw new Error("Reactivá primero el servicio asociado a este extra");
  }
  const updated = await platformDb.serviceAddon.update({ where: { id: addon.id }, data: { isActive } });
  await platformDb.auditLog.create({
    data: { scope: "TENANT", tenantId, actorId, action: isActive ? "service_addon.reactivated" : "service_addon.archived", entityType: "ServiceAddon", entityId: addon.id, metadata: { serviceId: addon.serviceId, name: addon.name } },
  });
  return updated;
}

export async function archiveServiceAddon(tenantId: string, addonId: string, actorId: string) {
  return setServiceAddonActive(tenantId, addonId, false, actorId);
}

export async function resolveServiceAddons(tenantId: string, serviceId: string, addonIds: string[]) {
  const uniqueIds = [...new Set(addonIds.filter(Boolean))];
  if (!uniqueIds.length) return [];
  const addons = await platformDb.serviceAddon.findMany({
    where: { tenantId, serviceId, id: { in: uniqueIds }, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (addons.length !== uniqueIds.length) throw new Error("Uno de los extras seleccionados ya no está disponible");
  return addons;
}
