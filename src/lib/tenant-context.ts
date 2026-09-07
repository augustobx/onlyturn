import "server-only";
import { headers } from "next/headers";
import { platformDb } from "./db";
import { isPlatformHostname, normalizeHostname, tenantSlugFromHostname } from "./hostnames";
import { reconcileTenantMembership } from "./membership";

export type TenantContext = {
  id: string;
  slug: string;
  name: string;
  hostname: string;
  timezone: string;
  currency: string;
  status: string;
  isPlatform?: boolean;
};

const RESOLVER_CACHE_TTL_MS = 5 * 1000;
const NEGATIVE_CACHE_TTL_MS = 2 * 1000;

type CacheEntry = {
  expiresAt: number;
  value: TenantContext | null;
};

const cache = new Map<string, CacheEntry>();

export { normalizeHostname };

export async function getRequestHostname(): Promise<string> {
  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host")?.split(",")[0];
  return normalizeHostname(forwardedHost || headerStore.get("host") || "");
}

export { isPlatformHostname };

export async function findTenantOwnership(rawHostname: string): Promise<TenantContext | null> {
  const hostname = normalizeHostname(rawHostname);
  if (!hostname) return null;

  if (isPlatformHostname(hostname)) {
    return {
      id: "platform",
      slug: "platform",
      name: "OnlyTurn · NanoLabs",
      hostname,
      timezone: "America/Argentina/Buenos_Aires",
      currency: "ARS",
      status: "ACTIVE",
      isPlatform: true,
    };
  }

  const now = Date.now();
  const cached = cache.get(hostname);
  if (cached && cached.expiresAt > now) return cached.value;

  let result: TenantContext | null = null;

  const customDomain = await platformDb.customDomain.findUnique({
    where: { hostname },
    include: { tenant: true },
  });

  if (customDomain?.verifiedAt && !customDomain.tenant.archivedAt) {
    result = {
      id: customDomain.tenant.id,
      slug: customDomain.tenant.slug,
      name: customDomain.tenant.name,
      hostname,
      timezone: customDomain.tenant.timezone,
      currency: customDomain.tenant.currency,
      status: customDomain.tenant.status,
    };
  }

  if (!result) {
    const slug = tenantSlugFromHostname(hostname);
    if (slug) {
      const tenant = await platformDb.tenant.findFirst({
        where: { slug, archivedAt: null },
      });

      if (tenant) {
        result = {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          hostname,
          timezone: tenant.timezone,
          currency: tenant.currency,
          status: tenant.status,
        };
      }
    }
  }

  // El ownership se conserva aunque la membresía venza, pero el estado operativo
  // se concilia aquí para que tanto el router como la experiencia pública respeten
  // la suspensión sin esperar un nuevo login administrativo.
  if (result && ["ACTIVE", "TRIAL"].includes(result.status)) {
    const membership = await reconcileTenantMembership(result.id);
    if (membership && !membership.allowed) result = { ...result, status: "SUSPENDED" };
  }

  if (cache.size >= 1000) cache.clear();

  cache.set(hostname, {
    value: result,
    expiresAt: now + (result ? RESOLVER_CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
  });

  return result;
}

export function tenantHasOperationalAccess(tenant: Pick<TenantContext, "status">): boolean {
  return tenant.status === "ACTIVE" || tenant.status === "TRIAL";
}

export function clearTenantResolutionCache() {
  cache.clear();
}
