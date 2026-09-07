"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createTenantDb } from "@/lib/tenant-db";
import { assertPlanCapacity } from "@/lib/plans";
import {
  archiveUniversalService,
  createUniversalService,
  updateUniversalService,
} from "@/lib/service-catalog";

const authorize = async () => {
  const context = await requireTenantSession();
  if (!can(context.membership.role, context.membership.permissions, "catalog:manage")) throw new Error("Forbidden");
  return context;
};

const slugify = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "");

const serviceSchema = z.object({
  serviceId: z.string().optional(),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(80).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(1440),
  preparationMinutes: z.coerce.number().int().min(0).max(720),
  bufferMinutes: z.coerce.number().int().min(0).max(720),
  price: z.union([z.literal(""), z.coerce.number().min(0).max(100_000_000)]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  locationId: z.string().min(1),
  professionalMode: z.enum(["NONE", "OPTIONAL", "REQUIRED"]),
  resourceMode: z.enum(["NONE", "OPTIONAL", "REQUIRED"]),
});

function parseServiceForm(formData: FormData) {
  const input = serviceSchema.parse(Object.fromEntries(formData));
  const professionalIds = formData.getAll("professionalIds").map(String).filter(Boolean);
  const resourceIds = formData.getAll("resourceIds").map(String).filter(Boolean);
  const priceCents = input.price === "" || input.price === undefined ? undefined : Math.round(Number(input.price) * 100);

  return {
    serviceId: input.serviceId,
    data: {
      name: input.name,
      description: input.description || undefined,
      category: input.category || undefined,
      durationMinutes: input.durationMinutes,
      preparationMinutes: input.preparationMinutes,
      bufferMinutes: input.bufferMinutes,
      priceCents,
      color: input.color,
      locationId: input.locationId,
      professionalMode: input.professionalMode,
      resourceMode: input.resourceMode,
      onlineEnabled: formData.has("onlineEnabled"),
      professionalIds,
      resourceIds,
    },
  };
}

function refreshCatalog() {
  revalidatePath("/app/catalogo");
  revalidatePath("/servicios");
  revalidatePath("/");
}

export async function createLocationAction(formData: FormData) {
  const { membership } = await authorize();
  await assertPlanCapacity(membership.tenantId, "locations");
  const input = z.object({
    name: z.string().trim().min(2).max(100),
    address: z.string().trim().max(180).optional(),
  }).parse(Object.fromEntries(formData));
  await createTenantDb(membership.tenantId).createLocation({ ...input, slug: slugify(input.name) });
  refreshCatalog();
}

export async function createProfessionalAction(formData: FormData) {
  const { membership } = await authorize();
  await assertPlanCapacity(membership.tenantId, "staff");
  const input = z.object({
    name: z.string().trim().min(2).max(100),
    locationId: z.string().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }).parse(Object.fromEntries(formData));
  await createTenantDb(membership.tenantId).createProfessional({ ...input, locationId: input.locationId || undefined });
  refreshCatalog();
}

export async function createResourceAction(formData: FormData) {
  const { membership } = await authorize();
  await assertPlanCapacity(membership.tenantId, "resources");
  const input = z.object({
    name: z.string().trim().min(2).max(100),
    locationId: z.string().optional(),
    type: z.string().trim().max(80).optional(),
    capacity: z.coerce.number().int().min(1).max(1000),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }).parse(Object.fromEntries(formData));
  await createTenantDb(membership.tenantId).createResource({ ...input, locationId: input.locationId || undefined });
  refreshCatalog();
}

export async function createServiceAction(formData: FormData) {
  const { membership, user } = await authorize();
  const { data } = parseServiceForm(formData);
  await createUniversalService(membership.tenantId, data, user.id);
  refreshCatalog();
}

export async function updateServiceAction(formData: FormData) {
  const { membership, user } = await authorize();
  const { serviceId, data } = parseServiceForm(formData);
  if (!serviceId) throw new Error("Servicio requerido");
  await updateUniversalService(membership.tenantId, serviceId, data, user.id);
  refreshCatalog();
}

export async function archiveServiceAction(formData: FormData) {
  const { membership, user } = await authorize();
  const input = z.object({ serviceId: z.string().min(1) }).parse(Object.fromEntries(formData));
  await archiveUniversalService(membership.tenantId, input.serviceId, user.id);
  refreshCatalog();
}
