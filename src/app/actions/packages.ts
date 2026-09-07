"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { archiveServicePackage, cancelCustomerPackage, createServicePackage, grantCustomerPackage } from "@/lib/packages";

async function authorize() {
  const context = await requireTenantSession();
  if (!can(context.membership.role, context.membership.permissions, "catalog:manage")) throw new Error("Forbidden");
  return context;
}

function refresh() {
  revalidatePath("/app/paquetes");
  revalidatePath("/paquetes");
  revalidatePath("/");
}

export async function createServicePackageAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional(),
    price: z.coerce.number().min(0).max(100_000_000),
    uses: z.coerce.number().int().min(1).max(1000),
    validityDays: z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().int().min(1).max(3650).optional()),
  }).parse(Object.fromEntries(formData));
  await createServicePackage(membership.tenantId, {
    name: input.name,
    description: input.description || undefined,
    priceCents: Math.round(input.price * 100),
    uses: input.uses,
    validityDays: input.validityDays,
    serviceIds: formData.getAll("serviceIds").map(String).filter(Boolean),
  }, session.userId);
  refresh();
}

export async function archiveServicePackageAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ packageId: z.string().min(1) }).parse(Object.fromEntries(formData));
  await archiveServicePackage(membership.tenantId, input.packageId, session.userId);
  refresh();
}

export async function grantCustomerPackageAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ packageId: z.string().min(1), customerId: z.string().min(1) }).parse(Object.fromEntries(formData));
  await grantCustomerPackage(membership.tenantId, input.packageId, input.customerId, session.userId);
  refresh();
}

export async function cancelCustomerPackageAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ customerPackageId: z.string().min(1) }).parse(Object.fromEntries(formData));
  await cancelCustomerPackage(membership.tenantId, input.customerPackageId, session.userId);
  refresh();
}
