import { createHmac, randomUUID } from "node:crypto";
import assert from "node:assert/strict";

// This harness must never be pointed at a production database or public URL.
assert.equal(process.env.HUB_MANAGEMENT_TEST_ALLOW_MUTATIONS, "isolated-only");
assert.equal(new URL(process.env.DATABASE_URL).hostname, "hub-test-db");
const base = "http://127.0.0.1:3000", path = "/api/integrations/nanolabs/management";
const product = process.env.HUB_MANAGEMENT_TEST_PRODUCT;
assert.ok(["onlygym", "onlyturn"].includes(product));
const key = process.env.HUB_MANAGEMENT_TOKEN, actor = "isolated-qa", stamp = Date.now().toString(36);
const initialPassword = "Fixture-password-" + stamp, nextPassword = "Changed-password-" + stamp;
let assertions = 0;
function check(condition, label) { assert.ok(condition, label); assertions++; }
function headers(method, suffix, body) {
  const timestamp = String(Date.now());
  return { "Content-Type": "application/json", Authorization: "Bearer " + key, "X-NanoLabs-Actor": actor, "X-NanoLabs-Timestamp": timestamp, "X-NanoLabs-Signature": createHmac("sha256", key).update([timestamp, method, path + suffix, actor, body].join("\n")).digest("hex") };
}
async function read(resource, extra = {}) {
  const suffix = "?" + new URLSearchParams({ resource, ...extra });
  const r = await fetch(base + path + suffix, { headers: headers("GET", suffix, "") });
  const j = await r.json(); assert.equal(r.status, 200, resource + ":" + j.code); check(j.contract === "nanolabs.saas.management.v1" && j.product === product, "read contract"); return j.data;
}
const command = (operation, input) => ({ requestId: randomUUID(), actor, operation, input });
async function send(c, expected = 200) {
  const body = JSON.stringify(c), r = await fetch(base + path, { method: "POST", headers: headers("POST", "", body), body });
  const j = await r.json(); assert.equal(r.status, expected, c.operation + ":" + j.code); assertions++;
  if (expected === 200) check(j.success && j.requestId === c.requestId, "write contract"); return j;
}
async function update(operation, tenantId, extra, expected = 200) {
  const t = await read("tenant", { tenantId }); return send(command(operation, { tenantId, version: t.version, ...extra }), expected);
}
check((await fetch(base + "/api/health")).status === 200, "health");
check((await fetch(base + path)).status === 401, "management anonymous");
const bad = headers("GET", "", ""); bad.Authorization = "Bearer " + process.env.HUB_INTEGRATION_TOKEN;
check((await fetch(base + path, { headers: bad })).status === 401, "read-only token cannot manage");
const catalog = await read("catalog");
check(catalog.operations.length === 11 && catalog.destructiveDelete === false, "catalog");
const modules = Object.fromEntries(catalog.modules.map((key, i) => [key, i !== 0]));
const limits = Object.fromEntries(catalog.limits.map(key => [key, 100]));
const plan = { code: "FIXTURE_" + stamp.toUpperCase(), name: "QA plan", description: "Isolated synthetic fixture", priceCents: 10000, currency: "ARS", active: true, modules, limits };
const createdPlan = await send(command("plan.create", plan));
const planId = createdPlan.data.entityId;
const start = new Date(Date.now() - 60000).toISOString(), end = new Date(Date.now() + 30 * 86400000).toISOString();
const createInput = suffix => ({ name: "QA company " + suffix, slug: "hub-fixture-" + suffix + "-" + stamp, planId, ownerName: "QA owner " + suffix, ownerEmail: "owner-" + suffix + "-" + stamp + "@example.invalid", password: initialPassword, status: "TRIAL", start, end });
await send(command("tenant.create", { ...createInput("expired"), start: "2020-01-01T00:00:00.000Z", end: "2020-02-01T00:00:00.000Z" }), 422);
const createA = command("tenant.create", createInput("a")), first = await send(createA), replay = await send(createA);
assert.deepEqual(first.data, replay.data); assertions++;
await send({ ...createA, input: { ...createA.input, name: "A different company" } }, 409);
const createB = command("tenant.create", createInput("b"));
const [b1, b2] = await Promise.all([send(createB), send(createB)]);
check(b1.data.entityId === b2.data.entityId, "concurrent replay creates one tenant");
const a = first.data.entityId, b = b1.data.entityId;
let ta = await read("tenant", { tenantId: a }), tb = await read("tenant", { tenantId: b });
check(ta.admins.length === 1 && tb.admins.length === 1, "owners created");
check(ta.modules[catalog.modules[0]].enabled === false, "plan modules inherited");
check(!JSON.stringify(ta).includes(initialPassword), "credentials absent from reads");
const version = ta.version;
await send(command("tenant.update", { tenantId: a, version, name: "Renamed QA company", slug: ta.slug }));
await send(command("tenant.status", { tenantId: a, version, status: "SUSPENDED" }), 409);
await update("admin.update", a, { userId: tb.admins[0].id, name: "Wrong tenant", email: "wrong@example.invalid" }, 404);
check((await read("tenant", { tenantId: b })).admins[0].name === tb.admins[0].name, "cross-tenant account protected");
await update("module.set", a, { key: "unknown-module", enabled: true, limit: null }, 422);
await update("module.set", a, { key: catalog.modules[0], enabled: true, limit: null });
check((await read("tenant", { tenantId: a })).modules[catalog.modules[0]].enabled === true, "module override enabled");
await update("module.set", a, { key: catalog.modules[0], enabled: null, limit: null });
check((await read("tenant", { tenantId: a })).modules[catalog.modules[0]].enabled === false, "module inheritance restored");
if (product === "onlyturn") {
  await update("module.set", a, { key: catalog.limits[0], enabled: null, limit: 3 });
  check((await read("tenant", { tenantId: a })).modules[catalog.limits[0]].enabled === 3, "numeric limit override");
}
await update("subscription.update", a, { planId, start, end, status: "ACTIVE" });
await update("tenant.status", a, { status: "SUSPENDED" });
check((await read("tenant", { tenantId: b })).status === "TRIAL", "suspension isolated to selected tenant");
await update("subscription.update", a, { planId, start: "2020-01-01T00:00:00.000Z", end: "2020-02-01T00:00:00.000Z", status: "SUSPENDED" });
await update("tenant.status", a, { status: "ACTIVE" }, 422);
await update("subscription.renew", a, { days: 30 });
ta = await read("tenant", { tenantId: a }); check(ta.status === "ACTIVE" && new Date(ta.subscription.end) > new Date(), "renewal synchronizes status and period");
const payment = command("payment.record", { tenantId: a, version: ta.version, amountCents: 12345, method: "transfer", reference: "REF-" + stamp, notes: "QA synthetic payment", days: 0 });
const paid = await send(payment), paidAgain = await send(payment);
assert.deepEqual(paid.data, paidAgain.data); assertions++;
ta = await read("tenant", { tenantId: a });
check(ta.payments.length === 1 && ta.payments[0].amountCents === 12345, "one exact payment");
await send(command("payment.record", { ...payment.input, version: ta.version }), 409);
check((await read("tenant", { tenantId: b })).payments.length === 0, "payments isolated by tenant");
const owner = ta.admins[0], nextEmail = "updated-" + stamp + "@example.invalid";
await update("admin.update", a, { userId: owner.id, name: "Updated QA owner", email: nextEmail, password: nextPassword });
ta = await read("tenant", { tenantId: a });
check(ta.admins[0].email === nextEmail && !JSON.stringify(ta).includes(nextPassword), "credentials updated and not exported");
await update("admin.revoke", a, { userId: owner.id });
let plans = await read("plans"), existing = plans.items.find(p => p.id === planId);
await send(command("plan.update", { planId, version: existing.version, name: "QA plan retired", description: plan.description, priceCents: 12000, currency: "ARS", active: false, modules, limits }));
await send(command("tenant.create", createInput("inactive-plan")), 422);
check((await read("tenant", { tenantId: a })).plan.active === false, "retired plan retained for existing subscription");
await update("tenant.update", b, { name: tb.name, slug: "qa" });
check((await read("tenant", { tenantId: b })).slug === "qa", "native short tenant label remains manageable");
const audit = await read("audit", { tenantId: a });
check(audit.items.length > 0 && audit.items.every(e => e.tenantId === a), "tenant-scoped audit");
check(!JSON.stringify(audit).includes(nextPassword) && !JSON.stringify(audit).includes(key), "no secrets in audit response");
const r = await fetch(base + "/api/integrations/nanolabs/tenants", { headers: { Authorization: "Bearer " + process.env.HUB_INTEGRATION_TOKEN } });
const listing = await r.json(); check(r.status === 200 && listing.tenants.length === 2 && listing.capabilities.tenantWrite === false, "legacy read-only contract preserved");
check((await fetch(base + path, { method: "DELETE", headers: headers("DELETE", "", "") })).status === 405, "no destructive delete");
console.log(JSON.stringify({ product, assertions, fixtures: 2, result: "ISOLATED_MANAGEMENT_SMOKE_PASS" }));

