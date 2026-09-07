import { Shield } from "lucide-react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getRequestHostname } from "@/lib/tenant-context";
import { isPlatformHostname } from "@/lib/hostnames";
import { SuperAdminLoginForm } from "./superadmin-login-form";

export default async function SuperAdminLoginPage() {
  const hostname = await getRequestHostname();
  if (!isPlatformHostname(hostname)) redirect("/login");

  const session = await getSession();
  if (session?.user.isSuperAdmin && !session.tenantId) redirect("/superadmin");

  return (
    <main className="sa-login">
      <section className="sa-login-card">
        <div className="sa-login-brand">
          <span className="sa-login-shield"><Shield size={29} /></span>
          <span className="sa-login-badge">Plataforma NanoLabs</span>
          <h1>OnlyTurn SuperAdmin</h1>
          <p>Plano de control y administración SaaS</p>
        </div>
        <SuperAdminLoginForm />
        <div className="sa-login-foot">OnlyTurn · Aislamiento y control SaaS NanoLabs</div>
      </section>
    </main>
  );
}
