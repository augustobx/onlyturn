"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createAutomationRule, deleteAutomationRule, toggleAutomationRule, updateAutomationRule } from "@/lib/automation";

function refresh() {
  revalidatePath("/app/automatizaciones");
  revalidatePath("/automatizaciones");
}

async function authorize() {
  const context = await requireTenantSession();
  if (!can(context.membership.role, context.membership.permissions, "settings:manage")) throw new Error("Forbidden");
  return context;
}

const automationSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(100),
  event: z.enum(["BOOKING_CREATED", "BOOKING_REMINDER", "BOOKING_CANCELLED"]),
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  offsetMinutes: z.coerce.number().int().min(0).max(43200),
  subject: z.string().trim().max(160).optional(),
  text: z.string().trim().min(2).max(4000),
});

function parseAutomation(formData: FormData) {
  const input = automationSchema.parse(Object.fromEntries(formData));
  return {
    id: input.id,
    data: {
      name: input.name,
      event: input.event,
      channel: input.channel,
      offsetMinutes: input.offsetMinutes,
      template: { subject: input.subject || undefined, text: input.text },
    },
  };
}

export async function createAutomationRuleAction(formData: FormData) {
  const { membership, session } = await authorize();
  const { data } = parseAutomation(formData);
  await createAutomationRule(membership.tenantId, data, session.userId);
  refresh();
}

export async function updateAutomationRuleAction(formData: FormData) {
  const { membership, session } = await authorize();
  const { id, data } = parseAutomation(formData);
  if (!id) throw new Error("Automatización requerida");
  await updateAutomationRule(membership.tenantId, id, data, session.userId);
  refresh();
}

export async function toggleAutomationRuleAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ id: z.string().min(1), enabled: z.enum(["true", "false"]) }).parse(Object.fromEntries(formData));
  await toggleAutomationRule(membership.tenantId, input.id, input.enabled === "true", session.userId);
  refresh();
}

export async function deleteAutomationRuleAction(formData: FormData) {
  const { membership, session } = await authorize();
  const input = z.object({ id: z.string().min(1) }).parse(Object.fromEntries(formData));
  await deleteAutomationRule(membership.tenantId, input.id, session.userId);
  refresh();
}
