"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { cancelWaitlistEntry, createPublicWaitlistEntry } from "@/lib/waitlist";

export async function createPublicWaitlistAction(raw: unknown) {
  return createPublicWaitlistEntry(raw);
}

export async function cancelWaitlistEntryAction(formData: FormData) {
  const context = await requireTenantSession();
  if (!can(context.membership.role, context.membership.permissions, "bookings:manage")) throw new Error("Forbidden");
  const { entryId } = z.object({ entryId: z.string().min(1) }).parse(Object.fromEntries(formData));
  await cancelWaitlistEntry(context.membership.tenantId, entryId, context.session.userId);
  revalidatePath("/app/lista-espera");
  revalidatePath("/lista-espera");
}
