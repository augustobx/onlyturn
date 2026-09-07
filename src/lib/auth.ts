import "server-only";
import argon2 from "argon2";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { platformDb } from "./db";
import { randomToken, sha256 } from "./security";
import { findTenantOwnership, getRequestHostname } from "./tenant-context";
import { isPlatformHostname } from "./hostnames";
import { reconcileTenantMembership } from "./membership";

const COOKIE_NAME = "ot_session";
const SESSION_DAYS = 14;
const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 86_400;

export async function createSession(userId: string, tenantId: string | null) {
  const token = randomToken();
  const now = new Date();

  await platformDb.$transaction([
    platformDb.session.deleteMany({ where: { userId, expiresAt: { lte: now } } }),
    platformDb.session.create({
      data: {
        id: randomToken(18),
        userId,
        tenantId,
        tokenHash: sha256(token),
        expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000),
      },
    }),
  ]);

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    priority: "high",
  });
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  return platformDb.session.findFirst({
    where: {
      tokenHash: sha256(token),
      expiresAt: { gt: new Date() },
      user: { isActive: true },
    },
    include: { user: true, tenant: true },
  });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireTenantSession() {
  const hostname = await getRequestHostname();
  const requestTenant = await findTenantOwnership(hostname);

  if (!requestTenant || requestTenant.isPlatform) redirect("/login");

  const access = await reconcileTenantMembership(requestTenant.id);
  if (!access?.allowed) redirect("/suspendido");

  const session = await getSession();
  if (!session || session.tenantId !== requestTenant.id || !session.tenant) redirect("/login");

  const membership = await platformDb.membership.findUnique({
    where: { tenantId_userId: { tenantId: requestTenant.id, userId: session.userId } },
  });
  if (!membership?.isActive) redirect("/login");

  return { session, membership, tenant: session.tenant };
}

export async function requireSuperAdmin() {
  const hostname = await getRequestHostname();
  if (!isPlatformHostname(hostname)) redirect("/login");

  const session = await getSession();
  if (!session || !session.user.isSuperAdmin || session.tenantId) redirect("/superadmin/login");
  return session;
}

export async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) await platformDb.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(COOKIE_NAME);
}
