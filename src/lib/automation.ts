import "server-only";

import type { NotificationChannel } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { platformDb } from "./db";
import { effectiveFeatures } from "./plans";
import { sha256 } from "./security";
import { NotificationRegistry } from "./notifications/provider";
import { configuredNotificationProviders } from "./notifications/providers";

export type AutomationEvent = "BOOKING_CREATED" | "BOOKING_REMINDER" | "BOOKING_CANCELLED";
export type AutomationTemplate = { subject?: string; text: string };
export type AutomationRuleInput = {
  name: string;
  event: AutomationEvent;
  channel: NotificationChannel;
  offsetMinutes: number;
  template: AutomationTemplate;
};

async function validateAutomationInput(tenantId: string, input: AutomationRuleInput) {
  if (input.channel === "PUSH") throw new Error("Push todavía no tiene provider configurado");
  const features = await effectiveFeatures(tenantId);
  if (input.channel === "WHATSAPP" && !features.whatsappNotifications) throw new Error("WhatsApp no está habilitado en el plan actual");
  if (!input.template.text.trim()) throw new Error("El mensaje no puede estar vacío");
}

export async function getAutomationData(tenantId: string) {
  return Promise.all([
    platformDb.automationRule.findMany({ where: { tenantId }, orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] }),
    platformDb.notificationLog.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ] as const);
}

export async function createAutomationRule(tenantId: string, input: AutomationRuleInput, actorId: string) {
  await validateAutomationInput(tenantId, input);
  return platformDb.$transaction(async (tx) => {
    const rule = await tx.automationRule.create({ data: { tenantId, ...input, template: input.template } });
    await tx.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "automation.created", entityType: "AutomationRule", entityId: rule.id, metadata: { event: input.event, channel: input.channel, offsetMinutes: input.offsetMinutes } } });
    return rule;
  });
}

export async function updateAutomationRule(tenantId: string, ruleId: string, input: AutomationRuleInput, actorId: string) {
  await validateAutomationInput(tenantId, input);
  const current = await platformDb.automationRule.findFirst({ where: { id: ruleId, tenantId } });
  if (!current) throw new Error("Automatización inexistente");
  const updated = await platformDb.automationRule.update({
    where: { id: current.id },
    data: { name: input.name, event: input.event, channel: input.channel, offsetMinutes: input.offsetMinutes, template: input.template },
  });
  await platformDb.auditLog.create({
    data: { scope: "TENANT", tenantId, actorId, action: "automation.updated", entityType: "AutomationRule", entityId: current.id, metadata: { event: input.event, channel: input.channel, offsetMinutes: input.offsetMinutes } },
  });
  return updated;
}

export async function toggleAutomationRule(tenantId: string, ruleId: string, enabled: boolean, actorId: string) {
  const rule = await platformDb.automationRule.findFirst({ where: { id: ruleId, tenantId } });
  if (!rule) throw new Error("Automatización inexistente");
  await platformDb.$transaction([
    platformDb.automationRule.update({ where: { id: rule.id }, data: { isActive: enabled } }),
    platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: enabled ? "automation.enabled" : "automation.disabled", entityType: "AutomationRule", entityId: rule.id } }),
  ]);
}

export async function deleteAutomationRule(tenantId: string, ruleId: string, actorId: string) {
  const rule = await platformDb.automationRule.findFirst({ where: { id: ruleId, tenantId } });
  if (!rule) throw new Error("Automatización inexistente");
  await platformDb.$transaction([
    platformDb.automationRule.delete({ where: { id: rule.id } }),
    platformDb.auditLog.create({ data: { scope: "TENANT", tenantId, actorId, action: "automation.deleted", entityType: "AutomationRule", entityId: rule.id } }),
  ]);
}

function render(value: string, data: Record<string, string>) {
  return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => data[key] ?? "");
}

function targetTime(event: AutomationEvent, booking: { startsAt: Date; createdAt: Date; cancelledAt: Date | null }, offsetMinutes: number) {
  if (event === "BOOKING_REMINDER") return new Date(booking.startsAt.getTime() - Math.abs(offsetMinutes) * 60_000);
  const origin = event === "BOOKING_CANCELLED" ? booking.cancelledAt : booking.createdAt;
  return origin ? new Date(origin.getTime() + offsetMinutes * 60_000) : null;
}

export async function runAutomationCycle(now = new Date()) {
  const rules = await platformDb.automationRule.findMany({ where: { isActive: true }, include: { tenant: true } });
  const registry = new NotificationRegistry(configuredNotificationProviders());
  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const rule of rules) {
    const event = rule.event as AutomationEvent;
    if (!["BOOKING_CREATED", "BOOKING_REMINDER", "BOOKING_CANCELLED"].includes(event)) continue;
    const since = new Date(now.getTime() - 30 * 86_400_000);
    const bookings = await platformDb.booking.findMany({
      where: {
        tenantId: rule.tenantId,
        ...(event === "BOOKING_REMINDER"
          ? { startsAt: { gt: now, lte: new Date(now.getTime() + 45 * 86_400_000) }, status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } }
          : event === "BOOKING_CANCELLED"
            ? { cancelledAt: { gte: since, lte: now }, status: "CANCELLED" }
            : { createdAt: { gte: since, lte: now }, status: { not: "CANCELLED" } }),
      },
      include: { customer: true, service: true, location: true, professional: true },
      orderBy: { createdAt: "asc" },
      take: 1000,
    });

    for (const booking of bookings) {
      const scheduledFor = targetTime(event, booking, rule.offsetMinutes);
      if (!scheduledFor || scheduledFor > now) continue;
      if (event === "BOOKING_REMINDER" && booking.startsAt <= now) continue;
      const recipient = rule.channel === "EMAIL" ? booking.customer.email : booking.customer.normalizedPhone || booking.customer.phone;
      if (!recipient) continue;
      const idempotencyKey = `${rule.id}:${booking.id}:${event}:${scheduledFor.toISOString()}`;
      if (await platformDb.notificationLog.findUnique({ where: { idempotencyKey }, select: { id: true } })) continue;

      const template = rule.template as AutomationTemplate;
      const data = {
        negocio: rule.tenant.name,
        cliente: [booking.customer.firstName, booking.customer.lastName].filter(Boolean).join(" "),
        servicio: booking.service.name,
        sede: booking.location.name,
        profesional: booking.professional?.name ?? "",
        fecha: formatInTimeZone(booking.startsAt, rule.tenant.timezone, "dd/MM/yyyy"),
        hora: formatInTimeZone(booking.startsAt, rule.tenant.timezone, "HH:mm"),
      };
      const log = await platformDb.notificationLog.create({
        data: { tenantId: rule.tenantId, bookingId: booking.id, event, channel: rule.channel, status: "PROCESSING", recipientHash: sha256(recipient), scheduledFor, idempotencyKey, attempts: 1 },
      });
      processed += 1;
      try {
        const result = await registry.provider(rule.channel).send({ recipient, subject: template.subject ? render(template.subject, data) : undefined, text: render(template.text, data), metadata: { tenantId: rule.tenantId, bookingId: booking.id, event } });
        await platformDb.notificationLog.update({ where: { id: log.id }, data: { status: "SENT", sentAt: new Date(), providerMessageId: result.providerMessageId, provider: rule.channel === "EMAIL" ? "resend" : "whatsapp" } });
        sent += 1;
      } catch (error) {
        await platformDb.notificationLog.update({ where: { id: log.id }, data: { status: "FAILED", lastError: error instanceof Error ? error.message.slice(0, 1000) : "Unknown notification error" } });
        failed += 1;
      }
    }
  }
  return { processed, sent, failed, rules: rules.length };
}
