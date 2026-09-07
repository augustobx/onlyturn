import { CalendarCheck2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { findTenantOwnership, getRequestHostname, tenantHasOperationalAccess } from "@/lib/tenant-context";
import { isPlatformHostname } from "@/lib/hostnames";

export default async function LoginPage() {
  const hostname = await getRequestHostname();
  if (isPlatformHostname(hostname)) redirect("/superadmin/login");

  const tenant = await findTenantOwnership(hostname);
  if (!tenant || tenant.isPlatform) notFound();
  if (!tenantHasOperationalAccess(tenant)) redirect("/suspendido");

  const session = await getSession();
  if (session?.tenantId === tenant.id) redirect("/dashboard");

  return <main className="login-page">
    <section className="login-visual">
      <div className="brand brand-onlyturn"><span className="brand-mark"><CalendarCheck2 size={18} /></span><span className="brand-copy"><strong>OnlyTurn</strong><small style={{color:"#bfdbfe"}}>by NanoLabs</small></span></div>
      <div>
        <span className="eyebrow">Panel administrativo</span>
        <h1>{tenant.name}</h1>
        <p>Administrá turnos, disponibilidad, profesionales, recursos y clientes desde tu propio espacio de trabajo.</p>
      </div>
      <small style={{color:"#a9bfdd"}}>Acceso seguro del tenant · {tenant.slug}.nanoapps.ar</small>
    </section>
    <section className="login-panel"><LoginForm tenantName={tenant.name} /></section>
  </main>;
}
