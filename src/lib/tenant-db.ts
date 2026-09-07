import "server-only";
import type { BookingStatus, CustomerAccountStatus, LedgerEntryType, MediaAssetKind, Prisma } from "@prisma/client";
import { platformDb } from "./db";

/**
 * Closed tenant repository. Callers cannot access an unscoped Prisma model.
 * IDs used in relations are always revalidated inside the same tenant.
 */
export function createTenantDb(tenantId: string) {
  if (!tenantId) throw new Error("Tenant context is required");
  return {
    dashboard: async (from: Date, to: Date) => {
      const [bookings, customers] = await platformDb.$transaction([
        platformDb.booking.findMany({
          where: { tenantId, startsAt: { gte: from, lt: to } },
          include: { customer: true, service: true, professional: true, resource: true },
          orderBy: { startsAt: "asc" }
        }),
        platformDb.customer.count({ where: { tenantId, createdAt: { gte: from, lt: to } } })
      ]);
      return { bookings, newCustomers: customers };
    },
    agenda: (from: Date, to: Date, filters?: { locationId?: string; serviceId?: string; professionalId?: string; resourceId?: string; status?: BookingStatus }) => platformDb.booking.findMany({
      where: { tenantId, startsAt: { gte: from, lt: to }, ...filters },
      include: { customer: true, service: true, professional: true, resource: true, location: true },
      orderBy: { startsAt: "asc" }, take: 500
    }),
    catalog: () => Promise.all([
      platformDb.location.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }),
      platformDb.service.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }),
      platformDb.professional.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }),
      platformDb.resource.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } })
    ]),
    settingsData: () => Promise.all([
      platformDb.customField.findMany({ where: { tenantId, isActive: true }, include: { service: { select: { name: true } } }, orderBy: { sortOrder: "asc" } }),
      platformDb.availabilityException.findMany({ where: { tenantId, endsAt: { gte: new Date() } }, include: { location: true, professional: true, resource: true }, orderBy: { startsAt: "asc" }, take: 50 }),
      platformDb.mediaAsset.findMany({ where: { tenantId, archivedAt: null }, orderBy: { createdAt: "desc" }, take: 30 }),
      platformDb.announcement.findMany({ where: { tenantId, isActive: true }, orderBy: { startsAt: "desc" }, take: 20 }),
      platformDb.customDomain.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } })
    ]),
    createCustomDomain: async (hostname: string, actorId: string) => {
      const domain = await platformDb.customDomain.create({ data: { tenantId, hostname, verifiedAt: new Date() } });
      await platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "custom_domain.created", entityType: "CustomDomain", entityId: domain.id, metadata: { hostname } } });
      return domain;
    },
    deleteCustomDomain: async (id: string, actorId: string) => {
      const domain = await platformDb.customDomain.findFirstOrThrow({ where: { id, tenantId } });
      await platformDb.customDomain.delete({ where: { id: domain.id } });
      await platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "custom_domain.deleted", entityType: "CustomDomain", entityId: domain.id, metadata: { hostname: domain.hostname } } });
      return domain;
    },
    paymentData: () => Promise.all([
      platformDb.paymentProviderConnection.findUnique({ where: { tenantId_provider: { tenantId, provider: "MERCADOPAGO" } }, select: { id: true, provider: true, status: true, displayName: true, updatedAt: true } }),
      platformDb.paymentTransaction.findMany({ where: { tenantId }, include: { booking: { include: { customer: true, service: true } } }, orderBy: { createdAt: "desc" }, take: 30 })
    ]),
    updateSettings: async (data: { settings: Prisma.InputJsonObject; branding: Prisma.InputJsonObject }, actorId: string) => platformDb.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({ where: { id: tenantId }, data });
      await tx.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "tenant.settings_updated", entityType: "Tenant", entityId: tenantId } });
      return tenant;
    }),
    createCustomField: async (data: { serviceId?: string; key: string; label: string; type: Prisma.CustomFieldCreateInput["type"]; required: boolean; appliesToCustomer: boolean; options?: Prisma.InputJsonValue }, actorId: string) => {
      if (data.serviceId && !await platformDb.service.findFirst({ where: { id: data.serviceId, tenantId, isActive: true } })) throw new Error("Invalid service");
      const field = await platformDb.customField.create({ data: { tenantId, ...data } });
      await platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "custom_field.created", entityType: "CustomField", entityId: field.id } });
      return field;
    },
    createException: async (data: { locationId?: string; professionalId?: string; resourceId?: string; startsAt: Date; endsAt: Date; reason?: string }, actorId: string) => {
      if (data.startsAt >= data.endsAt) throw new Error("Invalid exception range");
      if (data.locationId && !await platformDb.location.findFirst({ where: { id: data.locationId, tenantId, isActive: true } })) throw new Error("Invalid location");
      if (data.professionalId && !await platformDb.professional.findFirst({ where: { id: data.professionalId, tenantId, isActive: true } })) throw new Error("Invalid professional");
      if (data.resourceId && !await platformDb.resource.findFirst({ where: { id: data.resourceId, tenantId, isActive: true } })) throw new Error("Invalid resource");
      const exception = await platformDb.availabilityException.create({ data: { tenantId, type: "BLOCKED", ...data } });
      await platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "availability.blocked", entityType: "AvailabilityException", entityId: exception.id, metadata: { startsAt: data.startsAt, endsAt: data.endsAt } } });
      return exception;
    },
    createMediaAsset: async (data: { kind: MediaAssetKind; objectKey: string; publicUrl: string; mimeType: string; sizeBytes: number; altText?: string }, actorId: string) => {
      const asset = await platformDb.mediaAsset.create({ data: { tenantId, ...data } });
      await platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "media.uploaded", entityType: "MediaAsset", entityId: asset.id, metadata: { kind: data.kind } } });
      return asset;
    },
    createAnnouncement: async (data: { title: string; body: string; startsAt: Date; endsAt?: Date; style: string }, actorId: string) => {
      if (data.endsAt && data.endsAt <= data.startsAt) throw new Error("Invalid announcement range");
      const announcement = await platformDb.announcement.create({ data: { tenantId, ...data } });
      await platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "announcement.created", entityType: "Announcement", entityId: announcement.id } });
      return announcement;
    },
    savePaymentConnection: async (data: { encryptedCredentials: string; displayName?: string }, actorId: string) => {
      const connection = await platformDb.paymentProviderConnection.upsert({ where: { tenantId_provider: { tenantId, provider: "MERCADOPAGO" } }, update: { ...data, status: "ACTIVE" }, create: { tenantId, provider: "MERCADOPAGO", ...data } });
      await platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "payment_provider.connected", entityType: "PaymentProviderConnection", entityId: connection.id, metadata: { provider: "MERCADOPAGO" } } });
      return connection;
    },
    updateServiceDeposit: async (serviceId: string, policy: Prisma.InputJsonValue, actorId: string) => {
      const service = await platformDb.service.findFirstOrThrow({ where: { id: serviceId, tenantId, isActive: true } });
      const updated = await platformDb.service.update({ where: { id: service.id }, data: { depositPolicy: policy } });
      await platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "service.payment_policy_updated", entityType: "Service", entityId: service.id, metadata: { policy } } });
      return updated;
    },
    createLocation: (data: { name: string; slug: string; address?: string }) => platformDb.location.create({ data: { tenantId, ...data } }),
    createProfessional: async (data: { name: string; locationId?: string; color?: string }) => {
      if (data.locationId && !await platformDb.location.findFirst({ where: { id: data.locationId, tenantId, isActive: true } })) throw new Error("Invalid location");
      return platformDb.professional.create({ data: { tenantId, ...data } });
    },
    createResource: async (data: { name: string; locationId?: string; type?: string; capacity: number; color?: string }) => {
      if (data.locationId && !await platformDb.location.findFirst({ where: { id: data.locationId, tenantId, isActive: true } })) throw new Error("Invalid location");
      return platformDb.resource.create({ data: { tenantId, ...data } });
    },
    createService: async (data: { name: string; description?: string; durationMinutes: number; priceCents?: number; locationId: string; professionalId?: string; resourceId?: string }) =>
      platformDb.$transaction(async (tx) => {
        if (!await tx.location.findFirst({ where: { id: data.locationId, tenantId, isActive: true } })) throw new Error("Invalid location");
        if (data.professionalId && !await tx.professional.findFirst({ where: { id: data.professionalId, tenantId, isActive: true } })) throw new Error("Invalid professional");
        if (data.resourceId && !await tx.resource.findFirst({ where: { id: data.resourceId, tenantId, isActive: true } })) throw new Error("Invalid resource");
        return tx.service.create({ data: {
          tenantId, name: data.name, description: data.description, durationMinutes: data.durationMinutes, priceCents: data.priceCents,
          professionalMode: data.professionalId ? "REQUIRED" : "NONE", resourceMode: data.resourceId ? "REQUIRED" : "NONE",
          locations: { create: { tenantId, locationId: data.locationId } },
          ...(data.professionalId ? { professionals: { create: { tenantId, professionalId: data.professionalId } } } : {}),
          ...(data.resourceId ? { resources: { create: { tenantId, resourceId: data.resourceId } } } : {})
        }});
      }),
    customers: (query?: string) => platformDb.customer.findMany({
      where: { tenantId, archivedAt: null, ...(query ? { OR: [
        { firstName: { contains: query, mode: "insensitive" as const } },
        { lastName: { contains: query, mode: "insensitive" as const } },
        { phone: { contains: query } }
      ] } : {}) }, include:{account:{select:{id:true,status:true,createdAt:true,lastLoginAt:true}},ledgerEntries:{select:{amountCents:true}},_count:{select:{bookings:true}}},orderBy: { updatedAt: "desc" }, take: 100
    }),
    customerDetail:(customerId:string)=>platformDb.customer.findFirst({where:{id:customerId,tenantId,archivedAt:null},include:{account:true,bookings:{include:{service:true,professional:true,location:true},orderBy:{startsAt:"desc"},take:100},ledgerEntries:{orderBy:{createdAt:"desc"},take:200}}}),
    setCustomerAccountStatus:async(customerId:string,status:CustomerAccountStatus,actorId:string)=>platformDb.$transaction(async tx=>{
      const customer=await tx.customer.findFirstOrThrow({where:{id:customerId,tenantId},include:{account:true}});if(!customer.account)throw new Error("El cliente todavía no tiene una cuenta registrada");
      const account=await tx.customerAccount.update({where:{id:customer.account.id},data:{status,approvedAt:status==="ACTIVE"?new Date():customer.account.approvedAt,approvedById:status==="ACTIVE"?actorId:customer.account.approvedById,rejectedAt:status==="REJECTED"?new Date():null}});
      if(status!=="ACTIVE")await tx.customerSession.deleteMany({where:{accountId:account.id}});
      await tx.auditLog.create({data:{scope:"TENANT",tenantId,actorId,action:"customer.account_status_changed",entityType:"CustomerAccount",entityId:account.id,metadata:{from:customer.account.status,to:status}}});return account;
    }),
    addCustomerLedgerEntry:async(customerId:string,data:{type:LedgerEntryType;amountCents:number;description:string;bookingId?:string},actorId:string)=>platformDb.$transaction(async tx=>{
      if(!await tx.customer.findFirst({where:{id:customerId,tenantId,archivedAt:null}}))throw new Error("Cliente inválido");if(data.bookingId&&!await tx.booking.findFirst({where:{id:data.bookingId,customerId,tenantId}}))throw new Error("Turno inválido");
      const entry=await tx.customerLedgerEntry.create({data:{tenantId,customerId,...data,createdById:actorId}});await tx.auditLog.create({data:{scope:"TENANT",tenantId,actorId,action:"customer.ledger_entry_created",entityType:"CustomerLedgerEntry",entityId:entry.id,metadata:{type:data.type,amountCents:data.amountCents}}});return entry;
    }),
    updateBookingStatus: async (bookingId: string, status: BookingStatus, actorId: string, reason?: string) =>
      platformDb.$transaction(async (tx) => {
        const current = await tx.booking.findFirstOrThrow({ where: { id: bookingId, tenantId } });
        const booking = await tx.booking.update({ where: { id: current.id }, data: {
          status, cancellationReason: status === "CANCELLED" ? reason : null,
          cancelledAt: status === "CANCELLED" ? new Date() : null,
          consumesCapacity: !["CANCELLED", "NO_SHOW"].includes(status)
        }});
        await tx.bookingHistory.create({ data: {
          tenantId, bookingId, actorId, action: "STATUS_CHANGED",
          fromState: { status: current.status }, toState: { status, reason }
        }});
        await tx.auditLog.create({ data: {
          scope: "TENANT", tenantId, actorId, action: "booking.status_changed",
          entityType: "Booking", entityId: bookingId, metadata: { from: current.status, to: status }
        }});
        return booking;
      }),
    rescheduleBooking: async (bookingId: string, startsAt: Date, actorId: string) =>
      platformDb.$transaction(async (tx) => {
        const current = await tx.booking.findFirstOrThrow({ where: { id: bookingId, tenantId }, include: { service: true } });
        if (current.status === "CANCELLED") throw new Error("A cancelled booking cannot be rescheduled");
        const endsAt = new Date(startsAt.getTime() + current.durationMinutes * 60_000);
        const capacityStartsAt = new Date(startsAt.getTime() - current.service.preparationMinutes * 60_000);
        const capacityEndsAt = new Date(endsAt.getTime() + current.service.bufferMinutes * 60_000);
        const booking = await tx.booking.update({ where: { id: current.id }, data: { startsAt, endsAt, capacityStartsAt, capacityEndsAt } });
        await tx.bookingHistory.create({ data: {
          tenantId, bookingId, actorId, action: "RESCHEDULED",
          fromState: { startsAt: current.startsAt, endsAt: current.endsAt }, toState: { startsAt, endsAt }
        }});
        await tx.auditLog.create({ data: {
          scope: "TENANT", tenantId, actorId, action: "booking.rescheduled", entityType: "Booking", entityId: bookingId,
          metadata: { from: current.startsAt, to: startsAt }
        }});
        return booking;
      }, { isolationLevel: "Serializable" }),
    createManualBooking: async (input: { locationId: string; serviceId: string; professionalId?: string; resourceId?: string; startsAt: Date; firstName: string; lastName?: string; phone: string; normalizedPhone: string; email?: string | null; normalizedEmail?: string | null }, actorId: string) =>
      platformDb.$transaction(async (tx) => {
        const [location, service] = await Promise.all([
          tx.location.findFirst({ where: { id: input.locationId, tenantId, isActive: true } }),
          tx.service.findFirst({ where: { id: input.serviceId, tenantId, isActive: true } })
        ]);
        if (!location || !service) throw new Error("Invalid tenant relation");
        if (input.professionalId && !await tx.professional.findFirst({ where: { id: input.professionalId, tenantId, isActive: true } })) throw new Error("Invalid professional");
        if (input.resourceId && !await tx.resource.findFirst({ where: { id: input.resourceId, tenantId, isActive: true } })) throw new Error("Invalid resource");
        const customer = await tx.customer.upsert({ where: { tenantId_normalizedPhone: { tenantId, normalizedPhone: input.normalizedPhone } },
          create: { tenantId, firstName: input.firstName, lastName: input.lastName, phone: input.phone, normalizedPhone: input.normalizedPhone, email: input.email, normalizedEmail: input.normalizedEmail },
          update: { firstName: input.firstName, lastName: input.lastName, email: input.email, normalizedEmail: input.normalizedEmail } });
        const endsAt = new Date(input.startsAt.getTime() + service.durationMinutes * 60_000);
        const booking = await tx.booking.create({ data: { tenantId, locationId: location.id, serviceId: service.id, customerId: customer.id,
          professionalId: input.professionalId, resourceId: input.resourceId, startsAt: input.startsAt, endsAt,
          capacityStartsAt: new Date(input.startsAt.getTime() - service.preparationMinutes * 60_000), capacityEndsAt: new Date(endsAt.getTime() + service.bufferMinutes * 60_000),
          durationMinutes: service.durationMinutes, priceCents: service.priceCents, status: "CONFIRMED", origin: "ADMIN", createdById: actorId } });
        await tx.bookingHistory.create({ data: { tenantId, bookingId: booking.id, actorId, action: "CREATED", toState: { status: "CONFIRMED", origin: "ADMIN" } } });
        await tx.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "booking.created", entityType: "Booking", entityId: booking.id } });
        return booking;
      }, { isolationLevel: "Serializable" }),
    createBooking: (input: Prisma.BookingUncheckedCreateInput, history: Prisma.BookingHistoryUncheckedCreateInput, customValues: Array<{ customFieldId: string; value: Prisma.InputJsonValue }> = []) =>
      platformDb.$transaction(async (tx) => {
        if (input.tenantId !== tenantId || history.tenantId !== tenantId) throw new Error("Invalid tenant scope");
        const [location, service] = await Promise.all([
          tx.location.findFirst({ where: { id: input.locationId, tenantId, isActive: true } }),
          tx.service.findFirst({ where: { id: input.serviceId, tenantId, isActive: true } })
        ]);
        if (!location || !service) throw new Error("Invalid tenant relation");
        if (input.professionalId && !await tx.professional.findFirst({ where: { id: input.professionalId, tenantId, isActive: true } })) throw new Error("Invalid professional");
        if (input.resourceId && !await tx.resource.findFirst({ where: { id: input.resourceId, tenantId, isActive: true } })) throw new Error("Invalid resource");
        const booking = await tx.booking.create({ data: input });
        await tx.bookingHistory.create({ data: { ...history, bookingId: booking.id } });
        if (customValues.length) {
          const allowed = await tx.customField.findMany({ where: {
            tenantId, id: { in: customValues.map((value) => value.customFieldId) }, isActive: true,
            OR: [{ serviceId: null }, { serviceId: input.serviceId }]
          }, select: { id: true } });
          if (allowed.length !== customValues.length) throw new Error("Invalid custom field relation");
          await tx.customFieldValue.createMany({ data: customValues.map((entry) => ({
            tenantId, bookingId: booking.id, customFieldId: entry.customFieldId, value: entry.value
          })) });
        }
        return booking;
      }, { isolationLevel: "Serializable" })
  };
}
