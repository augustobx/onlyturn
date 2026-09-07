import "server-only";

import type { CustomFieldType, MediaAssetKind, Prisma } from "@prisma/client";
import { platformDb } from "./db";

export async function getSettingsManagementData(tenantId: string) {
  return Promise.all([
    platformDb.customField.findMany({
      where: { tenantId },
      include: { service: { select: { name: true } } },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { label: "asc" }],
    }),
    platformDb.availabilityException.findMany({
      where: { tenantId, endsAt: { gte: new Date() } },
      include: { location: true, professional: true, resource: true },
      orderBy: { startsAt: "asc" },
      take: 100,
    }),
    platformDb.mediaAsset.findMany({ where: { tenantId }, orderBy: [{ archivedAt: "asc" }, { createdAt: "desc" }], take: 100 }),
    platformDb.announcement.findMany({ where: { tenantId }, orderBy: [{ isActive: "desc" }, { startsAt: "desc" }], take: 100 }),
    platformDb.customDomain.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
  ] as const);
}

export async function updateCustomField(
  tenantId: string,
  fieldId: string,
  data: { serviceId?: string; label: string; type: CustomFieldType; required: boolean; appliesToCustomer: boolean; options?: Prisma.InputJsonValue },
  actorId: string,
) {
  const current = await platformDb.customField.findFirst({ where: { id: fieldId, tenantId } });
  if (!current) throw new Error("Campo personalizado inexistente");
  if (data.serviceId && !await platformDb.service.findFirst({ where: { id: data.serviceId, tenantId, isActive: true } })) throw new Error("Servicio inválido");
  const updated = await platformDb.customField.update({
    where: { id: current.id },
    data: { serviceId: data.serviceId || null, label: data.label, type: data.type, required: data.required, appliesToCustomer: data.appliesToCustomer, options: data.options ?? [] },
  });
  await platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "custom_field.updated", entityType: "CustomField", entityId: current.id } });
  return updated;
}

export async function setCustomFieldActive(tenantId: string, fieldId: string, isActive: boolean, actorId: string) {
  const current = await platformDb.customField.findFirst({ where: { id: fieldId, tenantId } });
  if (!current) throw new Error("Campo personalizado inexistente");
  const updated = await platformDb.customField.update({ where: { id: current.id }, data: { isActive } });
  await platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: isActive ? "custom_field.reactivated" : "custom_field.archived", entityType: "CustomField", entityId: current.id } });
  return updated;
}

export async function cancelAvailabilityException(tenantId: string, exceptionId: string, actorId: string) {
  const current = await platformDb.availabilityException.findFirst({ where: { id: exceptionId, tenantId } });
  if (!current) throw new Error("Bloqueo inexistente");
  await platformDb.$transaction([
    platformDb.availabilityException.delete({ where: { id: current.id } }),
    platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "availability.exception_cancelled", entityType: "AvailabilityException", entityId: current.id, metadata: { startsAt: current.startsAt.toISOString(), endsAt: current.endsAt.toISOString(), reason: current.reason } } }),
  ]);
}

export async function updateAnnouncement(
  tenantId: string,
  announcementId: string,
  data: { title: string; body: string; startsAt: Date; endsAt?: Date; style: string },
  actorId: string,
) {
  const current = await platformDb.announcement.findFirst({ where: { id: announcementId, tenantId } });
  if (!current) throw new Error("Anuncio inexistente");
  if (data.endsAt && data.endsAt <= data.startsAt) throw new Error("La fecha de fin debe ser posterior al inicio");
  const updated = await platformDb.announcement.update({ where: { id: current.id }, data: { title: data.title, body: data.body, startsAt: data.startsAt, endsAt: data.endsAt || null, style: data.style } });
  await platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "announcement.updated", entityType: "Announcement", entityId: current.id } });
  return updated;
}

export async function setAnnouncementActive(tenantId: string, announcementId: string, isActive: boolean, actorId: string) {
  const current = await platformDb.announcement.findFirst({ where: { id: announcementId, tenantId } });
  if (!current) throw new Error("Anuncio inexistente");
  const updated = await platformDb.announcement.update({ where: { id: current.id }, data: { isActive } });
  await platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: isActive ? "announcement.reactivated" : "announcement.archived", entityType: "Announcement", entityId: current.id } });
  return updated;
}

export async function updateMediaAssetAltText(tenantId: string, assetId: string, altText: string | undefined, actorId: string) {
  const current = await platformDb.mediaAsset.findFirst({ where: { id: assetId, tenantId } });
  if (!current) throw new Error("Imagen inexistente");
  const updated = await platformDb.mediaAsset.update({ where: { id: current.id }, data: { altText: altText || null } });
  await platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "media.updated", entityType: "MediaAsset", entityId: current.id } });
  return updated;
}

export async function setMediaAssetActive(tenantId: string, assetId: string, isActive: boolean, actorId: string) {
  const current = await platformDb.mediaAsset.findFirst({ where: { id: assetId, tenantId } });
  if (!current) throw new Error("Imagen inexistente");
  const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { branding: true } });
  const branding = { ...(tenant.branding as Record<string, unknown>) };
  const brandingKey = current.kind === "GALLERY" ? null : `${current.kind.toLowerCase()}Url`;
  if (!isActive && brandingKey && branding[brandingKey] === current.publicUrl) delete branding[brandingKey];
  if (isActive && brandingKey) branding[brandingKey] = current.publicUrl;

  const updated = await platformDb.$transaction(async (tx) => {
    const asset = await tx.mediaAsset.update({ where: { id: current.id }, data: { archivedAt: isActive ? null : new Date() } });
    if (brandingKey) await tx.tenant.update({ where: { id: tenantId }, data: { branding: branding as Prisma.InputJsonObject } });
    await tx.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: isActive ? "media.reactivated" : "media.archived", entityType: "MediaAsset", entityId: current.id, metadata: { kind: current.kind as MediaAssetKind } } });
    return asset;
  });
  return updated;
}

export async function disconnectPaymentProvider(tenantId: string, actorId: string) {
  const connection = await platformDb.paymentProviderConnection.findUnique({ where: { tenantId_provider: { tenantId, provider: "MERCADOPAGO" } } });
  if (!connection) return;
  const pending = await platformDb.paymentTransaction.count({ where: { tenantId, status: { in: ["PENDING", "AUTHORIZED"] } } });
  if (pending) throw new Error(`No podés desconectar Mercado Pago mientras haya ${pending} cobro(s) pendiente(s) o autorizado(s)`);
  await platformDb.$transaction([
    platformDb.paymentProviderConnection.delete({ where: { id: connection.id } }),
    platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "payment_provider.disconnected", entityType: "PaymentProviderConnection", entityId: connection.id, metadata: { provider: "MERCADOPAGO" } } }),
  ]);
}
