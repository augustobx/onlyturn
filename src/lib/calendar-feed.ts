import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { platformDb } from "./db";

function secret() {
  const value = process.env.CALENDAR_FEED_SECRET;
  if (!value) throw new Error("CALENDAR_FEED_SECRET is required");
  return value;
}

export function calendarFeedToken(tenantId: string, professionalId?: string) {
  return createHmac("sha256", secret()).update(`${tenantId}:${professionalId || "all"}`).digest("hex");
}

export function verifyCalendarFeedToken(tenantId: string, token: string, professionalId?: string) {
  const expected = calendarFeedToken(tenantId, professionalId);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function buildCalendarFeed(tenantId: string, professionalId?: string) {
  const tenant = await platformDb.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true } });
  if (!tenant) throw new Error("Tenant not found");
  const from = new Date(Date.now() - 30 * 86_400_000);
  const to = new Date(Date.now() + 365 * 86_400_000);
  const [bookings, sessions] = await Promise.all([
    platformDb.booking.findMany({
      where: {
        tenantId,
        sessionId: null,
        startsAt: { gte: from, lte: to },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        ...(professionalId ? { professionalId } : {}),
      },
      include: { service: true, customer: true, location: true, professional: true, resource: true },
      orderBy: { startsAt: "asc" },
    }),
    platformDb.bookingSession.findMany({
      where: {
        tenantId,
        startsAt: { gte: from, lte: to },
        status: "SCHEDULED",
        ...(professionalId ? { professionalId } : {}),
      },
      include: { service: true, location: true, professional: true, resource: true },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const events = [
    ...bookings.map((booking) => ({
      uid: `booking-${booking.id}@onlyturn.nanoapps.ar`,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      summary: `${booking.service.name} · ${booking.customer.firstName} ${booking.customer.lastName ?? ""}`.trim(),
      description: [booking.professional?.name, booking.resource?.name, booking.customer.phone].filter(Boolean).join(" · "),
      location: booking.location.address || booking.location.name,
      updatedAt: booking.updatedAt,
    })),
    ...sessions.map((session) => ({
      uid: `session-${session.id}@onlyturn.nanoapps.ar`,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      summary: session.title || session.service.name,
      description: [session.service.name, session.professional?.name, session.resource?.name, `Cupo ${session.capacity}`].filter(Boolean).join(" · "),
      location: session.location.address || session.location.name,
      updatedAt: session.updatedAt,
    })),
  ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NanoLabs//OnlyTurn//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(`${tenant.name} · OnlyTurn`)}`,
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${icsDate(event.updatedAt)}`,
      `DTSTART:${icsDate(event.startsAt)}`,
      `DTEND:${icsDate(event.endsAt)}`,
      `SUMMARY:${escapeIcs(event.summary)}`,
      `DESCRIPTION:${escapeIcs(event.description)}`,
      `LOCATION:${escapeIcs(event.location)}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
