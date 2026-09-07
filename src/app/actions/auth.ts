"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { platformDb } from "@/lib/db";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { findTenantOwnership, getRequestHostname } from "@/lib/tenant-context";
import { isPlatformHostname } from "@/lib/hostnames";
import { reconcileTenantMembership } from "@/lib/membership";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export async function loginAction(_: { error?: string } | undefined, formData: FormData) {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Ingresá un email y contraseña válidos." };

  const hostname = await getRequestHostname();
  const tenant = await findTenantOwnership(hostname);
  if (!tenant || tenant.isPlatform) return { error: "Este acceso pertenece a un tenant de OnlyTurn." };

  const access = await reconcileTenantMembership(tenant.id);
  if (!access?.allowed) return { error: "El servicio de este negocio se encuentra suspendido." };

  const user = await platformDb.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    include: {
      memberships: {
        where: { tenantId: tenant.id, isActive: true },
        take: 1,
      },
    },
  });

  if (!user?.isActive || !user.memberships[0] || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
    return { error: "Credenciales incorrectas." };
  }

  await createSession(user.id, tenant.id);
  redirect("/dashboard");
}

export async function superAdminLoginAction(_: { error?: string } | undefined, formData: FormData) {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Ingresá un email y contraseña válidos." };

  const hostname = await getRequestHostname();
  if (!isPlatformHostname(hostname)) return { error: "El SuperAdmin solo está disponible en la plataforma de OnlyTurn." };

  const user = await platformDb.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user?.isActive || !user.isSuperAdmin || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
    return { error: "Credenciales de plataforma incorrectas." };
  }

  await createSession(user.id, null);
  redirect("/superadmin");
}

export async function logoutAction() {
  const hostname = await getRequestHostname();
  const platform = isPlatformHostname(hostname);
  await destroySession();
  redirect(platform ? "/superadmin/login" : "/login");
}
