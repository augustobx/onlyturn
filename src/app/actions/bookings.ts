"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createTenantDb } from "@/lib/tenant-db";
import { platformDb } from "@/lib/db";
import { normalizeEmail, normalizePhone } from "@/lib/security";
import { assertPlanCapacity } from "@/lib/plans";
import { restorePackageUsageForBooking } from "@/lib/packages";
import { getAdminFreeSlots } from "@/lib/admin-availability";

export async function updateBookingStatusAction(formData: FormData) {
  const { session, membership } = await requireTenantSession();
  if (!can(membership.role, membership.permissions, "bookings:manage")) throw new Error("Forbidden");
  const parsed = z.object({
    bookingId: z.string().min(1),
    status: z.enum(["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]),
    reason: z.string().max(300).optional(),
  }).parse(Object.fromEntries(formData));

  if (parsed.status === "CANCELLED") {
    await platformDb.$transaction(async (tx) => {
      const current = await tx.booking.findFirstOrThrow({ where: { id: parsed.bookingId, tenantId: membership.tenantId } });
      await tx.booking.update({ where: { id: current.id }, data: { status: "CANCELLED", cancellationReason: parsed.reason || null, cancelledAt: new Date(), consumesCapacity: false } });
      const packageRestored = await restorePackageUsageForBooking(tx, membership.tenantId, current.id);
      await tx.bookingHistory.create({ data: { tenantId: membership.tenantId, bookingId: current.id, actorId: session.userId, action: "STATUS_CHANGED", fromState: { status: current.status }, toState: { status: "CANCELLED", reason: parsed.reason, packageRestored } } });
      await tx.auditLog.create({ data: { scope: "TENANT", tenantId: membership.tenantId, actorId: session.userId, action: "booking.status_changed", entityType: "Booking", entityId: current.id, metadata: { from: current.status, to: "CANCELLED", packageRestored } } });
    });
  } else {
    await createTenantDb(membership.tenantId).updateBookingStatus(parsed.bookingId, parsed.status, session.userId, parsed.reason);
  }
  revalidatePath("/app/agenda");
  revalidatePath("/agenda");
  revalidatePath("/app/sesiones");
}

export async function rescheduleBookingAction(formData: FormData) {
  const { session, membership, tenant } = await requireTenantSession();
  if (!can(membership.role, membership.permissions, "bookings:manage")) throw new Error("Forbidden");
  const parsed = z.object({ bookingId: z.string().min(1), startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/) }).parse(Object.fromEntries(formData));

  const booking = await platformDb.booking.findFirst({
    where: { id: parsed.bookingId, tenantId: membership.tenantId },
    select: { id: true, sessionId: true, locationId: true, serviceId: true, professionalId: true, resourceId: true },
  });
  if (!booking) throw new Error("Reserva inexistente");
  if (booking.sessionId) throw new Error("Una inscripción de clase o evento se cambia desde la sesión, no como turno individual");

  const desiredStart = fromZonedTime(parsed.startsAt, tenant.timezone);
  const date = formatInTimeZone(desiredStart, tenant.timezone, "yyyy-MM-dd");
  const freeSlots = await getAdminFreeSlots({
    tenantId: membership.tenantId,
    date,
    locationId: booking.locationId,
    serviceId: booking.serviceId,
    professionalId: booking.professionalId ?? undefined,
    resourceId: booking.resourceId ?? undefined,
    excludeBookingId: booking.id,
  });
  if (!freeSlots.some((slot) => slot.startsAt.getTime() === desiredStart.getTime())) throw new Error("Ese horario ya no está libre. Elegí uno de los huecos disponibles del calendario.");

  await createTenantDb(membership.tenantId).rescheduleBooking(parsed.bookingId, desiredStart, session.userId);
  revalidatePath("/app/agenda");
  revalidatePath("/agenda");
}

export async function createManualBookingAction(formData: FormData) {
  const { session, membership, tenant } = await requireTenantSession();
  if (!can(membership.role, membership.permissions, "bookings:manage")) throw new Error("Forbidden");
  await assertPlanCapacity(membership.tenantId, "bookings");
  const input = z.object({
    locationId: z.string().min(1),
    serviceId: z.string().min(1),
    professionalId: z.string().optional(),
    resourceId: z.string().optional(),
    startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    firstName: z.string().trim().min(2).max(80),
    lastName: z.string().trim().max(80).optional(),
    phone: z.string().min(6).max(30),
    email: z.union([z.email(), z.literal("")]).optional(),
  }).parse(Object.fromEntries(formData));

  const service = await platformDb.service.findFirst({
    where: { id: input.serviceId, tenantId: membership.tenantId, isActive: true },
    select: { bookingType: true },
  });
  if (!service) throw new Error("Servicio inexistente");
  if (service.bookingType === "CLASS" || service.bookingType === "EVENT") throw new Error("Las clases y eventos se cargan desde Clases y eventos para respetar sesión y cupos");

  const desiredStart = fromZonedTime(input.startsAt, tenant.timezone);
  const date = formatInTimeZone(desiredStart, tenant.timezone, "yyyy-MM-dd");
  const freeSlots = await getAdminFreeSlots({
    tenantId: membership.tenantId,
    date,
    locationId: input.locationId,
    serviceId: input.serviceId,
    professionalId: input.professionalId || undefined,
    resourceId: input.resourceId || undefined,
  });
  const matchedSlot = freeSlots.find((slot) => slot.startsAt.getTime() === desiredStart.getTime());
  if (!matchedSlot) throw new Error("Ese horario no está disponible. Elegí un hueco libre desde el calendario.");

  await createTenantDb(membership.tenantId).createManualBooking({
    ...input,
    professionalId: input.professionalId || matchedSlot.professionalId || undefined,
    resourceId: input.resourceId || matchedSlot.resourceId || undefined,
    startsAt: desiredStart,
    normalizedPhone: normalizePhone(input.phone),
    email: input.email || null,
    normalizedEmail: normalizeEmail(input.email),
  }, session.userId);
  revalidatePath("/app/agenda");
  revalidatePath("/agenda");
}
