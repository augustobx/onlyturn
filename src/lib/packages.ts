import "server-only";

import { addDays } from "date-fns";
import type { Prisma } from "@prisma/client";
import { platformDb } from "./db";

export async function getPackageManagementData(tenantId: string) {
  return Promise.all([
    platformDb.servicePackage.findMany({
      where: { tenantId },
      include: { services: { include: { service: true } }, _count: { select: { customerPackages: true } } },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    platformDb.service.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true, category: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    platformDb.customer.findMany({ where: { tenantId, archivedAt: null }, select: { id: true, firstName: true, lastName: true, phone: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], take: 1000 }),
    platformDb.customerPackage.findMany({
      where: { tenantId, status: { in: ["ACTIVE", "EXHAUSTED"] } },
      include: { customer: true, package: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ] as const);
}

export async function getCustomerUsablePackages(tenantId: string, customerId: string) {
  const now = new Date();
  await platformDb.customerPackage.updateMany({
    where: { tenantId, customerId, status: "ACTIVE", expiresAt: { lt: now } },
    data: { status: "EXPIRED" },
  });
  return platformDb.customerPackage.findMany({
    where: { tenantId, customerId, status: "ACTIVE", remainingUses: { gt: 0 }, startsAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
    include: { package: { include: { services: { select: { serviceId: true } } } } },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
  });
}

export async function createServicePackage(tenantId: string, input: {
  name: string;
  description?: string;
  priceCents: number;
  uses: number;
  validityDays?: number;
  serviceIds: string[];
}, actorId: string) {
  const serviceIds = [...new Set(input.serviceIds)];
  if (!serviceIds.length) throw new Error("Seleccioná al menos un servicio");
  const validServices = await platformDb.service.findMany({ where: { tenantId, id: { in: serviceIds }, isActive: true }, select: { id: true } });
  if (validServices.length !== serviceIds.length) throw new Error("Hay servicios inválidos en el paquete");
  return platformDb.$transaction(async (tx) => {
    const packageRecord = await tx.servicePackage.create({
      data: {
        tenantId,
        name: input.name,
        description: input.description || null,
        priceCents: input.priceCents,
        uses: input.uses,
        validityDays: input.validityDays,
        services: { create: serviceIds.map((serviceId) => ({ tenantId, serviceId })) },
      },
    });
    await tx.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "service_package.created", entityType: "ServicePackage", entityId: packageRecord.id, metadata: { uses: input.uses, serviceIds } } });
    return packageRecord;
  });
}

export async function archiveServicePackage(tenantId: string, packageId: string, actorId: string) {
  const record = await platformDb.servicePackage.findFirst({ where: { id: packageId, tenantId, isActive: true }, select: { id: true } });
  if (!record) throw new Error("Paquete inexistente");
  await platformDb.$transaction([
    platformDb.servicePackage.update({ where: { id: record.id }, data: { isActive: false } }),
    platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "service_package.archived", entityType: "ServicePackage", entityId: record.id } }),
  ]);
}

export async function grantCustomerPackage(tenantId: string, packageId: string, customerId: string, actorId: string) {
  const [packageRecord, customer] = await Promise.all([
    platformDb.servicePackage.findFirst({ where: { id: packageId, tenantId, isActive: true } }),
    platformDb.customer.findFirst({ where: { id: customerId, tenantId, archivedAt: null }, select: { id: true } }),
  ]);
  if (!packageRecord || !customer) throw new Error("Paquete o cliente inválido");
  const startsAt = new Date();
  const expiresAt = packageRecord.validityDays ? addDays(startsAt, packageRecord.validityDays) : null;
  return platformDb.$transaction(async (tx) => {
    const membership = await tx.customerPackage.create({
      data: {
        tenantId,
        customerId,
        packageId: packageRecord.id,
        name: packageRecord.name,
        purchasedPriceCents: packageRecord.priceCents,
        totalUses: packageRecord.uses,
        remainingUses: packageRecord.uses,
        startsAt,
        expiresAt,
      },
    });
    await tx.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "customer_package.granted", entityType: "CustomerPackage", entityId: membership.id, metadata: { customerId, packageId, uses: packageRecord.uses, expiresAt } } });
    return membership;
  });
}

export async function cancelCustomerPackage(tenantId: string, customerPackageId: string, actorId: string) {
  const membership = await platformDb.customerPackage.findFirst({ where: { id: customerPackageId, tenantId, status: "ACTIVE" }, select: { id: true } });
  if (!membership) throw new Error("Membresía inexistente");
  await platformDb.$transaction([
    platformDb.customerPackage.update({ where: { id: membership.id }, data: { status: "CANCELLED" } }),
    platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "customer_package.cancelled", entityType: "CustomerPackage", entityId: membership.id } }),
  ]);
}

export async function consumeCustomerPackage(tx: Prisma.TransactionClient, input: {
  tenantId: string;
  customerId: string;
  customerPackageId: string;
  serviceId: string;
  bookingId: string;
  uses: number;
}) {
  const now = new Date();
  const membership = await tx.customerPackage.findFirst({
    where: {
      id: input.customerPackageId,
      tenantId: input.tenantId,
      customerId: input.customerId,
      status: "ACTIVE",
      remainingUses: { gte: input.uses },
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      package: { services: { some: { serviceId: input.serviceId } } },
    },
    select: { id: true },
  });
  if (!membership) throw new Error("El paquete elegido no está disponible para esta reserva");

  const consumed = await tx.customerPackage.updateMany({
    where: { id: membership.id, tenantId: input.tenantId, status: "ACTIVE", remainingUses: { gte: input.uses } },
    data: { remainingUses: { decrement: input.uses } },
  });
  if (consumed.count !== 1) throw new Error("Los usos del paquete cambiaron mientras reservabas. Volvé a intentar.");

  await tx.packageUsage.create({
    data: {
      tenantId: input.tenantId,
      customerPackageId: membership.id,
      bookingId: input.bookingId,
      uses: input.uses,
    },
  });

  const updated = await tx.customerPackage.findUniqueOrThrow({ where: { id: membership.id }, select: { remainingUses: true } });
  if (updated.remainingUses === 0) await tx.customerPackage.update({ where: { id: membership.id }, data: { status: "EXHAUSTED" } });
}

export async function restorePackageUsageForBooking(tx: Prisma.TransactionClient, tenantId: string, bookingId: string) {
  const usage = await tx.packageUsage.findFirst({
    where: { tenantId, bookingId },
    include: { customerPackage: { select: { id: true, status: true, expiresAt: true } } },
  });
  if (!usage) return false;

  await tx.packageUsage.delete({ where: { id: usage.id } });
  const expired = Boolean(usage.customerPackage.expiresAt && usage.customerPackage.expiresAt < new Date());
  const status = usage.customerPackage.status === "CANCELLED" ? "CANCELLED" : expired ? "EXPIRED" : "ACTIVE";
  await tx.customerPackage.update({
    where: { id: usage.customerPackage.id },
    data: { remainingUses: { increment: usage.uses }, status },
  });
  return true;
}
