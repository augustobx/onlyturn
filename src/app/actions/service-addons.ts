"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createServiceAddon, setServiceAddonActive, updateServiceAddon } from "@/lib/service-addons";

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

const addonSchema = z.object({
  addonId: z.string().optional(),
  serviceId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(300).optional(),
  price: z.coerce.number().min(0).max(100_000_000),
  durationMinutes: z.coerce.number().int().min(0).max(720),
  preparationMinutes: z.coerce.number().int().min(0).max(720),
});

function parseAddon(formData: FormData) {
  const input = addonSchema.parse(Object.fromEntries(formData));
  return {
    addonId: input.addonId,
    data: {
      serviceId: input.serviceId,
      name: input.name,
      description: input.description || undefined,
      priceCents: Math.round(input.price * 100),
      durationMinutes: input.durationMinutes,
      preparationMinutes: input.preparationMinutes,
    },
  };
}

export async function createServiceAddonAction(formData: FormData) {
  const { membership, session } = await authorize();
  const { data } = parseAddon(formData);
  await createServiceAddon(membership.tenantId, data, session.userId);
  refresh();
}

export async function updateServiceAddonAction(formData: FormData) {
  const { membership, session } = await authorize();
  const { addonId, data } = parseAddon(formData);
  if (!addonId) throw new Error("Extra requerido");
  await updateServiceAddon(membership.tenantId, addonId, data, session.userId);
  refresh();
}

export async function setServiceAddonActiveAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ addonId: z.string().min(1), active: z.enum(["true", "false"]) }).parse(Object.fromEntries(formData));
  await setServiceAddonActive(membership.tenantId, input.addonId, input.active === "true", session.userId);
  refresh();
}

export async function archiveServiceAddonAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ addonId: z.string().min(1) }).parse(Object.fromEntries(formData));
  await setServiceAddonActive(membership.tenantId, input.addonId, false, session.userId);
  refresh();
}
