import { NextRequest, NextResponse } from "next/server";

const PLATFORM_HOST = (process.env.PLATFORM_HOST || "onlyturn.nanoapps.ar").toLowerCase();
const BASE_DOMAIN = (process.env.TENANT_BASE_DOMAIN || "nanoapps.ar").toLowerCase();

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets, API routes, internal Next.js routes, and platform admin routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/app") ||
    pathname.startsWith("/superadmin") ||
    pathname.startsWith("/r/")
  ) {
    return NextResponse.next();
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0];
  const hostname = (forwardedHost || request.headers.get("host") || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");

  // Platform root or development localhost
  if (!hostname || hostname === PLATFORM_HOST || hostname === "localhost" || hostname === "127.0.0.1") {
    return NextResponse.next();
  }

  // Extract tenant slug from subdomain
  let slug: string | null = null;
  const onlyturnSuffix = `.onlyturn.${BASE_DOMAIN}`;
  const baseSuffix = `.${BASE_DOMAIN}`;

  if (hostname.endsWith(onlyturnSuffix)) {
    slug = hostname.slice(0, -onlyturnSuffix.length);
  } else if (hostname.endsWith(baseSuffix)) {
    slug = hostname.slice(0, -baseSuffix.length);
  }

  if (slug && !slug.includes(".") && slug !== "onlyturn") {
    // Rewrite root and tenant customer portal routes
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = `/r/${slug}`;
      return NextResponse.rewrite(url);
    }

    if (
      pathname === "/cuenta" ||
      pathname === "/mi-cuenta" ||
      pathname === "/registro" ||
      pathname === "/payment"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `/r/${slug}${pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
