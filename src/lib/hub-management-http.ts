import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { commandSchema, MANAGEMENT_CONTRACT, MANAGEMENT_OPERATIONS, ManagementError, type ManagementCommand } from "./hub-management-contract";

export const MANAGEMENT_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export function permittedManagementOperations() {
  const configured = (process.env.HUB_MANAGEMENT_OPERATIONS ?? MANAGEMENT_OPERATIONS.join(",")).split(",").map(value => value.trim());
  return MANAGEMENT_OPERATIONS.filter(operation => configured.includes(operation));
}
function equal(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function authenticateManagementRequest(req: Request, body: string, now = Date.now()) {
  if (process.env.HUB_MANAGEMENT_ENABLED !== "true") throw new ManagementError(503, "DISABLED", "Gestión central deshabilitada.");
  const key = process.env.HUB_MANAGEMENT_TOKEN || "";
  const supplied = req.headers.get("authorization") || "";
  const timestamp = req.headers.get("x-nanolabs-timestamp") || "";
  const actor = req.headers.get("x-nanolabs-actor") || "";
  const signature = req.headers.get("x-nanolabs-signature") || "";
  if (Buffer.byteLength(key) < 32 || !equal(supplied, "Bearer " + key) ||
      !/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300_000 ||
      !/^[a-zA-Z0-9@._:+-]{1,120}$/.test(actor) || !/^[a-f0-9]{64}$/.test(signature)) {
    throw new ManagementError(401, "UNAUTHORIZED", "Credenciales de integración inválidas.");
  }
  const url = new URL(req.url);
  const signed = [timestamp, req.method, url.pathname + url.search, actor, body].join("\n");
  if (!equal(createHmac("sha256", key).update(signed).digest("hex"), signature)) {
    throw new ManagementError(401, "UNAUTHORIZED", "Credenciales de integración inválidas.");
  }
  return { actor, key };
}
export function managementFingerprint(body: string, key: string) {
  return createHmac("sha256", key).update(body).digest("hex");
}
async function boundedBody(req: Request) {
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new ManagementError(415, "FORMAT", "Se requiere JSON.");
  const reader = req.body?.getReader();
  if (!reader) throw new ManagementError(400, "BODY", "Falta la solicitud.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 32768) { await reader.cancel(); throw new ManagementError(413, "BODY_LIMIT", "La solicitud supera el límite permitido."); }
    chunks.push(chunk.value);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
}
function failure(error: unknown) {
  if (error instanceof ManagementError) return Response.json({ success: false, code: error.code, error: error.message }, { status: error.status, headers: MANAGEMENT_HEADERS });
  if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof TypeError) return Response.json({ success: false, code: "INVALID_INPUT", error: "Datos de gestión inválidos." }, { status: 400, headers: MANAGEMENT_HEADERS });
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  return Response.json({ success: false, code: code === "P2002" ? "CONFLICT" : code === "P2025" ? "NOT_FOUND" : "UNAVAILABLE", error: code === "P2002" ? "La identidad o referencia ya está en uso." : code === "P2025" ? "Registro inexistente." : "La operación no pudo completarse." }, { status: code === "P2002" ? 409 : code === "P2025" ? 404 : 503, headers: MANAGEMENT_HEADERS });
}
export interface ManagementAdapter {
  product: "onlygym" | "onlyturn";
  read(resource: string, url: URL): Promise<unknown>;
  execute(command: ManagementCommand, fingerprint: string): Promise<unknown>;
}
export function managementHandlers(adapter: ManagementAdapter) {
  return {
    async GET(req: Request) {
      try {
        authenticateManagementRequest(req, "");
        const url = new URL(req.url), resource = url.searchParams.get("resource") || "catalog";
        const data = await adapter.read(resource, url);
        return Response.json({ success: true, contract: MANAGEMENT_CONTRACT, product: adapter.product, data }, { headers: MANAGEMENT_HEADERS });
      } catch (error) { return failure(error); }
    },
    async POST(req: Request) {
      try {
        const body = await boundedBody(req), auth = authenticateManagementRequest(req, body);
        const command = commandSchema.parse(JSON.parse(body));
        if (command.actor !== auth.actor) throw new ManagementError(403, "ACTOR", "La identidad administrativa no coincide.");
        const allowed = permittedManagementOperations();
        if (!allowed.includes(command.operation)) throw new ManagementError(403, "SCOPE", "La credencial no permite esta operación.");
        const data = await adapter.execute(command, managementFingerprint(body, auth.key));
        return Response.json({ success: true, contract: MANAGEMENT_CONTRACT, product: adapter.product, requestId: command.requestId, data }, { headers: MANAGEMENT_HEADERS });
      } catch (error) { return failure(error); }
    },
  };
}

