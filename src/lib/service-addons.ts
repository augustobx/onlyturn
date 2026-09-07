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

export async function getServiceAddonManagementData(tenantId: string) {
  return Promise.all([
    platformDb.service.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, bookingType: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    platformDb.serviceAddon.findMany({
      where: { tenantId, isActive: true },
      include: { service: { select: { id: true, name: true, bookingType: true } } },
      orderBy: [{ service: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    }),
  ] as const);
}

export async function createServiceAddon(tenantId: string, input: ServiceAddonInput, actorId: string) {
  const service = await platformDb.service.findFirst({
    where: { id: input.serviceId, tenantId, isActive: true },
    select: { id: true, bookingType: true },
  });
  if (!service) throw new Error("Servicio inexistente");
  if ((service.bookingType === "CLASS" || service.bookingType === "EVENT") && (input.durationMinutes || input.preparationMinutes)) {
    throw new Error("En clases y eventos los extras pueden sumar precio, pero no modificar la duración de una sesión ya programada");
  }

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
      data: {
        scope: "TENANT",
        tenantId,
        actorId,
        action: "service_addon.created",
        entityType: "ServiceAddon",
        entityId: addon.id,
        metadata: { serviceId: service.id, priceCents: input.priceCents, durationMinutes: input.durationMinutes },
      },
    });
    return addon;
  });
}

export async function archiveServiceAddon(tenantId: string, addonId: string, actorId: string) {
  const addon = await platformDb.serviceAddon.findFirst({ where: { id: addonId, tenantId, isActive: true } });
  if (!addon) throw new Error("Extra inexistente");
  await platformDb.$transaction([
    platformDb.serviceAddon.update({ where: { id: addon.id }, data: { isActive: false } }),
    platformDb.auditLog.create({
      data: {
        scope: "TENANT",
        tenantId,
        actorId,
        action: "service_addon.archived",
        entityType: "ServiceAddon",
        entityId: addon.id,
        metadata: { serviceId: addon.serviceId, name: addon.name },
      },
    }),
  ]);
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
