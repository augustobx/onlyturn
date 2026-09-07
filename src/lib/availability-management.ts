import "server-only";

import type { AvailabilityOwnerType } from "@prisma/client";
import { platformDb } from "./db";

export type WeeklyAvailabilityInput = {
  ownerType: AvailabilityOwnerType;
  locationId?: string;
  professionalId?: string;
  resourceId?: string;
  weekdays: number[];
  startMinute: number;
  endMinute: number;
  validFrom?: Date;
  validUntil?: Date;
};

async function validateOwner(tenantId: string, input: WeeklyAvailabilityInput) {
  if (input.startMinute < 0 || input.endMinute > 1440 || input.startMinute >= input.endMinute) throw new Error("Rango horario inválido");
  if (!input.weekdays.length || input.weekdays.some((day) => day < 0 || day > 6)) throw new Error("Seleccioná al menos un día válido");
  if (input.validFrom && input.validUntil && input.validUntil < input.validFrom) throw new Error("La vigencia final no puede ser anterior al inicio");

  if (input.ownerType === "LOCATION") {
    if (!input.locationId || !await platformDb.location.findFirst({ where: { id: input.locationId, tenantId, isActive: true } })) throw new Error("Sucursal inválida");
  }
  if (input.ownerType === "PROFESSIONAL") {
    if (!input.professionalId || !await platformDb.professional.findFirst({ where: { id: input.professionalId, tenantId, isActive: true } })) throw new Error("Profesional inválido");
  }
  if (input.ownerType === "RESOURCE") {
    if (!input.resourceId || !await platformDb.resource.findFirst({ where: { id: input.resourceId, tenantId, isActive: true } })) throw new Error("Recurso inválido");
  }
}

export async function getAvailabilityManagementData(tenantId: string) {
  return Promise.all([
    platformDb.availabilityRule.findMany({
      where: { tenantId },
      include: { location: true, professional: true, resource: true },
      orderBy: [{ isActive: "desc" }, { ownerType: "asc" }, { weekday: "asc" }, { startMinute: "asc" }],
    }),
    platformDb.location.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }),
    platformDb.professional.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }),
    platformDb.resource.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }),
  ] as const);
}

export async function createWeeklyAvailability(tenantId: string, input: WeeklyAvailabilityInput, actorId: string) {
  await validateOwner(tenantId, input);
  const uniqueWeekdays = [...new Set(input.weekdays)];

  return platformDb.$transaction(async (tx) => {
    const created = [];
    for (const weekday of uniqueWeekdays) {
      const rule = await tx.availabilityRule.create({
        data: {
          tenantId,
          ownerType: input.ownerType,
          locationId: input.ownerType === "LOCATION" ? input.locationId : null,
          professionalId: input.ownerType === "PROFESSIONAL" ? input.professionalId : null,
          resourceId: input.ownerType === "RESOURCE" ? input.resourceId : null,
          weekday,
          startMinute: input.startMinute,
          endMinute: input.endMinute,
          validFrom: input.validFrom,
          validUntil: input.validUntil,
        },
      });
      created.push(rule);
    }

    await tx.auditLog.create({
      data: {
        scope: "TENANT",
        tenantId,
        actorId,
        action: "availability.rules_created",
        entityType: "AvailabilityRule",
        metadata: { ownerType: input.ownerType, weekdays: uniqueWeekdays, startMinute: input.startMinute, endMinute: input.endMinute, count: created.length },
      },
    });
    return created;
  });
}

export async function updateAvailabilityRule(tenantId: string, ruleId: string, input: WeeklyAvailabilityInput, actorId: string) {
  if (input.weekdays.length !== 1) throw new Error("Para editar una regla seleccioná un único día");
  await validateOwner(tenantId, input);
  const current = await platformDb.availabilityRule.findFirst({ where: { id: ruleId, tenantId } });
  if (!current) throw new Error("Regla de disponibilidad inexistente");

  const updated = await platformDb.availabilityRule.update({
    where: { id: current.id },
    data: {
      ownerType: input.ownerType,
      locationId: input.ownerType === "LOCATION" ? input.locationId : null,
      professionalId: input.ownerType === "PROFESSIONAL" ? input.professionalId : null,
      resourceId: input.ownerType === "RESOURCE" ? input.resourceId : null,
      weekday: input.weekdays[0],
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      validFrom: input.validFrom ?? null,
      validUntil: input.validUntil ?? null,
    },
  });
  await platformDb.auditLog.create({
    data: { scope: "TENANT", tenantId, actorId, action: "availability.rule_updated", entityType: "AvailabilityRule", entityId: current.id },
  });
  return updated;
}

export async function setAvailabilityRuleActive(tenantId: string, ruleId: string, isActive: boolean, actorId: string) {
  const rule = await platformDb.availabilityRule.findFirst({ where: { id: ruleId, tenantId } });
  if (!rule) throw new Error("Regla de disponibilidad inexistente");
  if (rule.isActive === isActive) return rule;

  const updated = await platformDb.availabilityRule.update({ where: { id: rule.id }, data: { isActive } });
  await platformDb.auditLog.create({
    data: {
      scope: "TENANT",
      tenantId,
      actorId,
      action: isActive ? "availability.rule_reactivated" : "availability.rule_archived",
      entityType: "AvailabilityRule",
      entityId: rule.id,
      metadata: { ownerType: rule.ownerType, weekday: rule.weekday, startMinute: rule.startMinute, endMinute: rule.endMinute },
    },
  });
  return updated;
}

export async function deleteAvailabilityRule(tenantId: string, ruleId: string, actorId: string) {
  return setAvailabilityRuleActive(tenantId, ruleId, false, actorId);
}
