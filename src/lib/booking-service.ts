import "server-only";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { platformDb } from "./db";
import { calculateSlots, intersectRanges, weekdayInTimezone, type MinuteRange } from "./availability";

export async function getPublicTenant(slug: string) {
  return platformDb.tenant.findFirst({
    where: { slug, status: { in: ["ACTIVE", "TRIAL"] }, archivedAt: null },
    select: { id: true, slug: true, name: true, timezone: true, currency: true, settings: true, branding: true }
  });
}

export async function getPublicCatalog(tenantId: string) {
  const [locations, services, globalFields] = await Promise.all([
    platformDb.location.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true, address: true } }),
    platformDb.service.findMany({
      where: { tenantId, isActive: true, onlineEnabled: true },
      select: { id: true, name: true, description: true, durationMinutes: true, priceCents: true, color: true, professionalMode: true, resourceMode: true, depositPolicy: true,
        professionals: { select: { professional: { select: { id: true, name: true } } } },
        resources: { select: { resource: { select: { id: true, name: true } } } },
        customFields: { where: { isActive: true }, orderBy: { sortOrder: "asc" } }
      }
    }),
    platformDb.customField.findMany({ where: { tenantId, serviceId: null, isActive: true }, orderBy: { sortOrder: "asc" } })
  ]);
  return [locations, services.map((service) => ({ ...service, customFields: [...globalFields, ...service.customFields] }))] as const;
}

export async function getPublicExperience(tenantId: string) {
  const now = new Date();
  const [announcements, gallery] = await Promise.all([
    platformDb.announcement.findMany({ where: { tenantId, isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: { startsAt: "desc" }, take: 5 }),
    platformDb.mediaAsset.findMany({ where: { tenantId, kind: "GALLERY", archivedAt: null }, select: { id: true, publicUrl: true, altText: true }, orderBy: { createdAt: "desc" }, take: 8 })
  ]);
  return { announcements, gallery };
}

export async function getAvailableSlots(input: { tenantId: string; locationId: string; serviceId: string; professionalId?: string; resourceId?: string; date: string }) {
  const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });
  const expired=await platformDb.paymentTransaction.findMany({where:{tenantId:input.tenantId,expiresAt:{lt:new Date()},status:{in:["PENDING","FAILED"]},booking:{status:"PENDING",consumesCapacity:true}},select:{id:true,bookingId:true}});
  if(expired.length)await platformDb.$transaction([platformDb.booking.updateMany({where:{tenantId:input.tenantId,id:{in:expired.map(item=>item.bookingId)},status:"PENDING"},data:{status:"CANCELLED",consumesCapacity:false,cancellationReason:"Tiempo de pago vencido",cancelledAt:new Date()}}),platformDb.paymentTransaction.updateMany({where:{id:{in:expired.map(item=>item.id)}},data:{status:"FAILED",rawStatus:"expired"}})]);
  const settings = tenant.settings as { intervalMinutes?: number; minimumNoticeMinutes?: number; maximumAdvanceDays?: number };
  const today = formatInTimeZone(new Date(), tenant.timezone, "yyyy-MM-dd");
  const requestedDay = Date.parse(`${input.date}T00:00:00Z`);
  const todayDay = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(requestedDay) || requestedDay < todayDay) return [];
  if (requestedDay > todayDay + (settings.maximumAdvanceDays ?? 60) * 86_400_000) return [];
  const service = await platformDb.service.findFirstOrThrow({ where: { id: input.serviceId, tenantId: input.tenantId, isActive: true, onlineEnabled: true } });
  await platformDb.location.findFirstOrThrow({ where: { id: input.locationId, tenantId: input.tenantId, isActive: true } });
  if (service.professionalMode === "REQUIRED" && !input.professionalId) throw new Error("Professional is required");
  if (service.resourceMode === "REQUIRED" && !input.resourceId) throw new Error("Resource is required");
  const weekday = weekdayInTimezone(input.date, tenant.timezone);
  const rules = await platformDb.availabilityRule.findMany({ where: {
    tenantId: input.tenantId, weekday, isActive: true,
    OR: [
      { ownerType: "TENANT" }, { ownerType: "LOCATION", locationId: input.locationId },
      ...(input.professionalId ? [{ ownerType: "PROFESSIONAL" as const, professionalId: input.professionalId }] : []),
      ...(input.resourceId ? [{ ownerType: "RESOURCE" as const, resourceId: input.resourceId }] : [])
    ]
  }});
  const group = (owner: string) => rules.filter((r) => r.ownerType === owner).map((r) => ({ start: r.startMinute, end: r.endMinute }));
  const groups: MinuteRange[][] = [group("TENANT"), group("LOCATION")].filter((x) => x.length);
  if (input.professionalId && group("PROFESSIONAL").length) groups.push(group("PROFESSIONAL"));
  if (input.resourceId && group("RESOURCE").length) groups.push(group("RESOURCE"));
  if (!groups.length) return [];
  const dayReference = new Date(`${input.date}T12:00:00Z`);
  const rangeStart = startOfDay(addDays(dayReference, -1));
  const rangeEnd = endOfDay(addDays(dayReference, 1));
  const [bookings, exceptions] = await Promise.all([
    platformDb.booking.findMany({ where: {
      tenantId: input.tenantId, consumesCapacity: true, capacityStartsAt: { lt: rangeEnd }, capacityEndsAt: { gt: rangeStart },
      OR: [
        ...(input.professionalId ? [{ professionalId: input.professionalId }] : []),
        ...(input.resourceId ? [{ resourceId: input.resourceId }] : [])
      ]
    }, select: { capacityStartsAt: true, capacityEndsAt: true } }),
    platformDb.availabilityException.findMany({ where: {
      tenantId: input.tenantId, type: "BLOCKED", startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart },
      OR: [ { locationId: null, professionalId: null, resourceId: null }, { locationId: input.locationId },
        ...(input.professionalId ? [{ professionalId: input.professionalId }] : []),
        ...(input.resourceId ? [{ resourceId: input.resourceId }] : [])
      ]
    }, select: { startsAt: true, endsAt: true } })
  ]);
  return calculateSlots({ date: input.date, timezone: tenant.timezone, windows: intersectRanges(groups), busy: [...bookings.map((booking) => ({ startsAt: booking.capacityStartsAt, endsAt: booking.capacityEndsAt })), ...exceptions],
    durationMinutes: service.durationMinutes, preparationMinutes: service.preparationMinutes, bufferMinutes: service.bufferMinutes,
    intervalMinutes: settings.intervalMinutes ?? 30, minimumNoticeMinutes: settings.minimumNoticeMinutes ?? 120 });
}
