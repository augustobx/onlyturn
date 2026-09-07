"use server";

import argon2 from "argon2";
import { addDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { platformDb } from "@/lib/db";

const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  ownerName: z.string().trim().min(2).max(100),
  ownerEmail: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(200),
  planId: z.string().min(1),
});

const subscriptionStatusForTenant = {
  TRIAL: "TRIALING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "PAUSED",
  CANCELLED: "CANCELLED",
} as const;

export async function createTenantAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const input = createTenantSchema.parse(Object.fromEntries(formData));

  const [plan, existingTenant, existingUser] = await Promise.all([
    platformDb.plan.findFirst({ where: { id: input.planId, isActive: true } }),
    platformDb.tenant.findUnique({ where: { slug: input.slug }, select: { id: true } }),
    platformDb.user.findUnique({ where: { email: input.ownerEmail }, select: { id: true } }),
  ]);

  if (!plan) throw new Error("El plan seleccionado no está disponible");
  if (existingTenant) throw new Error("Ese slug ya está siendo utilizado");
  if (existingUser) throw new Error("Ese email ya pertenece a un usuario de OnlyTurn");

  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const now = new Date();
  const trialEndsAt = addDays(now, 14);

  await platformDb.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: input.name, slug: input.slug, status: "TRIAL", trialEndsAt },
    });
    const user = await tx.user.create({
      data: { email: input.ownerEmail, name: input.ownerName, passwordHash },
    });
    await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: "OWNER" } });
    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: "TRIALING",
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
      },
    });
    await tx.auditLog.create({
      data: {
        scope: "PLATFORM",
        actorId: session.userId,
        action: "tenant.created",
        entityType: "Tenant",
        entityId: tenant.id,
        metadata: { plan: plan.code, ownerEmail: input.ownerEmail, slug: input.slug },
      },
    });
  });

  revalidatePath("/superadmin");
}

export async function updateTenantStatusAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const input = z.object({
    tenantId: z.string().min(1),
    status: z.enum(["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"]),
  }).parse(Object.fromEntries(formData));

  const current = await platformDb.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });
  const subscription = await platformDb.subscription.findFirst({
    where: { tenantId: input.tenantId },
    orderBy: { createdAt: "desc" },
  });

  await platformDb.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id: input.tenantId }, data: { status: input.status } });
    if (subscription) {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: subscriptionStatusForTenant[input.status] },
      });
    }
    await tx.auditLog.create({
      data: {
        scope: "PLATFORM",
        actorId: session.userId,
        action: "tenant.status_changed",
        entityType: "Tenant",
        entityId: input.tenantId,
        metadata: { from: current.status, to: input.status },
      },
    });
  });

  revalidatePath("/superadmin");
}

export async function extendTrialAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const input = z.object({
    tenantId: z.string().min(1),
    days: z.coerce.number().int().min(1).max(365),
  }).parse(Object.fromEntries(formData));

  const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });
  const subscription = await platformDb.subscription.findFirst({
    where: { tenantId: input.tenantId },
    orderBy: { createdAt: "desc" },
  });
  const base = tenant.trialEndsAt && tenant.trialEndsAt > new Date() ? tenant.trialEndsAt : new Date();
  const trialEndsAt = addDays(base, input.days);
  const tenantStatus = tenant.status === "SUSPENDED" ? "SUSPENDED" : "TRIAL";

  await platformDb.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id: input.tenantId }, data: { trialEndsAt, status: tenantStatus } });
    if (subscription) {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          trialEndsAt,
          currentPeriodEnd: trialEndsAt,
          ...(tenantStatus === "TRIAL" ? { status: "TRIALING" as const } : {}),
        },
      });
    }
    await tx.auditLog.create({
      data: {
        scope: "PLATFORM",
        actorId: session.userId,
        action: "tenant.trial_extended",
        entityType: "Tenant",
        entityId: input.tenantId,
        metadata: { days: input.days, trialEndsAt },
      },
    });
  });

  revalidatePath("/superadmin");
}

export async function changeTenantPlanAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const input = z.object({ tenantId: z.string().min(1), planId: z.string().min(1) }).parse(Object.fromEntries(formData));

  const [tenant, plan, subscription] = await Promise.all([
    platformDb.tenant.findUnique({ where: { id: input.tenantId }, select: { id: true } }),
    platformDb.plan.findFirst({ where: { id: input.planId, isActive: true } }),
    platformDb.subscription.findFirst({ where: { tenantId: input.tenantId }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!tenant) throw new Error("Tenant inexistente");
  if (!plan) throw new Error("Plan inexistente o inactivo");
  if (!subscription) throw new Error("El tenant no tiene una suscripción asociada");

  await platformDb.$transaction([
    platformDb.subscription.update({ where: { id: subscription.id }, data: { planId: plan.id } }),
    platformDb.auditLog.create({
      data: {
        scope: "PLATFORM",
        actorId: session.userId,
        action: "subscription.plan_changed",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: { from: subscription.planId, to: plan.id, code: plan.code },
      },
    }),
  ]);

  revalidatePath("/superadmin");
}
