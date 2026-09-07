export function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function platformHostname(): string {
  return normalizeHostname(process.env.PLATFORM_HOST || "onlyturn.nanoapps.ar");
}

export function tenantBaseDomain(): string {
  return normalizeHostname(process.env.TENANT_BASE_DOMAIN || "nanoapps.ar");
}

export function isLocalHostname(rawHostname: string): boolean {
  const hostname = normalizeHostname(rawHostname);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
}

export function isPlatformHostname(rawHostname: string): boolean {
  const hostname = normalizeHostname(rawHostname);
  return !hostname || hostname === platformHostname() || isLocalHostname(hostname);
}

export function tenantSlugFromHostname(rawHostname: string): string | null {
  const hostname = normalizeHostname(rawHostname);
  const suffix = `.${tenantBaseDomain()}`;

  if (!hostname.endsWith(suffix)) return null;

  const slug = hostname.slice(0, -suffix.length);
  if (!slug || slug.includes(".") || slug === "onlyturn") return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return slug;
}

export function tenantPublicUrl(slug: string): string {
  return `https://${slug}.${tenantBaseDomain()}`;
}
