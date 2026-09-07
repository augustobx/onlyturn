import Link from "next/link";
import { BadgeCheck, Clock3, ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getPublicTenant } from "@/lib/booking-service";
import { getCustomerSession } from "@/lib/customer-auth";
import { publicThemeVariables, type PublicBranding } from "@/lib/public-themes";
import { CustomerLoginForm } from "../customer-auth-forms";

export default async function CustomerLoginPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{registered?:string}>}){
  const [{slug},query]=await Promise.all([params,searchParams]);
  const tenant=await getPublicTenant(slug);if(!tenant)notFound();
  if(await getCustomerSession(tenant.id))redirect("/mi-cuenta");
  const settings=tenant.settings as {
    customerRegistrationEnabled?:boolean;
    customerPendingTitle?:string;
    customerPendingMessage?:string;
  };
  const {theme,style}=publicThemeVariables(tenant.branding as PublicBranding);
  const pendingTitle=settings.customerPendingTitle?.trim()||"Tu cuenta está en verificación";
  const pendingMessage=settings.customerPendingMessage?.trim()||`Recibimos tu registro correctamente. El equipo de ${tenant.name} va a revisarlo y, en breve, tu cuenta quedará habilitada para acceder a los servicios y gestionar tus reservas.`;
  const justRegistered=query.registered==="pending";
  return <main className="booking-page booking-page-v2 customer-portal" data-theme={theme.id} data-theme-mode={theme.dark?"dark":"light"} style={style as React.CSSProperties}>
    <div className="booking-wrap">
      {justRegistered ? <section className="verification-pending-card card">
        <div className="verification-icon"><ShieldCheck size={30}/></div>
        <span className="registration-welcome-badge">Registro recibido</span>
        <h1>{pendingTitle}</h1>
        <p>{pendingMessage}</p>
        <div className="verification-steps">
          <div><BadgeCheck size={18}/><span><strong>Tu registro fue enviado</strong><small>Ya recibimos tus datos correctamente.</small></span></div>
          <div><Clock3 size={18}/><span><strong>Estamos revisando tu cuenta</strong><small>No necesitás volver a registrarte.</small></span></div>
          <div><ShieldCheck size={18}/><span><strong>Cuando sea aprobada podrás ingresar</strong><small>Usá el mismo email y contraseña que acabás de crear.</small></span></div>
        </div>
        <div className="registration-welcome-actions"><Link className="button" href="/">Volver al inicio</Link><Link className="button secondary" href="/cuenta">Ir al ingreso</Link></div>
      </section> : <>
        <div className="public-brand"><div className="logo">{tenant.name[0]}</div><h1>Mi cuenta en {tenant.name}</h1><p className="muted">Consultá tus turnos, datos y cuenta corriente.</p></div>
        <CustomerLoginForm slug={slug}/>
        <div className="customer-auth-links">{settings.customerRegistrationEnabled&&<Link href="/registro">Crear una cuenta</Link>}<Link href="/">Volver a reservar</Link></div>
      </>}
    </div>
  </main>
}
