"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { platformDb } from "@/lib/db";

const schema = z.object({
  businessName: z.string().trim().min(2).max(100), category: z.string().trim().min(2).max(80), timezone: z.string().min(3), currency: z.string().regex(/^[A-Z]{3}$/),
  locationName: z.string().trim().min(2).max(100), address: z.string().trim().max(180), serviceName: z.string().trim().min(2).max(100),
  durationMinutes: z.coerce.number().int().min(5).max(1440), price: z.coerce.number().min(0).max(100000000),
  assigneeType: z.enum(["PROFESSIONAL","RESOURCE"]), assigneeName: z.string().trim().min(2).max(100),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/), closingTime: z.string().regex(/^\d{2}:\d{2}$/),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), description: z.string().trim().max(300)
});
const minutes = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "principal";

export async function completeOnboardingAction(formData: FormData) {
  const { session, membership } = await requireTenantSession();
  if (!can(membership.role, membership.permissions, "settings:manage")) throw new Error("Forbidden");
  const input = schema.parse(Object.fromEntries(formData));
  const startMinute = minutes(input.openingTime), endMinute = minutes(input.closingTime);
  if (startMinute >= endMinute) throw new Error("El horario de cierre debe ser posterior a la apertura");
  await platformDb.$transaction(async (tx) => {
    const location = await tx.location.create({ data: { tenantId: membership.tenantId, name: input.locationName, slug: slugify(input.locationName), address: input.address } });
    const professional = input.assigneeType === "PROFESSIONAL" ? await tx.professional.create({ data: { tenantId: membership.tenantId, locationId: location.id, name: input.assigneeName } }) : null;
    const resource = input.assigneeType === "RESOURCE" ? await tx.resource.create({ data: { tenantId: membership.tenantId, locationId: location.id, name: input.assigneeName } }) : null;
    const service = await tx.service.create({ data: {
      tenantId: membership.tenantId, name: input.serviceName, durationMinutes: input.durationMinutes, priceCents: Math.round(input.price * 100), onlineEnabled: true,
      professionalMode: professional ? "REQUIRED" : "NONE", resourceMode: resource ? "REQUIRED" : "NONE",
      locations: { create: { tenantId: membership.tenantId, locationId: location.id } },
      ...(professional ? { professionals: { create: { tenantId: membership.tenantId, professionalId: professional.id } } } : {}),
      ...(resource ? { resources: { create: { tenantId: membership.tenantId, resourceId: resource.id } } } : {})
    }});
    const availability = [];
    for (let weekday = 1; weekday <= 5; weekday++) {
      availability.push({ tenantId: membership.tenantId, ownerType: "TENANT" as const, weekday, startMinute, endMinute });
      availability.push({ tenantId: membership.tenantId, ownerType: "LOCATION" as const, locationId: location.id, weekday, startMinute, endMinute });
      if (professional) availability.push({ tenantId: membership.tenantId, ownerType: "PROFESSIONAL" as const, professionalId: professional.id, weekday, startMinute, endMinute });
      if (resource) availability.push({ tenantId: membership.tenantId, ownerType: "RESOURCE" as const, resourceId: resource.id, weekday, startMinute, endMinute });
    }
    await tx.availabilityRule.createMany({ data: availability });
    await tx.tenant.update({ where: { id: membership.tenantId }, data: {
      name: input.businessName, category: input.category, timezone: input.timezone, currency: input.currency,
      branding: { primaryColor: input.primaryColor, description: input.description }, onboardingStep: 8, onboardingDone: true
    }});
    await tx.auditLog.create({ data: { scope: "TENANT", tenantId: membership.tenantId, actorId: session.userId, action: "onboarding.completed", entityType: "Tenant", entityId: membership.tenantId, metadata: { locationId: location.id, serviceId: service.id } } });
  });
  redirect("/dashboard");
}
