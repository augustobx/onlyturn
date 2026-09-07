"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { updateServicePolicy } from "@/lib/service-policies";

const optionalPositiveInt = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.number().int().min(0).max(100000).optional(),
);

export async function updateServicePolicyAction(formData: FormData) {
  const { membership, session } = await requireTenantSession();
  if (!can(membership.role, membership.permissions, "settings:manage")) throw new Error("Forbidden");
  const input = z.object({
    serviceId: z.string().min(1),
    intervalMinutes: optionalPositiveInt,
    minimumNoticeMinutes: optionalPositiveInt,
    maximumAdvanceDays: optionalPositiveInt,
    cancellationHours: optionalPositiveInt,
    rescheduleHours: optionalPositiveInt,
  }).parse(Object.fromEntries(formData));

  await updateServicePolicy(membership.tenantId, input.serviceId, {
    intervalMinutes: input.intervalMinutes || undefined,
    minimumNoticeMinutes: input.minimumNoticeMinutes,
    maximumAdvanceDays: input.maximumAdvanceDays,
    cancellationHours: input.cancellationHours,
    rescheduleHours: input.rescheduleHours,
  }, session.userId);
  revalidatePath("/app/politicas");
  revalidatePath("/politicas");
}
