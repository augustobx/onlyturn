import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPublicTenant } from "@/lib/booking-service";
import { getCustomerSession } from "@/lib/customer-auth";
import { publicThemeVariables, type PublicBranding } from "@/lib/public-themes";
import { CustomerRegisterForm } from "../customer-auth-forms";

export default async function CustomerRegistrationPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const tenant=await getPublicTenant(slug);if(!tenant)notFound();
  if(await getCustomerSession(tenant.id))redirect("/mi-cuenta");
  const settings=tenant.settings as {customerRegistrationEnabled?:boolean;customerApprovalRequired?:boolean};
  const {theme,style}=publicThemeVariables(tenant.branding as PublicBranding);
  if(!settings.customerRegistrationEnabled)return <main className="booking-page booking-page-v2 customer-portal" data-theme={theme.id} data-theme-mode={theme.dark?"dark":"light"} style={style as React.CSSProperties}><div className="booking-wrap"><div className="wizard success"><h1>Registro no disponible</h1><p className="muted">Este negocio no tiene habilitado el registro público de clientes.</p><Link className="button" href="/">Volver</Link></div></div></main>;
  return <main className="booking-page booking-page-v2 customer-portal" data-theme={theme.id} data-theme-mode={theme.dark?"dark":"light"} style={style as React.CSSProperties}><div className="booking-wrap"><div className="public-brand"><div className="logo">{tenant.name[0]}</div><h1>Crear mi cuenta</h1><p className="muted">{settings.customerApprovalRequired?"El negocio revisará tu solicitud antes de habilitarla.":"Accedé a tu historial y perfil después de registrarte."}</p></div><CustomerRegisterForm slug={slug}/><div className="customer-auth-links"><Link href="/cuenta">Ya tengo una cuenta</Link><Link href="/">Volver a reservar</Link></div></div></main>
}
