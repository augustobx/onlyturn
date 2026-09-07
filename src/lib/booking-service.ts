import "server-only";

import { addDays, endOfDay, startOfDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { platformDb } from "./db";
import { calculateSlots, intersectRanges, weekdayInTimezone, type MinuteRange } from "./availability";
import { reconcileTenantMembership } from "./membership";
import { expirePendingBookingPayments } from "./payment-expiry";
import { resolveServiceAddons } from "./service-addons";

type BookingPolicy = {
  intervalMinutes?: number;
  minimumNoticeMinutes?: number;
  maximumAdvanceDays?: number;
  cancellationHours?: number;
  rescheduleHours?: number;
};

export type AvailableSlot = { startsAt: Date; endsAt: Date };

export async function getPublicTenant(slug: string) {
  const tenant = await platformDb.tenant.findFirst({
    where: { slug, archivedAt: null },
    select: { id: true, slug: true, name: true, timezone: true, currency: true, settings: true, branding: true },
  });
  if (!tenant) return null;
  const access = await reconcileTenantMembership(tenant.id);
  return access?.allowed ? tenant : null;
}

export async function getPublicCatalog(tenantId: string) {
  const [locations, services, globalFields] = await Promise.all([
    platformDb.location.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, address: true },
      orderBy: { name: "asc" },
    }),
    platformDb.service.findMany({
      where: { tenantId, isActive: true, onlineEnabled: true },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        bookingType: true,
        assignmentStrategy: true,
        durationMinutes: true,
        preparationMinutes: true,
        bufferMinutes: true,
        minPartySize: true,
        maxPartySize: true,
        allowWaitlist: true,
        allowRecurring: true,
        bookingPolicy: true,
        priceCents: true,
        color: true,
        professionalMode: true,
        resourceMode: true,
        depositPolicy: true,
        locations: { select: { locationId: true } },
        professionals: { select: { professional: { select: { id: true, name: true } } } },
        resources: { select: { resource: { select: { id: true, name: true, type: true } } } },
        addons: {
          where: { isActive: true },
          select: { id: true, name: true, description: true, priceCents: true, durationMinutes: true, preparationMinutes: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        customFields: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    platformDb.customField.findMany({
      where: { tenantId, serviceId: null, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  return [
    locations,
    services.map((service) => {
      const automatic = service.assignmentStrategy === "ANY_AVAILABLE" || service.assignmentStrategy === "ROUND_ROBIN";
      return {
        ...service,
        professionalMode: automatic ? "NONE" as const : service.professionalMode,
        resourceMode: automatic ? "NONE" as const : service.resourceMode,
        customFields: [...globalFields, ...service.customFields],
      };
    }),
  ] as const;
}

export async function getPublicExperience(tenantId: string) {
  const now = new Date();
  const [announcements, gallery] = await Promise.all([
    platformDb.announcement.findMany({
      where: { tenantId, isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      orderBy: { startsAt: "desc" },
      take: 5,
    }),
    platformDb.mediaAsset.findMany({
      where: { tenantId, kind: "GALLERY", archivedAt: null },
      select: { id: true, publicUrl: true, altText: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  return { announcements, gallery };
}

export async function getAvailableSlots(input: {
  tenantId: string;
  locationId: string;
  serviceId: string;
  professionalId?: string;
  resourceId?: string;
  addonIds?: string[];
  date: string;
}): Promise<AvailableSlot[]> {
  const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });
  await expirePendingBookingPayments(input.tenantId);

  const [service, location] = await Promise.all([
    platformDb.service.findFirstOrThrow({
      where: { id: input.serviceId, tenantId: input.tenantId, isActive: true, onlineEnabled: true },
      include: {
        locations: { select: { locationId: true } },
        professionals: { select: { professionalId: true } },
        resources: { select: { resourceId: true } },
      },
    }),
    platformDb.location.findFirstOrThrow({
      where: { id: input.locationId, tenantId: input.tenantId, isActive: true },
      select: { id: true },
    }),
  ]);

  if (service.bookingType === "CLASS" || service.bookingType === "EVENT") throw new Error("Este tipo de reserva utiliza sesiones programadas");
  if (!service.locations.some((item) => item.locationId === location.id)) throw new Error("Este servicio no está disponible en la sede seleccionada");
  if (input.professionalId && !service.professionals.some((item) => item.professionalId === input.professionalId)) throw new Error("Ese profesional no atiende este servicio");
  if (input.resourceId && !service.resources.some((item) => item.resourceId === input.resourceId)) throw new Error("Ese recurso no está habilitado para este servicio");

  const automatic = service.assignmentStrategy === "ANY_AVAILABLE" || service.assignmentStrategy === "ROUND_ROBIN";
  const needsAutomaticProfessional = automatic && !input.professionalId && service.professionalMode !== "NONE";
  const needsAutomaticResource = automatic && !input.resourceId && service.resourceMode !== "NONE";
  if (needsAutomaticProfessional || needsAutomaticResource) {
    const professionalCandidates: Array<string | undefined> = needsAutomaticProfessional
      ? service.professionals.map((item) => item.professionalId)
      : [input.professionalId];
    const resourceCandidates: Array<string | undefined> = needsAutomaticResource
      ? service.resources.map((item) => item.resourceId)
      : [input.resourceId];
    if (!professionalCandidates.length || !resourceCandidates.length) return [];

    const combinations = professionalCandidates.flatMap((professionalId) => resourceCandidates.map((resourceId) => ({ professionalId, resourceId })));
    const batches: AvailableSlot[][] = await Promise.all(combinations.map((candidate): Promise<AvailableSlot[]> => getAvailableSlots({ ...input, ...candidate })));
    const unique = new Map<number, AvailableSlot>();
    for (const slot of batches.flat()) unique.set(slot.startsAt.getTime(), slot);
    return [...unique.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  if (service.professionalMode === "REQUIRED" && !input.professionalId) throw new Error("Seleccioná un profesional");
  if (service.resourceMode === "REQUIRED" && !input.resourceId) throw new Error("Seleccioná un recurso");

  const tenantSettings = tenant.settings as { intervalMinutes?: number; minimumNoticeMinutes?: number; maximumAdvanceDays?: number };
  const servicePolicy = (service.bookingPolicy ?? {}) as BookingPolicy;
  const maximumAdvanceDays = servicePolicy.maximumAdvanceDays ?? tenantSettings.maximumAdvanceDays ?? 60;
  const minimumNoticeMinutes = servicePolicy.minimumNoticeMinutes ?? tenantSettings.minimumNoticeMinutes ?? 120;
  const intervalMinutes = servicePolicy.intervalMinutes ?? tenantSettings.intervalMinutes ?? 30;

  const today = formatInTimeZone(new Date(), tenant.timezone, "yyyy-MM-dd");
  const requestedDay = Date.parse(`${input.date}T00:00:00Z`);
  const todayDay = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(requestedDay) || requestedDay < todayDay) return [];
  if (requestedDay > todayDay + maximumAdvanceDays * 86_400_000) return [];

  const addons = await resolveServiceAddons(input.tenantId, service.id, input.addonIds ?? []);
  const addonDuration = addons.reduce((sum, addon) => sum + addon.durationMinutes, 0);
  const addonPreparation = addons.reduce((sum, addon) => sum + addon.preparationMinutes, 0);

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

  const bookingAssignmentFilters = [
    ...(input.professionalId ? [{ professionalId: input.professionalId }] : []),
    ...(input.resourceId ? [{ resourceId: input.resourceId }] : []),
  ];

  const [bookings, sessions, exceptions] = await Promise.all([
    platformDb.booking.findMany({
      where: {
        tenantId: input.tenantId,
        consumesCapacity: true,
        capacityStartsAt: { lt: rangeEnd },
        capacityEndsAt: { gt: rangeStart },
        ...(bookingAssignmentFilters.length
          ? { OR: bookingAssignmentFilters }
          : { serviceId: service.id, locationId: input.locationId, professionalId: null, resourceId: null }),
      },
      select: { capacityStartsAt: true, capacityEndsAt: true },
    }),
    bookingAssignmentFilters.length
      ? platformDb.bookingSession.findMany({
          where: {
            tenantId: input.tenantId,
            status: "SCHEDULED",
            capacityStartsAt: { lt: rangeEnd },
            capacityEndsAt: { gt: rangeStart },
            OR: bookingAssignmentFilters,
          },
          select: { capacityStartsAt: true, capacityEndsAt: true },
        })
      : Promise.resolve([]),
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

  return calculateSlots({
    date: input.date,
    timezone: tenant.timezone,
    windows: intersectRanges(groups),
    busy: [
      ...bookings.map((booking) => ({ startsAt: booking.capacityStartsAt, endsAt: booking.capacityEndsAt })),
      ...sessions.map((session) => ({ startsAt: session.capacityStartsAt, endsAt: session.capacityEndsAt })),
      ...exceptions,
    ],
    durationMinutes: service.durationMinutes + addonDuration,
    preparationMinutes: service.preparationMinutes + addonPreparation,
    bufferMinutes: service.bufferMinutes,
    intervalMinutes,
    minimumNoticeMinutes,
  });
}
