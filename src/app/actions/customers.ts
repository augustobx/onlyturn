"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createTenantDb } from "@/lib/tenant-db";
import { platformDb } from "@/lib/db";
import { signedLedgerAmountCents } from "@/lib/customer-accounts";

async function authorize() {
  const context = await requireTenantSession();
  if (!can(context.membership.role, context.membership.permissions, "customers:manage")) throw new Error("Forbidden");
  return context;
}

function refreshCustomer(customerId: string) {
  revalidatePath("/app", "layout");
  revalidatePath("/app/clientes");
  revalidatePath(`/app/clientes/${customerId}`);
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${customerId}`);
}

export async function updateCustomerAccountStatusAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ customerId: z.string().min(1), status: z.enum(["ACTIVE", "REJECTED", "SUSPENDED"]) }).parse(Object.fromEntries(formData));
  await createTenantDb(membership.tenantId).setCustomerAccountStatus(input.customerId, input.status, session.userId);
  refreshCustomer(input.customerId);
}

export async function addCustomerLedgerEntryAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({
    customerId: z.string().min(1),
    type: z.enum(["CHARGE", "PAYMENT", "CREDIT", "ADJUSTMENT"]),
    amount: z.coerce.number().finite().refine((value) => value !== 0),
    description: z.string().trim().min(2).max(200),
    bookingId: z.string().optional(),
  }).parse(Object.fromEntries(formData));
  const amountCents = signedLedgerAmountCents(input.type, input.amount);
  await createTenantDb(membership.tenantId).addCustomerLedgerEntry(input.customerId, {
    type: input.type,
    amountCents,
    description: input.description,
    bookingId: input.bookingId || undefined,
  }, session.userId);
  refreshCustomer(input.customerId);
}

export async function updateCustomerCrmAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({
    customerId: z.string().min(1),
    notes: z.string().trim().max(5000).optional(),
    tags: z.string().trim().max(1000).optional(),
  }).parse(Object.fromEntries(formData));
  const customer = await platformDb.customer.findFirst({ where: { id: input.customerId, tenantId: membership.tenantId, archivedAt: null }, select: { id: true } });
  if (!customer) throw new Error("Cliente inexistente");
  const tags = [...new Set((input.tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 30);
  await platformDb.$transaction([
    platformDb.customer.update({ where: { id: customer.id }, data: { notes: input.notes || null, tags } }),
    platformDb.auditLog.create({ data: { scope: "TENANT", tenantId: membership.tenantId, actorId: session.userId, action: "customer.crm_updated", entityType: "Customer", entityId: customer.id, metadata: { tags } } }),
  ]);
  refreshCustomer(customer.id);
}
