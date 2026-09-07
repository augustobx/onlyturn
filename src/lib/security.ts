import { createHash, randomBytes } from "node:crypto";

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
export const normalizePhone = (value: string) => value.replace(/\D/g, "");
export const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() || null;
