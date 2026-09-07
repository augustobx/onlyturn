"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { assertPlanCapacity } from "@/lib/plans";
import { cancelFutureSeries, createBookingSeries } from "@/lib/recurrence";

function refresh() {
  revalidatePath("/app/recurrencias");
  revalidatePath("/recurrencias");
  revalidatePath("/app/agenda");
  revalidatePath("/agenda");
  revalidatePath("/app/sesiones");
  revalidatePath("/sesiones");
}

export async function createBookingSeriesAction(formData: FormData) {
  const { membership, session, tenant } = await requireTenantSession();
  if (!can(membership.role, membership.permissions, "bookings:manage")) throw new Error("Forbidden");
  const input = z.object({
    serviceId: z.string().min(1),
    locationId: z.string().min(1),
    professionalId: z.string().optional(),
    resourceId: z.string().optional(),
    customerId: z.string().optional(),
    anchorLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    frequency: z.enum(["DAILY", "WEEKLY"]),
    interval: z.coerce.number().int().min(1).max(52),
    count: z.coerce.number().int().min(2).max(250),
    capacity: z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().int().min(1).max(1000).optional()),
    title: z.string().trim().max(120).optional(),
  }).parse(Object.fromEntries(formData));
  const weekdays = formData.getAll("weekdays").map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);

  await assertPlanCapacity(membership.tenantId, "bookings");
  await createBookingSeries(membership.tenantId, tenant.timezone, {
    ...input,
    professionalId: input.professionalId || undefined,
    resourceId: input.resourceId || undefined,
    customerId: input.customerId || undefined,
    title: input.title || undefined,
    weekdays,
    onlineEnabled: formData.has("onlineEnabled"),
  }, session.userId);
  refresh();
}

export async function cancelBookingSeriesAction(formData: FormData) {
  const { membership, session } = await requireTenantSession();
  if (!can(membership.role, membership.permissions, "bookings:manage")) throw new Error("Forbidden");
  const input = z.object({ seriesId: z.string().min(1) }).parse(Object.fromEntries(formData));
  await cancelFutureSeries(membership.tenantId, input.seriesId, session.userId);
  refresh();
}
