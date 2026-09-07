import "server-only";
import { headers } from "next/headers";
import { platformDb } from "./db";

export type TenantContext = {
  id: string;
  slug: string;
  name: string;
  hostname: string;
  timezone: string;
  currency: string;
  isPlatform?: boolean;
};

const PLATFORM_HOST = (process.env.PLATFORM_HOST || "onlyturn.nanoapps.ar").toLowerCase();
const BASE_DOMAIN = (process.env.TENANT_BASE_DOMAIN || "nanoapps.ar").toLowerCase();

const RESOLVER_CACHE_TTL_MS = 5 * 1000;
const NEGATIVE_CACHE_TTL_MS = 2 * 1000;

type CacheEntry = {
  expiresAt: number;
  value: TenantContext | null;
};

const cache = new Map<string, CacheEntry>();

export function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export async function getRequestHostname(): Promise<string> {
  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host")?.split(",")[0];
  return normalizeHostname(forwardedHost || headerStore.get("host") || "");
}

export function isPlatformHostname(hostname: string): boolean {
  const norm = normalizeHostname(hostname);
  if (!norm) return true;
  if (norm === PLATFORM_HOST || norm === "localhost" || norm === "127.0.0.1") return true;
  if (norm.startsWith("localhost:") || norm.startsWith("127.0.0.1:")) return true;
  return false;
}

export async function findTenantOwnership(rawHostname: string): Promise<TenantContext | null> {
  const hostname = normalizeHostname(rawHostname);
  if (!hostname) return null;

  if (isPlatformHostname(hostname)) {
    return {
      id: "platform",
      slug: "platform",
      name: "OnlyTurn Platform",
      hostname,
      timezone: "America/Argentina/Buenos_Aires",
      currency: "ARS",
      isPlatform: true,
    };
  }

  const now = Date.now();
  const cached = cache.get(hostname);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  let result: TenantContext | null = null;

  // 1. Check custom verified domains
  const customDomain = await platformDb.customDomain.findUnique({
    where: { hostname },
    include: { tenant: true },
  });

  if (customDomain && ["ACTIVE", "TRIAL"].includes(customDomain.tenant.status)) {
    result = {
      id: customDomain.tenant.id,
      slug: customDomain.tenant.slug,
      name: customDomain.tenant.name,
      hostname,
      timezone: customDomain.tenant.timezone,
      currency: customDomain.tenant.currency,
    };
  }

  // 2. Check wildcard subdomain on onlyturn.nanoapps.ar or nanoapps.ar
  if (!result) {
    let slug: string | null = null;
    const onlyturnSuffix = `.onlyturn.${BASE_DOMAIN}`;
    const baseSuffix = `.${BASE_DOMAIN}`;

    if (hostname.endsWith(onlyturnSuffix)) {
      slug = hostname.slice(0, -onlyturnSuffix.length);
    } else if (hostname.endsWith(baseSuffix)) {
      slug = hostname.slice(0, -baseSuffix.length);
    }

    if (slug && !slug.includes(".") && slug !== "onlyturn") {
      const tenant = await platformDb.tenant.findFirst({
        where: { slug, status: { in: ["ACTIVE", "TRIAL"] }, archivedAt: null },
      });

      if (tenant) {
        result = {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          hostname,
          timezone: tenant.timezone,
          currency: tenant.currency,
        };
      }
    }
  }

  if (cache.size >= 1000) {
    cache.clear();
  }

  cache.set(hostname, {
    value: result,
    expiresAt: now + (result ? RESOLVER_CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
  });

  return result;
}

export function clearTenantResolutionCache() {
  cache.clear();
}
