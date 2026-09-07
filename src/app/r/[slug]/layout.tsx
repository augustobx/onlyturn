import { notFound, redirect } from "next/navigation";
import { platformDb } from "@/lib/db";
import { reconcileTenantMembership } from "@/lib/membership";

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
