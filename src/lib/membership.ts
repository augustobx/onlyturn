import "server-only";

import { platformDb } from "./db";

export type TenantMembershipAccess = {
  allowed: boolean;
  reason: "OK" | "TENANT_BLOCKED" | "MEMBERSHIP_EXPIRED" | "MEMBERSHIP_BLOCKED" | "NO_SUBSCRIPTION";
  tenantStatus: string;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
};

function subscriptionAllowsAccess(subscription: { status: string; currentPeriodEnd: Date; trialEndsAt: Date | null }, now: Date) {
  if (subscription.status === "ACTIVE") return subscription.currentPeriodEnd > now;
  if (subscription.status === "TRIALING") return (subscription.trialEndsAt ?? subscription.currentPeriodEnd) > now;
  return false;
}

export async function getTenantMembershipAccess(tenantId: string, now = new Date()): Promise<TenantMembershipAccess | null> {
  const [tenant, subscription] = await Promise.all([
    platformDb.tenant.findUnique({ where: { id: tenantId }, select: { status: true, archivedAt: true } }),
    platformDb.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, trialEndsAt: true },
    }),
  ]);

  if (!tenant || tenant.archivedAt) return null;
  if (["SUSPENDED", "CANCELLED"].includes(tenant.status)) {
    return {
      allowed: false,
      reason: "TENANT_BLOCKED",
      tenantStatus: tenant.status,
      subscriptionId: subscription?.id ?? null,
      subscriptionStatus: subscription?.status ?? null,
      currentPeriodStart: subscription?.currentPeriodStart ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      trialEndsAt: subscription?.trialEndsAt ?? null,
    };
  }

  if (!subscription) {
    return {
      allowed: false,
      reason: "NO_SUBSCRIPTION",
      tenantStatus: tenant.status,
      subscriptionId: null,
      subscriptionStatus: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      trialEndsAt: null,
    };
  }

  const allowed = subscriptionAllowsAccess(subscription, now);
  return {
    allowed,
    reason: allowed ? "OK" : ["PAUSED", "CANCELLED"].includes(subscription.status) ? "MEMBERSHIP_BLOCKED" : "MEMBERSHIP_EXPIRED",
    tenantStatus: tenant.status,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    trialEndsAt: subscription.trialEndsAt,
  };
}

export async function reconcileTenantMembership(tenantId: string, now = new Date()): Promise<TenantMembershipAccess | null> {
  const state = await getTenantMembershipAccess(tenantId, now);
  if (!state || state.allowed || state.reason === "TENANT_BLOCKED") return state;

  await platformDb.$transaction(async (tx) => {
    await tx.tenant.updateMany({
      where: { id: tenantId, status: { in: ["ACTIVE", "TRIAL"] } },
      data: { status: "SUSPENDED" },
    });

    if (state.subscriptionId && !["PAUSED", "CANCELLED"].includes(state.subscriptionStatus ?? "")) {
      await tx.subscription.updateMany({
        where: { id: state.subscriptionId, tenantId },
        data: { status: "PAST_DUE" },
      });
    }

    await tx.auditLog.create({
      data: {
        scope: "PLATFORM",
        tenantId,
        action: "membership.auto_suspended",
        entityType: "Subscription",
        entityId: state.subscriptionId,
        metadata: {
          reason: state.reason,
          previousSubscriptionStatus: state.subscriptionStatus,
          currentPeriodEnd: state.currentPeriodEnd?.toISOString() ?? null,
          trialEndsAt: state.trialEndsAt?.toISOString() ?? null,
        },
      },
    });
  });

  return { ...state, allowed: false, tenantStatus: "SUSPENDED", subscriptionStatus: state.subscriptionId ? "PAST_DUE" : null };
}
