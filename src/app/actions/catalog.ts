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
  restoreUniversalService,
  updateUniversalService,
} from "@/lib/service-catalog";
import {
  setLocationActive,
  setProfessionalActive,
  setResourceActive,
  updateLocation,
  updateProfessional,
  updateResource,
} from "@/lib/structure-management";

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
  bookingType: z.enum(["APPOINTMENT", "CLASS", "EVENT", "RESOURCE"]),
  assignmentStrategy: z.enum(["CLIENT_CHOOSES", "ANY_AVAILABLE", "ROUND_ROBIN", "MANUAL"]),
  durationMinutes: z.coerce.number().int().min(5).max(1440),
  preparationMinutes: z.coerce.number().int().min(0).max(720),
  bufferMinutes: z.coerce.number().int().min(0).max(720),
  minPartySize: z.coerce.number().int().min(1).max(1000),
  maxPartySize: z.coerce.number().int().min(1).max(1000),
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
      bookingType: input.bookingType,
      assignmentStrategy: input.assignmentStrategy,
      durationMinutes: input.durationMinutes,
      preparationMinutes: input.preparationMinutes,
      bufferMinutes: input.bufferMinutes,
      minPartySize: input.minPartySize,
      maxPartySize: input.maxPartySize,
      priceCents,
      color: input.color,
      locationId: input.locationId,
      professionalMode: input.professionalMode,
      resourceMode: input.resourceMode,
      allowWaitlist: formData.has("allowWaitlist"),
      allowRecurring: formData.has("allowRecurring"),
      onlineEnabled: formData.has("onlineEnabled"),
      professionalIds,
      resourceIds,
    },
  };
}

function refreshCatalog() {
  revalidatePath("/app/catalogo");
  revalidatePath("/servicios");
  revalidatePath("/app/estructura");
  revalidatePath("/estructura");
  revalidatePath("/app/configurar");
  revalidatePath("/configurar");
  revalidatePath("/app/disponibilidad");
  revalidatePath("/disponibilidad");
  revalidatePath("/app/configuracion");
  revalidatePath("/configuracion");
  revalidatePath("/");
}

const locationSchema = z.object({
  locationId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().max(180).optional(),
});

const professionalSchema = z.object({
  professionalId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  locationId: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const resourceSchema = z.object({
  resourceId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  locationId: z.string().optional(),
  type: z.string().trim().max(80).optional(),
  capacity: z.coerce.number().int().min(1).max(1000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

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

export async function updateLocationAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = locationSchema.parse(Object.fromEntries(formData));
  await updateLocation(membership.tenantId, input.locationId, { name: input.name, address: input.address || undefined }, session.userId);
  refreshCatalog();
}

export async function setLocationActiveAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ locationId: z.string().min(1), active: z.enum(["true", "false"]) }).parse(Object.fromEntries(formData));
  await setLocationActive(membership.tenantId, input.locationId, input.active === "true", session.userId);
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

export async function updateProfessionalAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = professionalSchema.parse(Object.fromEntries(formData));
  await updateProfessional(membership.tenantId, input.professionalId, { name: input.name, locationId: input.locationId || undefined, color: input.color }, session.userId);
  refreshCatalog();
}

export async function setProfessionalActiveAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ professionalId: z.string().min(1), active: z.enum(["true", "false"]) }).parse(Object.fromEntries(formData));
  await setProfessionalActive(membership.tenantId, input.professionalId, input.active === "true", session.userId);
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

export async function updateResourceAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = resourceSchema.parse(Object.fromEntries(formData));
  await updateResource(membership.tenantId, input.resourceId, { name: input.name, locationId: input.locationId || undefined, type: input.type || undefined, capacity: input.capacity, color: input.color }, session.userId);
  refreshCatalog();
}

export async function setResourceActiveAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ resourceId: z.string().min(1), active: z.enum(["true", "false"]) }).parse(Object.fromEntries(formData));
  await setResourceActive(membership.tenantId, input.resourceId, input.active === "true", session.userId);
  refreshCatalog();
}

export async function createServiceAction(formData: FormData) {
  const { membership, session } = await authorize();
  const { data } = parseServiceForm(formData);
  await createUniversalService(membership.tenantId, data, session.userId);
  refreshCatalog();
}

export async function updateServiceAction(formData: FormData) {
  const { membership, session } = await authorize();
  const { serviceId, data } = parseServiceForm(formData);
  if (!serviceId) throw new Error("Servicio requerido");
  await updateUniversalService(membership.tenantId, serviceId, data, session.userId);
  refreshCatalog();
}

export async function archiveServiceAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ serviceId: z.string().min(1) }).parse(Object.fromEntries(formData));
  await archiveUniversalService(membership.tenantId, input.serviceId, session.userId);
  refreshCatalog();
}

export async function restoreServiceAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ serviceId: z.string().min(1) }).parse(Object.fromEntries(formData));
  await restoreUniversalService(membership.tenantId, input.serviceId, session.userId);
  refreshCatalog();
}
