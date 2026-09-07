import type { Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import { platformDb } from "@/lib/db";
import { reconcileTenantMembership } from "@/lib/membership";
import { resolvePublicTheme, type PublicBranding } from "@/lib/public-themes";

export async function generateViewport({ params }: { params: Promise<{ slug: string }> }): Promise<Viewport> {
  const { slug } = await params;
  const tenant = await platformDb.tenant.findUnique({ where: { slug }, select: { branding: true } });
  const theme = resolvePublicTheme((tenant?.branding ?? {}) as PublicBranding);
  return { themeColor: theme.primary, colorScheme: theme.dark ? "dark" : "light" };
}

export default async function PublicTenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await platformDb.tenant.findUnique({
    where: { slug },
    select: { id: true, archivedAt: true },
  });

  if (!tenant || tenant.archivedAt) notFound();

  const access = await reconcileTenantMembership(tenant.id);
  if (!access?.allowed) redirect("/suspendido");

  return children;
}
