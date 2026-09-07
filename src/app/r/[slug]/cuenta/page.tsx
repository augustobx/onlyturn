import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPublicTenant } from "@/lib/booking-service";
import { getCustomerSession } from "@/lib/customer-auth";
import { publicThemeVariables, type PublicBranding } from "@/lib/public-themes";
import { CustomerLoginForm } from "../customer-auth-forms";

export default async function CustomerLoginPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{registered?:string}>}){
  const [{slug},query]=await Promise.all([params,searchParams]);
  const tenant=await getPublicTenant(slug);if(!tenant)notFound();
  if(await getCustomerSession(tenant.id))redirect("/mi-cuenta");
  const settings=tenant.settings as {customerRegistrationEnabled?:boolean};
  const {theme,style}=publicThemeVariables(tenant.branding as PublicBranding);
  return <main className="booking-page booking-page-v2 customer-portal" data-theme={theme.id} data-theme-mode={theme.dark?"dark":"light"} style={style as React.CSSProperties}>
    <div className="booking-wrap"><div className="public-brand"><div className="logo">{tenant.name[0]}</div><h1>Mi cuenta en {tenant.name}</h1><p className="muted">Consultá tus turnos, datos y cuenta corriente.</p></div>{query.registered==="pending"&&<p className="account-notice">Tu registro fue enviado. Podrás ingresar cuando el negocio apruebe tu cuenta.</p>}<CustomerLoginForm slug={slug}/><div className="customer-auth-links">{settings.customerRegistrationEnabled&&<Link href="/registro">Crear una cuenta</Link>}<Link href="/">Volver a reservar</Link></div></div>
  </main>
}
