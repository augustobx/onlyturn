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
        metadata: { code: current.code, previousPriceCents: current.priceCents, nextPriceCents: Math.round(input.pricePesos * 100) },
      },
    }),
  ]);

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/planes");
  revalidatePath("/superadmin/tenants");
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
    platformDb.tenant.update({
      where: { id: tenant.id },
      data: { status: "ACTIVE", trialEndsAt: null },
    }),
    platformDb.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd,
        trialEndsAt: null,
      },
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

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/tenants");
  revalidatePath(`/superadmin/tenants/${tenant.id}`);
}
