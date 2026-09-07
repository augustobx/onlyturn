"use server";

import { addDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { platformDb } from "@/lib/db";

const planSchema = z.object({
  planId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300),
  pricePesos: z.coerce.number().min(0).max(100_000_000),
  maxLocations: z.coerce.number().int().min(1).max(10_000),
  maxStaff: z.coerce.number().int().min(1).max(100_000),
  maxResources: z.coerce.number().int().min(1).max(100_000),
  maxBookings: z.coerce.number().int().min(1).max(10_000_000),
});

function refreshControlPlane(tenantId?: string) {
  revalidatePath("/superadmin");
  revalidatePath("/superadmin/planes");
  revalidatePath("/superadmin/tenants");
  if (tenantId) revalidatePath(`/superadmin/tenants/${tenantId}`);
}

export async function updatePlanAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const input = planSchema.parse(Object.fromEntries(formData));
  const current = await platformDb.plan.findUniqueOrThrow({ where: { id: input.planId } });

  const features = {
    maxLocations: input.maxLocations,
    maxStaff: input.maxStaff,
    maxResources: input.maxResources,
    maxBookings: input.maxBookings,
    whatsappNotifications: formData.has("whatsappNotifications"),
    advancedReports: formData.has("advancedReports"),
    customDomain: formData.has("customDomain"),
    waitlist: formData.has("waitlist"),
    deposits: formData.has("deposits"),
    recurringBookings: formData.has("recurringBookings"),
  };

  await platformDb.$transaction([
    platformDb.plan.update({
      where: { id: input.planId },
      data: {
        name: input.name,
        description: input.description || null,
        priceCents: Math.round(input.pricePesos * 100),
        isActive: formData.has("isActive"),
        features,
      },
    }),
    platformDb.auditLog.create({
      data: {
        scope: "PLATFORM",
        actorId: session.userId,
        action: "plan.updated",
        entityType: "Plan",
        entityId: input.planId,
        metadata: {
          code: current.code,
          previousPriceCents: current.priceCents,
          nextPriceCents: Math.round(input.pricePesos * 100),
        },
      },
    }),
  ]);

  refreshControlPlane();
}

export async function updateMembershipDatesAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const input = z.object({
    tenantId: z.string().min(1),
    membershipStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    membershipEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).parse(Object.fromEntries(formData));

  const subscription = await platformDb.subscription.findFirst({
    where: { tenantId: input.tenantId },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) throw new Error("El tenant no tiene una membresía asociada");

  const currentPeriodStart = new Date(`${input.membershipStart}T12:00:00.000Z`);
  const currentPeriodEnd = new Date(`${input.membershipEnd}T23:59:59.999Z`);
  if (currentPeriodEnd <= currentPeriodStart) throw new Error("La fecha de vencimiento debe ser posterior al inicio");

  const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { id: input.tenantId } });

  await platformDb.$transaction([
    platformDb.subscription.update({
      where: { id: subscription.id },
      data: {
        currentPeriodStart,
        currentPeriodEnd,
        ...(tenant.status === "TRIAL" ? { trialEndsAt: currentPeriodEnd } : {}),
      },
    }),
    ...(tenant.status === "TRIAL"
      ? [platformDb.tenant.update({ where: { id: tenant.id }, data: { trialEndsAt: currentPeriodEnd } })]
      : []),
    platformDb.auditLog.create({
      data: {
        scope: "PLATFORM",
        tenantId: tenant.id,
        actorId: session.userId,
        action: "membership.dates_updated",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          previousStart: subscription.currentPeriodStart.toISOString(),
          previousEnd: subscription.currentPeriodEnd.toISOString(),
          currentPeriodStart: currentPeriodStart.toISOString(),
          currentPeriodEnd: currentPeriodEnd.toISOString(),
        },
      },
    }),
  ]);

  refreshControlPlane(tenant.id);
}

export async function renewMembershipAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const input = z.object({
    tenantId: z.string().min(1),
    days: z.coerce.number().int().min(1).max(3650),
  }).parse(Object.fromEntries(formData));

  const [tenant, subscription] = await Promise.all([
    platformDb.tenant.findUniqueOrThrow({ where: { id: input.tenantId } }),
    platformDb.subscription.findFirst({ where: { tenantId: input.tenantId }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!subscription) throw new Error("El tenant no tiene una membresía asociada");

  const now = new Date();
  const base = subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;
  const currentPeriodEnd = addDays(base, input.days);

  await platformDb.$transaction([
    platformDb.tenant.update({ where: { id: tenant.id }, data: { status: "ACTIVE", trialEndsAt: null } }),
    platformDb.subscription.update({
      where: { id: subscription.id },
      data: { status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd, trialEndsAt: null },
    }),
    platformDb.auditLog.create({
      data: {
        scope: "PLATFORM",
        tenantId: tenant.id,
        actorId: session.userId,
        action: "membership.renewed",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          days: input.days,
          previousEnd: subscription.currentPeriodEnd.toISOString(),
          currentPeriodEnd: currentPeriodEnd.toISOString(),
        },
      },
    }),
  ]);

  refreshControlPlane(tenant.id);
}

export async function registerSaasPaymentAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const input = z.object({
    tenantId: z.string().min(1),
    amountPesos: z.coerce.number().positive().max(100_000_000),
    method: z.string().trim().min(2).max(60),
    reference: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(500).optional(),
    days: z.coerce.number().int().min(1).max(3650),
  }).parse(Object.fromEntries(formData));

  const [tenant, subscription] = await Promise.all([
    platformDb.tenant.findUniqueOrThrow({ where: { id: input.tenantId } }),
    platformDb.subscription.findFirst({
      where: { tenantId: input.tenantId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!subscription) throw new Error("El tenant no tiene una membresía asociada");

  const now = new Date();
  const base = subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;
  const currentPeriodEnd = addDays(base, input.days);
  const amountCents = Math.round(input.amountPesos * 100);

  await platformDb.$transaction([
    platformDb.tenant.update({ where: { id: tenant.id }, data: { status: "ACTIVE", trialEndsAt: null } }),
    platformDb.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd,
        trialEndsAt: null,
        provider: input.method,
        providerReference: input.reference || null,
      },
    }),
    platformDb.auditLog.create({
      data: {
        scope: "PLATFORM",
        tenantId: tenant.id,
        actorId: session.userId,
        action: "saas.payment_registered",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          amountCents,
          currency: subscription.plan.currency,
          method: input.method,
          reference: input.reference || null,
          notes: input.notes || null,
          days: input.days,
          planCode: subscription.plan.code,
          previousEnd: subscription.currentPeriodEnd.toISOString(),
          currentPeriodEnd: currentPeriodEnd.toISOString(),
        },
      },
    }),
  ]);

  refreshControlPlane(tenant.id);
}
