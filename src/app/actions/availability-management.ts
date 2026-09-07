"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createWeeklyAvailability, deleteAvailabilityRule } from "@/lib/availability-management";

const authorize = async () => {
  const context = await requireTenantSession();
  if (!can(context.membership.role, context.membership.permissions, "settings:manage")) throw new Error("Forbidden");
  return context;
};

function timeToMinute(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new Error("Horario inválido");
  return hour * 60 + minute;
}

function refresh() {
  revalidatePath("/app/disponibilidad");
  revalidatePath("/disponibilidad");
}

export async function createWeeklyAvailabilityAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({
    target: z.string().min(1),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
  }).parse(Object.fromEntries(formData));

  const [ownerTypeRaw, ownerId = ""] = input.target.split(":");
  const ownerType = z.enum(["TENANT", "LOCATION", "PROFESSIONAL", "RESOURCE"]).parse(ownerTypeRaw);
  const weekdays = formData.getAll("weekdays").map((value) => Number(value)).filter((value) => Number.isInteger(value));

  await createWeeklyAvailability(membership.tenantId, {
    ownerType,
    locationId: ownerType === "LOCATION" ? ownerId : undefined,
    professionalId: ownerType === "PROFESSIONAL" ? ownerId : undefined,
    resourceId: ownerType === "RESOURCE" ? ownerId : undefined,
    weekdays,
    startMinute: timeToMinute(input.startTime),
    endMinute: timeToMinute(input.endTime),
    validFrom: input.validFrom ? new Date(`${input.validFrom}T12:00:00Z`) : undefined,
    validUntil: input.validUntil ? new Date(`${input.validUntil}T23:59:59Z`) : undefined,
  }, session.userId);
  refresh();
}

export async function deleteAvailabilityRuleAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ ruleId: z.string().min(1) }).parse(Object.fromEntries(formData));
  await deleteAvailabilityRule(membership.tenantId, input.ruleId, session.userId);
  refresh();
}
