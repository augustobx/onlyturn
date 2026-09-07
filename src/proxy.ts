import { NextRequest, NextResponse } from "next/server";
import { isPlatformHostname, normalizeHostname, tenantSlugFromHostname } from "@/lib/hostnames";

const PUBLIC_TENANT_PATHS = new Set(["/", "/cuenta", "/mi-cuenta", "/registro", "/payment"]);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/app") ||
    pathname.startsWith("/superadmin") ||
    pathname.startsWith("/r/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0];
  const hostname = normalizeHostname(forwardedHost || request.headers.get("host") || "");

  if (isPlatformHostname(hostname)) return NextResponse.next();

  const slug = tenantSlugFromHostname(hostname);
  if (!slug || !PUBLIC_TENANT_PATHS.has(pathname)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? `/r/${slug}` : `/r/${slug}${pathname}`;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-onlyturn-tenant-slug", slug);

  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
