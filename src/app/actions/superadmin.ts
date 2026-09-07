"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { addDays } from "date-fns";
import { requireSuperAdmin } from "@/lib/auth";
import { platformDb } from "@/lib/db";
import argon2 from "argon2";

export async function createTenantAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const input = z.object({
    name: z.string().trim().min(2).max(100), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    ownerName: z.string().trim().min(2).max(100), ownerEmail: z.email().transform((value) => value.toLowerCase()),
    password: z.string().min(10), planId: z.string().min(1)
  }).parse(Object.fromEntries(formData));
  const plan = await platformDb.plan.findFirstOrThrow({ where: { id: input.planId, isActive: true } });
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  await platformDb.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name: input.name, slug: input.slug, status: "TRIAL", trialEndsAt: addDays(new Date(), 14) } });
    const user = await tx.user.upsert({ where: { email: input.ownerEmail }, update: {}, create: { email: input.ownerEmail, name: input.ownerName, passwordHash } });
    await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: "OWNER" } });
    await tx.subscription.create({ data: { tenantId: tenant.id, planId: plan.id, status: "TRIALING", trialEndsAt: tenant.trialEndsAt, currentPeriodStart: new Date(), currentPeriodEnd: tenant.trialEndsAt! } });
    await tx.auditLog.create({ data: { scope: "PLATFORM", actorId: session.userId, action: "tenant.created", entityType: "Tenant", entityId: tenant.id, metadata: { plan: plan.code, ownerEmail: input.ownerEmail } } });
  });
  revalidatePath("/superadmin");
}

export async function updateTenantStatusAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const input = z.object({ tenantId: z.string().min(1), status: z.enum(["TRIAL","ACTIVE","SUSPENDED","CANCELLED"]) }).parse(Object.fromEntries(formData));
  const current = await platformDb.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });
  await platformDb.$transaction([
    platformDb.tenant.update({ where: { id: input.tenantId }, data: { status: input.status } }),
    platformDb.auditLog.create({ data: { scope: "PLATFORM", actorId: session.userId, action: "tenant.status_changed", entityType: "Tenant", entityId: input.tenantId, metadata: { from: current.status, to: input.status } } })
  ]);
  revalidatePath("/superadmin");
}

export async function extendTrialAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const input = z.object({ tenantId: z.string().min(1), days: z.coerce.number().int().min(1).max(365) }).parse(Object.fromEntries(formData));
  const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });
  const base = tenant.trialEndsAt && tenant.trialEndsAt > new Date() ? tenant.trialEndsAt : new Date();
  const trialEndsAt = addDays(base, input.days);
  await platformDb.$transaction([
    platformDb.tenant.update({ where: { id: input.tenantId }, data: { trialEndsAt, status: tenant.status === "SUSPENDED" ? tenant.status : "TRIAL" } }),
    platformDb.subscription.updateMany({ where: { tenantId: input.tenantId, status: "TRIALING" }, data: { trialEndsAt, currentPeriodEnd: trialEndsAt } }),
    platformDb.auditLog.create({ data: { scope: "PLATFORM", actorId: session.userId, action: "tenant.trial_extended", entityType: "Tenant", entityId: input.tenantId, metadata: { days: input.days, trialEndsAt } } })
  ]);
  revalidatePath("/superadmin");
}

export async function changeTenantPlanAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const input = z.object({ tenantId: z.string().min(1), planId: z.string().min(1) }).parse(Object.fromEntries(formData));
  const plan = await platformDb.plan.findFirstOrThrow({ where: { id: input.planId, isActive: true } });
  const subscription = await platformDb.subscription.findFirstOrThrow({ where: { tenantId: input.tenantId }, orderBy: { createdAt: "desc" } });
  await platformDb.$transaction([
    platformDb.subscription.update({ where: { id: subscription.id }, data: { planId: plan.id } }),
    platformDb.auditLog.create({ data: { scope: "PLATFORM", actorId: session.userId, action: "subscription.plan_changed", entityType: "Subscription", entityId: subscription.id, metadata: { from: subscription.planId, to: plan.id } } })
  ]);
  revalidatePath("/superadmin");
}
