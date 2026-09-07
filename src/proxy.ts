import { NextRequest, NextResponse } from "next/server";
import { isPlatformHostname, normalizeHostname, tenantSlugFromHostname } from "@/lib/hostnames";

const PUBLIC_TENANT_PATHS = new Set(["/", "/cuenta", "/mi-cuenta", "/registro", "/payment"]);
const TENANT_ADMIN_PREFIXES = [
  "/agenda",
  "/clientes",
  "/configuracion",
  "/apariencia",
  "/disponibilidad",
  "/sesiones",
  "/recurrencias",
  "/lista-espera",
  "/extras",
  "/paquetes",
  "/politicas",
  "/automatizaciones",
  "/calendario",
  "/reportes",
  "/onboarding",
];

function tenantAdminInternalPath(pathname: string): string | null {
  if (pathname === "/dashboard") return "/app";
  if (pathname === "/servicios") return "/app/catalogo";
  if (pathname.startsWith("/servicios/")) return `/app/catalogo${pathname.slice("/servicios".length)}`;
  if (TENANT_ADMIN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return `/app${pathname}`;
  return null;
}

function canonicalTenantPath(pathname: string): string {
  if (pathname === "/app") return "/dashboard";
  if (pathname === "/app/catalogo") return "/servicios";
  if (pathname.startsWith("/app/catalogo/")) return `/servicios${pathname.slice("/app/catalogo".length)}`;
  return pathname.replace(/^\/app/, "") || "/dashboard";
}

function withTenantHeader(request: NextRequest, slug: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-onlyturn-tenant-slug", slug);
  return requestHeaders;
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname === "/favicon.ico") return NextResponse.next();

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0];
  const hostname = normalizeHostname(forwardedHost || request.headers.get("host") || "");

  if (isPlatformHostname(hostname)) {
    if (pathname === "/login") return NextResponse.redirect(new URL("/superadmin/login", request.url));
    if (pathname === "/app" || pathname.startsWith("/app/")) return NextResponse.redirect(new URL("/superadmin", request.url));
    return NextResponse.next();
  }

  const slug = tenantSlugFromHostname(hostname);
  if (!slug) return NextResponse.next();
  if (pathname.startsWith("/superadmin")) return NextResponse.redirect(new URL("/login", request.url));

  if (pathname === "/app" || pathname.startsWith("/app/")) return NextResponse.redirect(new URL(canonicalTenantPath(pathname), request.url));
  if (pathname === "/catalogo" || pathname.startsWith("/catalogo/")) {
    const target = pathname === "/catalogo" ? "/servicios" : `/servicios${pathname.slice("/catalogo".length)}`;
    return NextResponse.redirect(new URL(target, request.url));
  }
  if (pathname === "/login" || pathname === "/suspendido") return NextResponse.next();

  if (pathname === "/manifest.webmanifest") {
    const url = request.nextUrl.clone();
    url.pathname = `/r/${slug}/manifest.webmanifest`;
    return NextResponse.rewrite(url, { request: { headers: withTenantHeader(request, slug) } });
  }

  const adminPath = tenantAdminInternalPath(pathname);
  if (adminPath) {
    const url = request.nextUrl.clone();
    url.pathname = adminPath;
    return NextResponse.rewrite(url, { request: { headers: withTenantHeader(request, slug) } });
  }

  if (PUBLIC_TENANT_PATHS.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? `/r/${slug}` : `/r/${slug}${pathname}`;
    return NextResponse.rewrite(url, { request: { headers: withTenantHeader(request, slug) } });
  }

  if (pathname.startsWith("/r/")) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
