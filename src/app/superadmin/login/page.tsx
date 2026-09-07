import { CalendarCheck2, ShieldCheck } from "lucide-react";
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

  return <main className="login-page">
    <section className="login-visual">
      <div className="brand brand-onlyturn"><span className="brand-mark"><CalendarCheck2 size={18} /></span><span className="brand-copy"><strong>OnlyTurn</strong><small style={{color:"#bfdbfe"}}>by NanoLabs</small></span></div>
      <div>
        <span className="eyebrow">Administración SaaS</span>
        <h1>Control global de OnlyTurn.</h1>
        <p>Gestioná tenants, planes, trials, suscripciones y estado operativo desde la consola de plataforma.</p>
      </div>
      <small style={{color:"#a9bfdd",display:"flex",alignItems:"center",gap:6}}><ShieldCheck size={14} /> Acceso exclusivo NanoLabs</small>
    </section>
    <section className="login-panel"><SuperAdminLoginForm /></section>
  </main>;
}
