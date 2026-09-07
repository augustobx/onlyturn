"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createTenantDb } from "@/lib/tenant-db";
import { assertPlanCapacity } from "@/lib/plans";

const authorize = async () => { const context = await requireTenantSession(); if (!can(context.membership.role, context.membership.permissions, "catalog:manage")) throw new Error("Forbidden"); return context; };
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export async function createLocationAction(formData: FormData){const {membership}=await authorize();await assertPlanCapacity(membership.tenantId,"locations");const input=z.object({name:z.string().trim().min(2).max(100),address:z.string().trim().max(180).optional()}).parse(Object.fromEntries(formData));await createTenantDb(membership.tenantId).createLocation({...input,slug:slugify(input.name)});revalidatePath("/app/catalogo")}
export async function createProfessionalAction(formData: FormData){const {membership}=await authorize();await assertPlanCapacity(membership.tenantId,"staff");const input=z.object({name:z.string().trim().min(2).max(100),locationId:z.string().optional(),color:z.string().regex(/^#[0-9a-fA-F]{6}$/)}).parse(Object.fromEntries(formData));await createTenantDb(membership.tenantId).createProfessional({...input,locationId:input.locationId||undefined});revalidatePath("/app/catalogo")}
export async function createResourceAction(formData: FormData){const {membership}=await authorize();await assertPlanCapacity(membership.tenantId,"resources");const input=z.object({name:z.string().trim().min(2).max(100),locationId:z.string().optional(),type:z.string().trim().max(80).optional(),capacity:z.coerce.number().int().min(1).max(100),color:z.string().regex(/^#[0-9a-fA-F]{6}$/)}).parse(Object.fromEntries(formData));await createTenantDb(membership.tenantId).createResource({...input,locationId:input.locationId||undefined});revalidatePath("/app/catalogo")}
export async function createServiceAction(formData: FormData){const {membership}=await authorize();const input=z.object({name:z.string().trim().min(2).max(100),description:z.string().trim().max(300).optional(),durationMinutes:z.coerce.number().int().min(5).max(1440),price:z.coerce.number().min(0).max(100000000),locationId:z.string().min(1),professionalId:z.string().optional(),resourceId:z.string().optional()}).parse(Object.fromEntries(formData));await createTenantDb(membership.tenantId).createService({...input,priceCents:Math.round(input.price*100),professionalId:input.professionalId||undefined,resourceId:input.resourceId||undefined});revalidatePath("/app/catalogo")}
