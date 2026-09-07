"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { platformDb } from "@/lib/db";

const booleanKeys = [
  "deposits",
  "whatsappNotifications",
  "advancedReports",
  "waitlist",
  "recurringBookings",
  "customDomain",
] as const;

const limitKeys = ["maxLocations", "maxStaff", "maxResources", "maxBookings"] as const;

export async function updateTenantFeatureOverridesAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  if (!tenantId) throw new Error("Tenant inválido");

  await platformDb.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { id: true } });

  const changes: Record<string, string | number | null> = {};

  await platformDb.$transaction(async (tx) => {
    for (const key of booleanKeys) {
      const raw = String(formData.get(`boolean_${key}`) ?? "INHERIT");
      if (raw === "INHERIT") {
        await tx.tenantFeatureOverride.deleteMany({ where: { tenantId, key } });
        changes[key] = null;
        continue;
      }

      if (raw !== "ON" && raw !== "OFF") throw new Error(`Override inválido para ${key}`);
      const enabled = raw === "ON";
      await tx.tenantFeatureOverride.upsert({
        where: { tenantId_key: { tenantId, key } },
        update: { enabled, limit: null },
        create: { tenantId, key, enabled },
      });
      changes[key] = raw;
    }

    for (const key of limitKeys) {
      const raw = String(formData.get(`limit_${key}`) ?? "").trim();
      if (!raw) {
        await tx.tenantFeatureOverride.deleteMany({ where: { tenantId, key } });
        changes[key] = null;
        continue;
      }

      const limit = Number(raw);
      if (!Number.isInteger(limit) || limit <= 0 || limit > 10_000_000) throw new Error(`Límite inválido para ${key}`);
      await tx.tenantFeatureOverride.upsert({
        where: { tenantId_key: { tenantId, key } },
        update: { limit, enabled: null },
        create: { tenantId, key, limit },
      });
      changes[key] = limit;
    }

    await tx.auditLog.create({
      data: {
        scope: "PLATFORM",
        tenantId,
        actorId: session.userId,
        action: "tenant.feature_overrides_updated",
        entityType: "TenantFeatureOverride",
        entityId: tenantId,
        metadata: { changes },
      },
    });
  });

  revalidatePath("/superadmin");
  revalidatePath("/superadmin/tenants");
  revalidatePath(`/superadmin/tenants/${tenantId}`);
}
