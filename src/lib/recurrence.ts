import "server-only";

import { addDays, differenceInCalendarDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { platformDb } from "./db";

export type RecurrenceFrequency = "DAILY" | "WEEKLY";

export type CreateSeriesInput = {
  serviceId: string;
  locationId: string;
  professionalId?: string;
  resourceId?: string;
  customerId?: string;
  anchorLocal: string;
  frequency: RecurrenceFrequency;
  interval: number;
  count: number;
  weekdays: number[];
  capacity?: number;
  title?: string;
  onlineEnabled: boolean;
};

function localDateParts(anchorLocal: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(anchorLocal);
  if (!match) throw new Error("Fecha inicial inválida");
  return { date: match[1], time: match[2] };
}

function generateStarts(input: CreateSeriesInput, timezone: string) {
  if (input.interval < 1 || input.interval > 52) throw new Error("Intervalo de recurrencia inválido");
  if (input.count < 2 || input.count > 250) throw new Error("La serie debe contener entre 2 y 250 ocurrencias");
  const { date, time } = localDateParts(input.anchorLocal);
  const startProbe = new Date(`${date}T12:00:00Z`);
  const weekdays = new Set(input.weekdays.filter((day) => day >= 0 && day <= 6));
  const starts: Date[] = [];

  for (let offset = 0; offset <= 3700 && starts.length < input.count; offset += 1) {
    const probe = addDays(startProbe, offset);
    const candidateDate = probe.toISOString().slice(0, 10);
    if (input.frequency === "DAILY") {
      if (offset % input.interval !== 0) continue;
    } else {
      if (!weekdays.size) throw new Error("Seleccioná al menos un día de la semana");
      const weekday = probe.getUTCDay();
      if (!weekdays.has(weekday)) continue;
      const weekIndex = Math.floor(differenceInCalendarDays(probe, startProbe) / 7);
      if (weekIndex % input.interval !== 0) continue;
    }
    starts.push(fromZonedTime(`${candidateDate}T${time}:00`, timezone));
  }
  if (starts.length !== input.count) throw new Error("No se pudo generar la cantidad solicitada de ocurrencias");
  return starts;
}

export async function getRecurrenceData(tenantId: string) {
  return Promise.all([
    platformDb.service.findMany({
      where: { tenantId, isActive: true, allowRecurring: true },
      include: {
        locations: { include: { location: true } },
        professionals: { include: { professional: true } },
        resources: { include: { resource: true } },
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    platformDb.customer.findMany({
      where: { tenantId, archivedAt: null },
      select: { id: true, firstName: true, lastName: true, phone: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 500,
    }),
    platformDb.bookingSeries.findMany({
      where: { tenantId, status: { in: ["ACTIVE", "PAUSED"] } },
      include: {
        service: true,
        location: true,
        customer: true,
        professional: true,
        resource: true,
        _count: { select: { bookings: true, sessions: true } },
      },
      orderBy: { anchorStartsAt: "asc" },
      take: 250,
    }),
  ] as const);
}

export async function createBookingSeries(tenantId: string, timezone: string, input: CreateSeriesInput, actorId: string) {
  const service = await platformDb.service.findFirst({
    where: { id: input.serviceId, tenantId, isActive: true, allowRecurring: true },
    include: {
      locations: { select: { locationId: true } },
      professionals: { select: { professionalId: true } },
      resources: { select: { resourceId: true } },
    },
  });
  if (!service) throw new Error("El servicio no admite recurrencias");
  if (!service.locations.some((item) => item.locationId === input.locationId)) throw new Error("Sucursal inválida");
  if (input.professionalId && !service.professionals.some((item) => item.professionalId === input.professionalId)) throw new Error("Profesional inválido");
  if (input.resourceId && !service.resources.some((item) => item.resourceId === input.resourceId)) throw new Error("Recurso inválido");
  if (service.professionalMode === "REQUIRED" && !input.professionalId) throw new Error("Seleccioná un profesional");
  if (service.resourceMode === "REQUIRED" && !input.resourceId) throw new Error("Seleccioná un recurso");

  const sessionBased = service.bookingType === "CLASS" || service.bookingType === "EVENT";
  if (!sessionBased && !input.customerId) throw new Error("Las citas recurrentes necesitan un cliente");
  if (input.customerId && !await platformDb.customer.findFirst({ where: { id: input.customerId, tenantId, archivedAt: null }, select: { id: true } })) throw new Error("Cliente inválido");
  const capacity = input.capacity ?? service.maxPartySize;
  if (sessionBased && (capacity < 1 || capacity > service.maxPartySize)) throw new Error(`El cupo debe estar entre 1 y ${service.maxPartySize}`);

  const starts = generateStarts(input, timezone);
  if (starts[0] < new Date()) throw new Error("La primera ocurrencia debe ser futura");
  const rrule = [
    `FREQ=${input.frequency}`,
    `INTERVAL=${input.interval}`,
    `COUNT=${input.count}`,
    input.frequency === "WEEKLY" ? `BYDAY=${[...new Set(input.weekdays)].sort().join(",")}` : "",
  ].filter(Boolean).join(";");

  return platformDb.$transaction(async (tx) => {
    const series = await tx.bookingSeries.create({
      data: {
        tenantId,
        customerId: input.customerId || null,
        serviceId: service.id,
        locationId: input.locationId,
        professionalId: input.professionalId || null,
        resourceId: input.resourceId || null,
        bookingType: service.bookingType,
        rrule,
        timezone,
        anchorStartsAt: starts[0],
        durationMinutes: service.durationMinutes,
        createdById: actorId,
      },
    });

    if (sessionBased) {
      for (const startsAt of starts) {
        const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
        await tx.bookingSession.create({
          data: {
            tenantId,
            seriesId: series.id,
            serviceId: service.id,
            locationId: input.locationId,
            professionalId: input.professionalId || null,
            resourceId: input.resourceId || null,
            title: input.title || null,
            startsAt,
            endsAt,
            capacityStartsAt: new Date(startsAt.getTime() - service.preparationMinutes * 60_000),
            capacityEndsAt: new Date(endsAt.getTime() + service.bufferMinutes * 60_000),
            capacity,
            onlineEnabled: input.onlineEnabled,
            createdById: actorId,
          },
        });
      }
    } else {
      for (const startsAt of starts) {
        const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
        const booking = await tx.booking.create({
          data: {
            tenantId,
            seriesId: series.id,
            locationId: input.locationId,
            customerId: input.customerId!,
            serviceId: service.id,
            professionalId: input.professionalId || null,
            resourceId: input.resourceId || null,
            startsAt,
            endsAt,
            capacityStartsAt: new Date(startsAt.getTime() - service.preparationMinutes * 60_000),
            capacityEndsAt: new Date(endsAt.getTime() + service.bufferMinutes * 60_000),
            durationMinutes: service.durationMinutes,
            priceCents: service.priceCents,
            status: "CONFIRMED",
            origin: "ADMIN",
            createdById: actorId,
          },
        });
        await tx.bookingHistory.create({
          data: { tenantId, bookingId: booking.id, actorId, action: "CREATED_FROM_SERIES", toState: { seriesId: series.id, startsAt } },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        scope: "TENANT",
        tenantId,
        actorId,
        action: "booking_series.created",
        entityType: "BookingSeries",
        entityId: series.id,
        metadata: { rrule, count: starts.length, bookingType: service.bookingType, first: starts[0], last: starts.at(-1) },
      },
    });
    return series;
  }, { isolationLevel: "Serializable", timeout: 30_000 });
}

export async function cancelFutureSeries(tenantId: string, seriesId: string, actorId: string) {
  const series = await platformDb.bookingSeries.findFirst({ where: { id: seriesId, tenantId, status: { in: ["ACTIVE", "PAUSED"] } } });
  if (!series) throw new Error("Serie inexistente");
  const now = new Date();

  await platformDb.$transaction(async (tx) => {
    await tx.bookingSeries.update({ where: { id: series.id }, data: { status: "CANCELLED" } });
    await tx.bookingSession.updateMany({ where: { tenantId, seriesId, startsAt: { gt: now }, status: "SCHEDULED" }, data: { status: "CANCELLED", onlineEnabled: false } });
    await tx.booking.updateMany({
      where: { tenantId, seriesId, startsAt: { gt: now }, status: { notIn: ["CANCELLED", "COMPLETED", "NO_SHOW"] } },
      data: { status: "CANCELLED", consumesCapacity: false, cancellationReason: "Serie recurrente cancelada", cancelledAt: now },
    });
    await tx.auditLog.create({
      data: { scope: "TENANT", tenantId, actorId, action: "booking_series.cancelled", entityType: "BookingSeries", entityId: series.id },
    });
  });
}

export function formatSeriesAnchor(date: Date, timezone: string) {
  return formatInTimeZone(date, timezone, "dd/MM/yyyy HH:mm");
}
