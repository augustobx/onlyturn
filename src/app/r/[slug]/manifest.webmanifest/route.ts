import { NextResponse } from "next/server";
import { getPublicTenant } from "@/lib/booking-service";
import { resolvePublicTheme, type PublicBranding } from "@/lib/public-themes";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const branding = tenant.branding as PublicBranding;
  const theme = resolvePublicTheme(branding);
  const icons = branding.logoUrl
    ? [{ src: branding.logoUrl, sizes: "512x512", purpose: "any maskable" }]
    : [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }];

  return NextResponse.json({
    name: `${tenant.name} · Turnos`,
    short_name: tenant.name,
    description: `Reservas online de ${tenant.name}, gestionadas con OnlyTurn`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: theme.background,
    theme_color: theme.primary,
    lang: "es-AR",
    categories: ["business", "productivity"],
    icons,
  }, {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" },
  });
}
