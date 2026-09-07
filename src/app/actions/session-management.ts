"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { cancelBookingSession, createBookingSession } from "@/lib/session-management";

const authorize = async () => {
  const context = await requireTenantSession();
  if (!can(context.membership.role, context.membership.permissions, "bookings:manage")) throw new Error("Forbidden");
  return context;
};

function refresh() {
  revalidatePath("/app/sesiones");
  revalidatePath("/sesiones");
  revalidatePath("/");
}

export async function createBookingSessionAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({
    serviceId: z.string().min(1),
    locationId: z.string().min(1),
    professionalId: z.string().optional(),
    resourceId: z.string().optional(),
    startsAt: z.string().min(1),
    capacity: z.coerce.number().int().min(1).max(1000),
    title: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(500).optional(),
  }).parse(Object.fromEntries(formData));

  const startsAt = new Date(input.startsAt);
  if (Number.isNaN(startsAt.getTime())) throw new Error("Fecha inválida");

  await createBookingSession(membership.tenantId, {
    serviceId: input.serviceId,
    locationId: input.locationId,
    professionalId: input.professionalId || undefined,
    resourceId: input.resourceId || undefined,
    startsAt,
    capacity: input.capacity,
    title: input.title || undefined,
    notes: input.notes || undefined,
    onlineEnabled: formData.has("onlineEnabled"),
  }, session.userId);
  refresh();
}

export async function cancelBookingSessionAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ sessionId: z.string().min(1) }).parse(Object.fromEntries(formData));
  await cancelBookingSession(membership.tenantId, input.sessionId, session.userId);
  refresh();
}
