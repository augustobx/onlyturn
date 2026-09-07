import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import argon2 from "argon2";
import { platformDb } from "./db";
import { randomToken, sha256 } from "./security";

const COOKIE_NAME = "ot_session";
const SESSION_DAYS = 14;

export async function createSession(userId: string, tenantId: string | null) {
  const token = randomToken();
  await platformDb.session.create({ data: {
    id: randomToken(18), userId, tenantId, tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000)
  }});
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true",
    path: "/", maxAge: SESSION_DAYS * 86_400
  });
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return platformDb.session.findFirst({
    where: { tokenHash: sha256(token), expiresAt: { gt: new Date() }, user: { isActive: true } },
    include: { user: true, tenant: true }
  });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireTenantSession() {
  const session = await requireSession();
  if (!session.tenantId || !session.tenant || !["ACTIVE", "TRIAL"].includes(session.tenant.status)) redirect("/login");
  const membership = await platformDb.membership.findUnique({
    where: { tenantId_userId: { tenantId: session.tenantId, userId: session.userId } }
  });
  if (!membership?.isActive) redirect("/login");
  return { session, membership, tenant: session.tenant };
}

export async function requireSuperAdmin() {
  const session = await requireSession();
  if (!session.user.isSuperAdmin) redirect("/app");
  return session;
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) await platformDb.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE_NAME);
}
