import { Prisma } from "@prisma/client";
import argon2 from "argon2";
import { platformDb } from "./db";
import { clearTenantResolutionCache } from "./tenant-context";
import { ManagementError, requireCurrentVersion, requirePeriod, requireTenantSlug, type ManagementCommand } from "./hub-management-contract";
import type { ManagementAdapter } from "./hub-management-http";
import { permittedManagementOperations } from "./hub-management-http";

const moduleKeys = ["whatsappNotifications", "advancedReports", "customDomain", "waitlist", "deposits", "recurringBookings"];
const limitKeys = ["maxLocations", "maxStaff", "maxResources", "maxBookings"];
const states = { ACTIVE: "ACTIVE", TRIAL: "TRIAL", SUSPENDED: "SUSPENDED", CANCELED: "CANCELLED" } as const;
const subStates = { ACTIVE: "ACTIVE", TRIAL: "TRIALING", SUSPENDED: "PAUSED", CANCELED: "CANCELLED" } as const;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
function page(url: URL) {
  const offset = Number(url.searchParams.get("offset") || 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 100000) throw new ManagementError(400, "OFFSET", "Paginación inválida.");
  return offset;
}
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function adaptPlan(p: { id: string; code: string; name: string; description: string | null; priceCents: number; currency: string; isActive: boolean; features: unknown; updatedAt: Date }) {
  const features = object(p.features);
  return { id: p.id, code: p.code, name: p.name, description: p.description || "", priceCents: p.priceCents, currency: p.currency, active: p.isActive,
    limits: Object.fromEntries(limitKeys.map(key => [key, features[key] ?? 1])), modules: Object.fromEntries(moduleKeys.map(key => [key, features[key] === true])), version: p.updatedAt.toISOString() };
}
function planData(input: Extract<ManagementCommand, { operation: "plan.create" | "plan.update" }>["input"]) {
  if (Object.keys(input.modules).some(key => !moduleKeys.includes(key)) || Object.keys(input.limits).some(key => !limitKeys.includes(key)) || limitKeys.some(key => !input.limits[key])) throw new ManagementError(422, "PLAN_FEATURES", "Módulos o límites del plan inválidos.");
  return { name: input.name, description: input.description || null, priceCents: input.priceCents, currency: input.currency, isActive: input.active,
    features: { ...Object.fromEntries(moduleKeys.map(key => [key, input.modules[key] ?? false])), ...input.limits } };
}
async function read(resource: string, url: URL) {
  if (resource === "catalog") return { operations: permittedManagementOperations(), modules: moduleKeys, limits: limitKeys, optionalLimits: [], currency: "ARS", destructiveDelete: false };
  if (resource === "plans") {
    const offset = page(url), rows = await platformDb.plan.findMany({ orderBy: { id: "asc" }, skip: offset, take: 101 });
    return { items: rows.slice(0, 100).map(adaptPlan), nextOffset: rows.length > 100 ? offset + 100 : null };
  }
  const tenantId = url.searchParams.get("tenantId");
  if (resource === "audit") {
    const offset = page(url), rows = await platformDb.auditLog.findMany({ where: { ...(tenantId ? { tenantId } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: offset, take: 101,
      select: { id: true, tenantId: true, actorId: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true } });
    return { items: rows.slice(0, 100).map(r => ({ id: r.id, tenantId: r.tenantId, actor: typeof object(r.metadata).actor === "string" ? object(r.metadata).actor : r.actorId, action: r.action, entity: r.entityType, entityId: r.entityId, result: "success", createdAt: r.createdAt.toISOString() })), nextOffset: rows.length > 100 ? offset + 100 : null };
  }
  if (resource !== "tenant" || !tenantId || tenantId.length > 191) throw new ManagementError(400, "RESOURCE", "Recurso de gestión inválido.");
  const t = await platformDb.tenant.findFirst({ where: { id: tenantId, archivedAt: null }, include: {
    subscriptions: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, include: { plan: true } }, featureOverrides: true,
    memberships: { where: { role: { in: ["OWNER", "ADMIN"] } }, take: 100, select: { userId: true, role: true, isActive: true, user: { select: { name: true, email: true } } } },
    _count: { select: { customers: true, locations: true, professionals: true, resources: true, bookings: true } },
  } });
  if (!t) throw new ManagementError(404, "NOT_FOUND", "Tenant inexistente.");
  const sub = t.subscriptions[0], features = object(sub?.plan.features);
  const payments = await platformDb.auditLog.findMany({ where: { tenantId, OR: [{ action: "saas.payment_registered" }, { action: "hub.management", metadata: { path: ["operation"], equals: "payment.record" } }] }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100, select: { id: true, metadata: true, createdAt: true } });
  return { id: t.id, name: t.name, slug: t.slug, status: t.status === "CANCELLED" ? "CANCELED" : t.status, version: t.updatedAt.toISOString(), plan: sub ? adaptPlan(sub.plan) : null,
    subscription: sub ? { id: sub.id, planId: sub.planId, status: sub.status, start: sub.currentPeriodStart.toISOString(), end: sub.currentPeriodEnd.toISOString() } : null,
    modules: Object.fromEntries([...moduleKeys, ...limitKeys].map(key => { const override = t.featureOverrides.find(o => o.key === key); const value = moduleKeys.includes(key) ? override?.enabled ?? null : override?.limit ?? null; return [key, { enabled: value ?? features[key] ?? (moduleKeys.includes(key) ? false : 1), override: value }]; })),
    admins: t.memberships.map(m => ({ id: m.userId, name: m.user.name, email: m.user.email, role: m.role, active: m.isActive })), usage: t._count,
    payments: payments.map(p => { const m = object(p.metadata); return { id: p.id, amountCents: typeof m.amountCents === "number" ? m.amountCents : null, method: typeof m.method === "string" ? m.method : "", reference: typeof m.paymentReference === "string" ? m.paymentReference : typeof m.reference === "string" ? m.reference : "", status: "registered", createdAt: p.createdAt.toISOString() }; }) };
}
async function execute(command: ManagementCommand, fingerprint: string) {
  const result = await platformDb.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"hub-request:" + command.requestId}, 0))`;
    const previous = await tx.auditLog.findFirst({ where: { action: "hub.management", metadata: { path: ["requestId"], equals: command.requestId } }, select: { metadata: true } });
    if (previous) {
      const receipt = object(previous.metadata);
      if (receipt.fingerprint !== fingerprint) throw new ManagementError(409, "IDEMPOTENCY_CONFLICT", "La solicitud ya se utilizó con otros datos.");
      return receipt.result;
    }
    let tenantId: string | null = "tenantId" in command.input ? command.input.tenantId : null;
    if (tenantId !== null) await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenantId} FOR UPDATE`;
    const current = tenantId !== null ? await tx.tenant.findFirst({ where: { id: tenantId, archivedAt: null } }) : null;
    if (tenantId !== null && !current) throw new ManagementError(404, "NOT_FOUND", "Tenant inexistente.");
    if (current && "version" in command.input) requireCurrentVersion(current.updatedAt, command.input.version);
    let before: unknown = current ? { id: current.id, name: current.name, slug: current.slug, status: current.status, version: current.updatedAt.toISOString(), trialEndsAt: current.trialEndsAt } : null;
    const beforeSubscription = tenantId === null ? null : await tx.subscription.findFirst({ where: { tenantId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, planId: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, trialEndsAt: true } });
    const beforeModules = tenantId === null ? null : await tx.tenantFeatureOverride.findMany({ where: { tenantId }, select: { key: true, enabled: true, limit: true } });
    let entityId = tenantId, paymentReference: string | null = null;
    switch (command.operation) {
      case "tenant.create": {
        const i = command.input; requireTenantSlug(i.slug); requirePeriod(new Date(i.start), new Date(i.end), true);
        await tx.$queryRaw`SELECT id FROM "Plan" WHERE id = ${i.planId} FOR SHARE`;
        const plan = await tx.plan.findFirst({ where: { id: i.planId, isActive: true } });
        if (!plan) throw new ManagementError(422, "PLAN", "Plan inexistente o inactivo.");
        const passwordHash = await argon2.hash(i.password, { type: argon2.argon2id });
        const trialEndsAt = i.status === "TRIAL" ? new Date(i.end) : null;
        const t = await tx.tenant.create({ data: { name: i.name, slug: i.slug, status: states[i.status], trialEndsAt } });
        const user = await tx.user.create({ data: { name: i.ownerName, email: i.ownerEmail.toLowerCase(), passwordHash } });
        await tx.membership.create({ data: { tenantId: t.id, userId: user.id, role: "OWNER" } });
        await tx.subscription.create({ data: { tenantId: t.id, planId: plan.id, status: subStates[i.status], currentPeriodStart: new Date(i.start), currentPeriodEnd: new Date(i.end), trialEndsAt } });
        tenantId = t.id; entityId = t.id; break;
      }
      case "tenant.update": {
        const i = command.input; requireTenantSlug(i.slug);
        await tx.tenant.update({ where: { id: tenantId! }, data: { name: i.name, slug: i.slug } }); break;
      }
      case "tenant.status": {
        const i = command.input, sub = await tx.subscription.findFirst({ where: { tenantId: tenantId! }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
        if (["ACTIVE", "TRIAL"].includes(i.status)) {
          if (!sub) throw new ManagementError(422, "SUBSCRIPTION", "Configurá una suscripción antes de activar el tenant.");
          requirePeriod(sub.currentPeriodStart, i.status === "TRIAL" ? sub.trialEndsAt ?? sub.currentPeriodEnd : sub.currentPeriodEnd, true);
        }
        const trialEndsAt = i.status === "TRIAL" ? sub?.trialEndsAt ?? sub?.currentPeriodEnd ?? null : null;
        await tx.tenant.update({ where: { id: tenantId! }, data: { status: states[i.status], trialEndsAt } });
        if (sub) await tx.subscription.update({ where: { id: sub.id }, data: { status: subStates[i.status], trialEndsAt } }); break;
      }
      case "subscription.update": {
        const i = command.input, start = new Date(i.start), end = new Date(i.end); requirePeriod(start, end, ["ACTIVE", "TRIAL"].includes(i.status));
        const sub = await tx.subscription.findFirst({ where: { tenantId: tenantId! }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
        await tx.$queryRaw`SELECT id FROM "Plan" WHERE id = ${i.planId} FOR SHARE`;
        const plan = await tx.plan.findUnique({ where: { id: i.planId } });
        if (!plan || (!plan.isActive && sub?.planId !== plan.id)) throw new ManagementError(422, "PLAN", "Plan inexistente o inactivo.");
        const trialEndsAt = i.status === "TRIAL" ? end : null;
        const data = { planId: plan.id, status: subStates[i.status], currentPeriodStart: start, currentPeriodEnd: end, trialEndsAt };
        if (sub) await tx.subscription.update({ where: { id: sub.id }, data });
        else await tx.subscription.create({ data: { ...data, tenantId: tenantId! } });
        await tx.tenant.update({ where: { id: tenantId! }, data: { status: states[i.status], trialEndsAt } }); break;
      }
      case "subscription.renew":
      case "payment.record": {
        const sub = await tx.subscription.findFirst({ where: { tenantId: tenantId! }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
        if (!sub) throw new ManagementError(422, "SUBSCRIPTION", "El tenant no tiene una suscripción.");
        if (command.operation === "payment.record") {
          paymentReference = command.input.reference;
          if (await tx.auditLog.findFirst({ where: { tenantId, OR: [{ action: "hub.management", metadata: { path: ["paymentReference"], equals: paymentReference } }, { action: "saas.payment_registered", metadata: { path: ["reference"], equals: paymentReference } }] }, select: { id: true } })) throw new ManagementError(409, "PAYMENT_DUPLICATE", "La referencia de pago ya está registrada.");
        }
        if (command.input.days > 0) {
          const now = new Date(), end = new Date(Math.max(now.getTime(), sub.currentPeriodEnd.getTime()) + command.input.days * 86400000);
          await tx.subscription.update({ where: { id: sub.id }, data: { status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: end, trialEndsAt: null,
            ...(command.operation === "payment.record" ? { provider: command.input.method, providerReference: command.input.reference } : {}) } });
          await tx.tenant.update({ where: { id: tenantId! }, data: { status: "ACTIVE", trialEndsAt: null } });
        }
        break;
      }
      case "module.set": {
        const i = command.input;
        if (moduleKeys.includes(i.key)) {
          if (i.limit !== null) throw new ManagementError(422, "MODULE", "Este módulo requiere un valor booleano.");
        } else if (limitKeys.includes(i.key)) {
          if (i.enabled !== null) throw new ManagementError(422, "MODULE", "Este límite requiere un valor numérico.");
        } else throw new ManagementError(422, "MODULE", "Módulo o límite inválido para OnlyTurn.");
        if (i.enabled === null && i.limit === null) await tx.tenantFeatureOverride.deleteMany({ where: { tenantId: tenantId!, key: i.key } });
        else await tx.tenantFeatureOverride.upsert({ where: { tenantId_key: { tenantId: tenantId!, key: i.key } }, create: { tenantId: tenantId!, key: i.key, enabled: i.enabled, limit: i.limit }, update: { enabled: i.enabled, limit: i.limit } });
        break;
      }
      case "admin.update":
      case "admin.revoke": {
        const i = command.input, membership = await tx.membership.findFirst({ where: { tenantId: tenantId!, userId: i.userId, role: { in: ["OWNER", "ADMIN"] }, user: { isSuperAdmin: false } }, select: { id: true } });
        if (!membership) throw new ManagementError(404, "ADMIN", "El usuario no administra este tenant.");
        if (await tx.membership.count({ where: { userId: i.userId } }) > 1) throw new ManagementError(409, "SHARED_ACCOUNT", "La cuenta administra varios tenants; requiere una gestión de identidad independiente.");
        if (command.operation === "admin.update") {
          const a = command.input;
          await tx.user.update({ where: { id: a.userId }, data: { name: a.name, email: a.email.toLowerCase(), ...(a.password ? { passwordHash: await argon2.hash(a.password, { type: argon2.argon2id }) } : {}) } });
        }
        await tx.session.deleteMany({ where: { userId: i.userId } }); break;
      }
      case "plan.create": {
        const p = await tx.plan.create({ data: { ...planData(command.input), code: command.input.code } }); entityId = p.id; break;
      }
      case "plan.update": {
        const i = command.input;
        await tx.$queryRaw`SELECT id FROM "Plan" WHERE id = ${i.planId} FOR UPDATE`;
        const p = await tx.plan.findUniqueOrThrow({ where: { id: i.planId } }); requireCurrentVersion(p.updatedAt, i.version);
        before = adaptPlan(p);
        await tx.plan.update({ where: { id: p.id }, data: { ...planData(i), updatedAt: new Date(Math.max(Date.now(), p.updatedAt.getTime() + 1)) } }); entityId = p.id; break;
      }
    }
    const updated = tenantId === null ? null : await tx.tenant.update({ where: { id: tenantId }, data: { updatedAt: new Date(Math.max(Date.now(), (current?.updatedAt.getTime() ?? 0) + 1)) }, select: { updatedAt: true } });
    const result = { entityId, tenantId, version: updated?.updatedAt.toISOString() ?? null };
    await tx.auditLog.create({ data: { scope: "PLATFORM", tenantId, actorId: null, action: "hub.management", entityType: command.operation, entityId,
      metadata: json({ requestId: command.requestId, fingerprint, actor: command.actor, operation: command.operation, before, beforeSubscription, beforeModules, changedFields: Object.keys(command.input).filter(k=>k!=="password"), passwordChanged: "password" in command.input && !!command.input.password, paymentReference, ...(command.operation === "payment.record" ? { amountCents: command.input.amountCents, method: command.input.method, reference: command.input.reference, notes: command.input.notes } : {}), result }) } });
    return result;
  }, { timeout: 20_000 });
  clearTenantResolutionCache();
  return result;
}
export const turnManagement: ManagementAdapter = { product: "onlyturn", read, execute };

