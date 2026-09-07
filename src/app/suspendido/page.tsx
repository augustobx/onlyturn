import { CalendarCheck2, ShieldAlert } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { findTenantOwnership, getRequestHostname } from "@/lib/tenant-context";
import { reconcileTenantMembership } from "@/lib/membership";

export default async function SuspendedPage() {
  const hostname = await getRequestHostname();
  const tenant = await findTenantOwnership(hostname);

  if (!tenant || tenant.isPlatform) notFound();
  const access = await reconcileTenantMembership(tenant.id);
  if (access?.allowed) redirect("/");

  return <main className="login-page">
    <section className="login-visual">
      <div className="brand brand-onlyturn"><span className="brand-mark"><CalendarCheck2 size={18} /></span><span className="brand-copy"><strong>OnlyTurn</strong><small style={{color:"#bfdbfe"}}>by NanoLabs</small></span></div>
      <div>
        <span className="eyebrow">Estado del servicio</span>
        <h1>{tenant.name}</h1>
        <p>El acceso a este espacio de trabajo se encuentra temporalmente suspendido.</p>
      </div>
      <small style={{color:"#a9bfdd"}}>NanoLabs SaaS · {tenant.slug}.nanoapps.ar</small>
    </section>
    <section className="login-panel">
      <div className="form-card">
        <ShieldAlert size={34} />
        <h2>Servicio suspendido</h2>
        <p className="muted">La membresía de este negocio está vencida o suspendida. Para regularizar el servicio, comunicate con NanoLabs.</p>
      </div>
    </section>
  </main>;
}
