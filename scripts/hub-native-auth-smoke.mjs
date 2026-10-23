import assert from "node:assert/strict";
import http from "node:http";
import { createHmac, randomUUID } from "node:crypto";
assert.equal(process.env.HUB_MANAGEMENT_TEST_ALLOW_MUTATIONS, "isolated-only");
assert.equal(new URL(process.env.DATABASE_URL).hostname, "hub-test-db");
const product = process.env.HUB_MANAGEMENT_TEST_PRODUCT;
const base = "http://127.0.0.1:3000", path = "/api/integrations/nanolabs/management", key = process.env.HUB_MANAGEMENT_TOKEN, actor = "isolated-qa";
function signed(method, suffix, body) {
  const time = String(Date.now());
  return { "Content-Type": "application/json", Authorization: "Bearer " + key, "X-NanoLabs-Actor": actor, "X-NanoLabs-Timestamp": time, "X-NanoLabs-Signature": createHmac("sha256", key).update([time, method, path + suffix, actor, body].join("\n")).digest("hex") };
}
const list = await (await fetch(base + "/api/integrations/nanolabs/tenants", { headers: { Authorization: "Bearer " + process.env.HUB_INTEGRATION_TOKEN } })).json();
const fixture = list.tenants.find(t => t.name === "Renamed QA company");
assert.ok(fixture);
const suffix = "?" + new URLSearchParams({ resource: "tenant", tenantId: fixture.id });
const tenant = (await (await fetch(base + path + suffix, { headers: signed("GET", suffix, "") })).json()).data;
const email = tenant.admins[0].email, password = "Changed-password-" + tenant.slug.split("-").at(-1), host = tenant.slug + ".fixture.invalid";
function request(url, method = "GET", body = "", headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port: 3000, path: url, method, headers: { Host: host, ...headers, ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}) } }, res => {
      let text = ""; res.on("data", chunk => text += chunk); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text }));
    }); req.on("error", reject); req.end(body);
  });
}
let login;
if (product === "onlygym") {
  login = await request("/api/tenant-auth/sign-in", "POST", JSON.stringify({ identifier: email, password }), { "Content-Type": "application/json", Origin: "http://localhost:3000" });
  assert.equal(login.status, 200);
} else {
  const page = await request("/login"); assert.equal(page.status, 200);
  const decode = s => s.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
  const form = new URLSearchParams();
  for (const match of page.text.matchAll(/<input\b[^>]*>/g)) {
    const tag = match[0], name = tag.match(/name="([^"]*)"/)?.[1], value = tag.match(/value="([^"]*)"/)?.[1];
    if (name?.startsWith("$ACTION_")) form.append(decode(name), decode(value || ""));
  }
  assert.ok(form.size > 0); form.set("email", email); form.set("password", password);
  const boundary = "----NanoLabsFixture" + randomUUID();
  const multipart = Array.from(form.entries()).map(([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`).join("") + `--${boundary}--\r\n`;
  login = await request("/login", "POST", multipart, { "Content-Type": "multipart/form-data; boundary=" + boundary, Origin: "http://" + host });
  // A progressively enhanced action can return a streamed redirect with HTTP 200.
  assert.ok([200, 303, 307].includes(login.status));
}
const setCookies = login.headers["set-cookie"] || [];
if (!setCookies.length) {
  console.log(JSON.stringify({ product, nativeLoginStatus: login.status, badCredentials: login.text.includes("Credenciales incorrectas"), invalidForm: login.text.includes("Ingresá un email"), suspended: login.text.includes("se encuentra suspendido") }));
}
assert.ok(setCookies.length > 0, "native login did not create a session");
const cookie = setCookies.map(s => s.split(";")[0]).join("; ");
if (product === "onlygym") {
  const session = JSON.parse((await request("/api/auth/get-session", "GET", "", { Cookie: cookie })).text);
  assert.equal(session.user.email, email);
} else {
  const dashboard = await request("/dashboard", "GET", "", { Cookie: cookie });
  assert.ok(dashboard.status === 200 || ([303, 307].includes(dashboard.status) && String(dashboard.headers.location).includes("onboarding")));
  assert.ok(!dashboard.text.includes("url=/login"));
}
const command = JSON.stringify({ requestId: randomUUID(), actor, operation: "admin.revoke", input: { tenantId: tenant.id, version: tenant.version, userId: tenant.admins[0].id } });
assert.equal((await fetch(base + path, { method: "POST", headers: signed("POST", "", command), body: command })).status, 200);
if (product === "onlygym") {
  const session = JSON.parse((await request("/api/auth/get-session", "GET", "", { Cookie: cookie })).text);
  assert.ok(!session?.session);
} else {
  const denied = await request("/dashboard", "GET", "", { Cookie: cookie });
  assert.ok([303, 307].includes(denied.status) || denied.text.includes("url=/login"));
}
console.log(JSON.stringify({ product, result: "NATIVE_LOGIN_AND_SESSION_REVOCATION_PASS" }));

