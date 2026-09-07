import "server-only";

import { addDays, endOfDay, startOfDay } from "date-fns";
import { platformDb } from "./db";
import { calculateSlots, intersectRanges, weekdayInTimezone, type MinuteRange } from "./availability";

type BookingPolicy = { intervalMinutes?: number };
export type AdminFreeSlot = { date: string; startsAt: Date; endsAt: Date; professionalId?: string; resourceId?: string };

export async function getAdminFreeSlots(input: {
  tenantId: string;
  date: string;
  locationId: string;
  serviceId: string;
  professionalId?: string;
  resourceId?: string;
  excludeBookingId?: string;
}): Promise<AdminFreeSlot[]> {
  const [tenant, service] = await Promise.all([
    platformDb.tenant.findUniqueOrThrow({ where: { id: input.tenantId }, select: { timezone: true, settings: true } }),
    platformDb.service.findFirstOrThrow({
      where: { id: input.serviceId, tenantId: input.tenantId, isActive: true },
      include: {
        locations: { select: { locationId: true } },
        professionals: { select: { professionalId: true } },
        resources: { select: { resourceId: true } },
      },
    }),
  ]);

  if (service.bookingType === "CLASS" || service.bookingType === "EVENT") return [];
  if (!service.locations.some((item) => item.locationId === input.locationId)) return [];

  const automatic = service.assignmentStrategy === "ANY_AVAILABLE" || service.assignmentStrategy === "ROUND_ROBIN";
  const needProfessional = automatic && !input.professionalId && service.professionalMode !== "NONE";
  const needResource = automatic && !input.resourceId && service.resourceMode !== "NONE";

  if (needProfessional || needResource) {
    const professionals: Array<string | undefined> = needProfessional ? service.professionals.map((item) => item.professionalId) : [input.professionalId];
    const resources: Array<string | undefined> = needResource ? service.resources.map((item) => item.resourceId) : [input.resourceId];
    if (!professionals.length || !resources.length) return [];
    const batches = await Promise.all(professionals.flatMap((professionalId) => resources.map((resourceId) => getAdminFreeSlots({ ...input, professionalId, resourceId }))));
    const unique = new Map<number, AdminFreeSlot>();
    for (const slot of batches.flat()) if (!unique.has(slot.startsAt.getTime())) unique.set(slot.startsAt.getTime(), slot);
    return [...unique.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  if (service.professionalMode === "REQUIRED" && !input.professionalId) return [];
  if (service.resourceMode === "REQUIRED" && !input.resourceId) return [];

  const weekday = weekdayInTimezone(input.date, tenant.timezone);
  const dayReference = new Date(`${input.date}T12:00:00Z`);
  const rangeStart = startOfDay(addDays(dayReference, -1));
  const rangeEnd = endOfDay(addDays(dayReference, 1));

  const rules = await platformDb.availabilityRule.findMany({
    where: {
      tenantId: input.tenantId,
      weekday,
      isActive: true,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: rangeEnd } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: rangeStart } }] },
      ],
      OR: [
        { ownerType: "TENANT" },
        { ownerType: "LOCATION", locationId: input.locationId },
        ...(input.professionalId ? [{ ownerType: "PROFESSIONAL" as const, professionalId: input.professionalId }] : []),
        ...(input.resourceId ? [{ ownerType: "RESOURCE" as const, resourceId: input.resourceId }] : []),
      ],
    },
  });

  const group = (owner: string) => rules.filter((rule) => rule.ownerType === owner).map((rule) => ({ start: rule.startMinute, end: rule.endMinute }));
  const groups: MinuteRange[][] = [group("TENANT"), group("LOCATION")].filter((ranges) => ranges.length);
  if (input.professionalId && group("PROFESSIONAL").length) groups.push(group("PROFESSIONAL"));
  if (input.resourceId && group("RESOURCE").length) groups.push(group("RESOURCE"));
  if (!groups.length) return [];

  const assignmentFilters = [
    ...(input.professionalId ? [{ professionalId: input.professionalId }] : []),
    ...(input.resourceId ? [{ resourceId: input.resourceId }] : []),
  ];

  const [bookings, sessions, exceptions] = await Promise.all([
    platformDb.booking.findMany({
      where: {
        tenantId: input.tenantId,
        consumesCapacity: true,
        ...(input.excludeBookingId ? { id: { not: input.excludeBookingId } } : {}),
        capacityStartsAt: { lt: rangeEnd },
        capacityEndsAt: { gt: rangeStart },
        ...(assignmentFilters.length ? { OR: assignmentFilters } : { serviceId: service.id, locationId: input.locationId, professionalId: null, resourceId: null }),
      },
      select: { capacityStartsAt: true, capacityEndsAt: true },
    }),
    assignmentFilters.length ? platformDb.bookingSession.findMany({
      where: { tenantId: input.tenantId, status: "SCHEDULED", capacityStartsAt: { lt: rangeEnd }, capacityEndsAt: { gt: rangeStart }, OR: assignmentFilters },
      select: { capacityStartsAt: true, capacityEndsAt: true },
    }) : Promise.resolve([]),
    platformDb.availabilityException.findMany({
      where: {
        tenantId: input.tenantId,
        type: "BLOCKED",
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
        OR: [
          { locationId: null, professionalId: null, resourceId: null },
          { locationId: input.locationId },
          ...(input.professionalId ? [{ professionalId: input.professionalId }] : []),
          ...(input.resourceId ? [{ resourceId: input.resourceId }] : []),
        ],
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const tenantSettings = tenant.settings as { intervalMinutes?: number };
  const policy = (service.bookingPolicy ?? {}) as BookingPolicy;
  const slots = calculateSlots({
    date: input.date,
    timezone: tenant.timezone,
    windows: intersectRanges(groups),
    busy: [
      ...bookings.map((booking) => ({ startsAt: booking.capacityStartsAt, endsAt: booking.capacityEndsAt })),
      ...sessions.map((session) => ({ startsAt: session.capacityStartsAt, endsAt: session.capacityEndsAt })),
      ...exceptions,
    ],
    durationMinutes: service.durationMinutes,
    preparationMinutes: service.preparationMinutes,
    bufferMinutes: service.bufferMinutes,
    intervalMinutes: policy.intervalMinutes ?? tenantSettings.intervalMinutes ?? 30,
    minimumNoticeMinutes: 0,
  });

  return slots.map((slot) => ({ ...slot, date: input.date, professionalId: input.professionalId, resourceId: input.resourceId }));
}
