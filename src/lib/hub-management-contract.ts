import { z } from "zod";

export const MANAGEMENT_CONTRACT = "nanolabs.saas.management.v1";
export const statusSchema = z.enum(["ACTIVE", "TRIAL", "SUSPENDED", "CANCELED"]);
const id = z.string().trim().min(1).max(191);
const version = z.iso.datetime();
const tenant = { tenantId: id, version };
const name = z.string().trim().min(2).max(100);
// Native tenant provisioning permits short labels; existing identifiers must remain editable.
const slug = z.string().min(1).max(63).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const password = z.string().min(12).max(128);
const modules = z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,40}$/), z.boolean());
const limits = z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,40}$/), z.number().int().min(1).max(10_000_000));
const plan = {
  name, description: z.string().trim().max(300).default(""),
  priceCents: z.number().int().min(0).max(99_999_999),
  currency: z.literal("ARS"), active: z.boolean(), modules, limits,
};
const envelope = { requestId: z.uuid(), actor: z.string().trim().min(1).max(120) };
export const commandSchema = z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("tenant.create"), input: z.object({
      name, slug, planId: id, ownerName: name, ownerEmail: z.email().max(120), password,
      status: z.enum(["ACTIVE", "TRIAL"]), start: z.iso.datetime(), end: z.iso.datetime(),
    }).strict() }).extend(envelope),
    z.object({ operation: z.literal("tenant.update"), input: z.object({ ...tenant, name, slug }).strict() }).extend(envelope),
    z.object({ operation: z.literal("tenant.status"), input: z.object({ ...tenant, status: statusSchema }).strict() }).extend(envelope),
    z.object({ operation: z.literal("subscription.update"), input: z.object({
      ...tenant, planId: id, start: z.iso.datetime(), end: z.iso.datetime(), status: statusSchema,
    }).strict() }).extend(envelope),
    z.object({ operation: z.literal("subscription.renew"), input: z.object({ ...tenant, days: z.number().int().min(1).max(3650) }).strict() }).extend(envelope),
    z.object({ operation: z.literal("module.set"), input: z.object({
      ...tenant, key: z.string().min(1).max(50), enabled: z.boolean().nullable(),
      limit: z.number().int().min(1).max(10_000_000).nullable().default(null),
    }).strict() }).extend(envelope),
    z.object({ operation: z.literal("admin.update"), input: z.object({
      ...tenant, userId: id, name, email: z.email().max(120), password: password.optional(),
    }).strict() }).extend(envelope),
    z.object({ operation: z.literal("admin.revoke"), input: z.object({ ...tenant, userId: id }).strict() }).extend(envelope),
    z.object({ operation: z.literal("plan.create"), input: z.object({
      ...plan, code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_-]+$/),
    }).strict() }).extend(envelope),
    z.object({ operation: z.literal("plan.update"), input: z.object({ ...plan, planId: id, version }).strict() }).extend(envelope),
    z.object({ operation: z.literal("payment.record"), input: z.object({
      ...tenant, amountCents: z.number().int().positive().max(99_999_999),
      method: z.string().trim().min(2).max(60), reference: z.string().trim().min(3).max(100),
      notes: z.string().trim().max(500).default(""), days: z.number().int().min(0).max(3650),
    }).strict() }).extend(envelope),
]);
export type ManagementCommand = z.infer<typeof commandSchema>;
export type ManagementOperation = ManagementCommand["operation"];
export const MANAGEMENT_OPERATIONS: ManagementOperation[] = [
  "tenant.create", "tenant.update", "tenant.status", "subscription.update", "subscription.renew",
  "module.set", "admin.update", "admin.revoke", "plan.create", "plan.update", "payment.record",
];
export class ManagementError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function requireCurrentVersion(actual: Date, supplied: string) {
  if (actual.toISOString() !== supplied) throw new ManagementError(409, "STALE_VERSION", "Los datos cambiaron. Actualizá la ficha antes de guardar.");
}
export function requirePeriod(start: Date, end: Date, operational: boolean) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || (operational && (end <= new Date() || start > new Date()))) {
    throw new ManagementError(422, "INVALID_PERIOD", "El período debe ser válido y estar vigente para activar el tenant.");
  }
}
export function requireTenantSlug(value: string) {
  if (["admin", "superadmin", "api", "app", "dashboard", "portal", "status", "health", "mail", "cdn", "www", "onlygym", "onlyturn"].includes(value)) {
    throw new ManagementError(422, "RESERVED_SLUG", "El identificador está reservado por la plataforma.");
  }
}

