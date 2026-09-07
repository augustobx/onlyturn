"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createTenantDb } from "@/lib/tenant-db";
import { publicThemes } from "@/lib/public-themes";

const themeIds = publicThemes.map((theme) => theme.id) as [string, ...string[]];

export async function updateAppearanceAction(formData: FormData) {
  const { session, membership, tenant } = await requireTenantSession();
  if (!can(membership.role, membership.permissions, "settings:manage")) throw new Error("Forbidden");

  const input = z.object({
    themeId: z.enum(themeIds),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }).parse(Object.fromEntries(formData));

  const currentBranding = tenant.branding as Record<string, unknown>;
  await createTenantDb(membership.tenantId).updateSettings({
    settings: tenant.settings as Prisma.InputJsonObject,
    branding: {
      ...currentBranding,
      themeId: input.themeId,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
    } as Prisma.InputJsonObject,
  }, session.userId);

  revalidatePath("/app/apariencia");
  revalidatePath(`/r/${tenant.slug}`);
  revalidatePath(`/r/${tenant.slug}/manifest.webmanifest`);
}
