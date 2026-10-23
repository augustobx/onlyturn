import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { managementHandlers } from "./hub-management-http";
import { commandSchema, ManagementError, requireCurrentVersion, requirePeriod, requireTenantSlug } from "./hub-management-contract";

const key = "isolated-test-management-key-" + "a".repeat(40);
const actor = "test-admin", base = "https://fixture.invalid/api/integrations/nanolabs/management";
function signed(method = "GET", body = "", path = "", timestamp = Date.now()) {
  const url = new URL(base + path), time = String(timestamp);
  const signature = createHmac("sha256", key).update([time, method, url.pathname + url.search, actor, body].join("\n")).digest("hex");
  return new Request(url, { method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + key, "x-nanolabs-timestamp": time, "x-nanolabs-actor": actor, "x-nanolabs-signature": signature }, ...(method === "POST" ? { body } : {}) });
}
function setup() {
  vi.stubEnv("HUB_MANAGEMENT_ENABLED", "true"); vi.stubEnv("HUB_MANAGEMENT_TOKEN", key);
  vi.stubEnv("HUB_MANAGEMENT_OPERATIONS", "tenant.status");
  const read = vi.fn().mockResolvedValue({ operations: ["tenant.status"] }), execute = vi.fn().mockResolvedValue({ version: "2026-01-01T00:00:00.000Z" });
  return { ...managementHandlers({ product: "onlygym", read, execute }), read, execute };
}
const body = () => JSON.stringify({ requestId: randomUUID(), actor, operation: "tenant.status", input: { tenantId: "1", version: "2026-01-01T00:00:00.000Z", status: "SUSPENDED" } });
afterEach(() => vi.unstubAllEnvs());
describe("Hub management boundary", () => {
  it("fails closed when disabled or unauthenticated without accessing the adapter", async () => {
    const api = setup();
    expect((await api.GET(new Request(base))).status).toBe(401);
    vi.stubEnv("HUB_MANAGEMENT_ENABLED", "false");
    expect((await api.GET(signed())).status).toBe(503);
    expect(api.read).not.toHaveBeenCalled();
  });
  it("accepts signed reads and writes without returning secrets", async () => {
    const api = setup();
    expect((await api.GET(signed())).status).toBe(200);
    const response = await api.POST(signed("POST", body()));
    expect(response.status).toBe(200); expect(await response.text()).not.toContain(key);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(api.execute).toHaveBeenCalledTimes(1);
  });
  it("rejects expired signatures, query/path/actor/body tampering and the read-only token", async () => {
    const api = setup();
    expect((await api.GET(signed("GET", "", "", Date.now() - 301000))).status).toBe(401);
    const original = signed();
    expect((await api.GET(new Request(base + "?resource=tenant", { headers: original.headers }))).status).toBe(401);
    const headers = new Headers(original.headers); headers.set("x-nanolabs-actor", "another-admin");
    expect((await api.GET(new Request(base, { headers }))).status).toBe(401);
    headers.set("authorization", "Bearer read-only-token");
    expect((await api.GET(new Request(base, { headers }))).status).toBe(401);
    const request = signed("POST", body());
    expect((await api.POST(new Request(base, { method: "POST", headers: request.headers, body: body() }))).status).toBe(401);
    expect(api.execute).not.toHaveBeenCalled(); expect(api.read).not.toHaveBeenCalled();
  });
  it("rejects forged actor and operations outside credential scope", async () => {
    const api = setup(), forged = JSON.stringify({ ...JSON.parse(body()), actor: "forged" });
    expect((await api.POST(signed("POST", forged))).status).toBe(403);
    vi.stubEnv("HUB_MANAGEMENT_OPERATIONS", "");
    expect((await api.POST(signed("POST", body()))).status).toBe(403);
    expect(api.execute).not.toHaveBeenCalled();
  });
  it("validates command shapes, rejects oversized input and hides infrastructure errors", async () => {
    const api = setup();
    expect((await api.POST(signed("POST", "{"))).status).toBe(400);
    const invalid = JSON.stringify({ ...JSON.parse(body()), input: { ...JSON.parse(body()).input, status: "ADMIN" } });
    expect((await api.POST(signed("POST", invalid))).status).toBe(400);
    expect((await api.POST(signed("POST", "x".repeat(32769)))).status).toBe(413);
    api.execute.mockRejectedValue(new Error("postgres://private-secret"));
    const response = await api.POST(signed("POST", body()));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("private-secret");
  });
  it("preserves actionable conflict errors", async () => {
    const api = setup(); api.execute.mockRejectedValue(new ManagementError(409, "STALE_VERSION", "Actualizá la ficha."));
    expect((await api.POST(signed("POST", body()))).status).toBe(409);
  });
});
describe("control plane validation", () => {
  it("accepts existing short tenant labels while rejecting invalid host labels", () => {
    const command = { ...JSON.parse(body()), operation: "tenant.update", input: { tenantId: "fixture", version: "2026-01-01T00:00:00.000Z", name: "Existing business", slug: "qa" } };
    expect(commandSchema.safeParse(command).success).toBe(true);
    for (const slug of ["", "-qa", "qa-", "qa.example", "QA"]) {
      expect(commandSchema.safeParse({ ...command, input: { ...command.input, slug } }).success).toBe(false);
    }
  });
  it("requires valid dates and explicit renewal of expired subscriptions", () => {
    expect(() => requirePeriod(new Date("2025-01-01"), new Date("2025-02-01"), true)).toThrow(ManagementError);
    expect(() => requirePeriod(new Date("2025-01-01"), new Date("2025-02-01"), false)).not.toThrow();
    expect(() => requireCurrentVersion(new Date("2026-01-01"), "2026-02-01T00:00:00.000Z")).toThrow(ManagementError);
    expect(() => requireTenantSlug("api")).toThrow(ManagementError);
  });
  it("rejects unexpected mutation fields and invalid money amounts", () => {
    const command = JSON.parse(body());
    expect(commandSchema.safeParse({ ...command, input: { ...command.input, isSuperAdmin: true } }).success).toBe(false);
    expect(commandSchema.safeParse({ ...command, operation: "payment.record", input: { tenantId: "1", version: command.input.version, amountCents: 1.5, method: "transfer", reference: "fixture", days: 0 } }).success).toBe(false);
  });
});

