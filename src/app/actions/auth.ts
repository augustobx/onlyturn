"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { platformDb } from "@/lib/db";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";

export async function loginAction(_: { error?: string } | undefined, formData: FormData) {
  const parsed = z.object({ email: z.email(), password: z.string().min(8) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Ingresá un email y contraseña válidos." };
  const user = await platformDb.user.findUnique({ where: { email: parsed.data.email.toLowerCase() }, include: { memberships: { where: { isActive: true }, take: 1 } } });
  if (!user?.isActive || !await verifyPassword(user.passwordHash, parsed.data.password)) return { error: "Credenciales incorrectas." };
  const tenantId = user.isSuperAdmin && !user.memberships[0] ? null : user.memberships[0]?.tenantId ?? null;
  await createSession(user.id, tenantId);
  redirect(user.isSuperAdmin && !tenantId ? "/superadmin" : "/app");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
