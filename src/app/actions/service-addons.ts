"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { archiveServiceAddon, createServiceAddon } from "@/lib/service-addons";

async function authorize() {
  const context = await requireTenantSession();
  if (!can(context.membership.role, context.membership.permissions, "catalog:manage")) throw new Error("Forbidden");
  return context;
}

function refresh() {
  revalidatePath("/app/extras");
  revalidatePath("/extras");
  revalidatePath("/");
}

export async function createServiceAddonAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({
    serviceId: z.string().min(1),
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(300).optional(),
    price: z.coerce.number().min(0).max(100_000_000),
    durationMinutes: z.coerce.number().int().min(0).max(720),
    preparationMinutes: z.coerce.number().int().min(0).max(720),
  }).parse(Object.fromEntries(formData));

  await createServiceAddon(membership.tenantId, {
    serviceId: input.serviceId,
    name: input.name,
    description: input.description || undefined,
    priceCents: Math.round(input.price * 100),
    durationMinutes: input.durationMinutes,
    preparationMinutes: input.preparationMinutes,
  }, session.userId);
  refresh();
}

export async function archiveServiceAddonAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ addonId: z.string().min(1) }).parse(Object.fromEntries(formData));
  await archiveServiceAddon(membership.tenantId, input.addonId, session.userId);
  refresh();
}
