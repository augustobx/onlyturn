import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPublicTenant } from "@/lib/booking-service";
import { getCustomerSession } from "@/lib/customer-auth";
import { CustomerLoginForm } from "../customer-auth-forms";

export default async function CustomerLoginPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{registered?:string}>}){const [{slug},query]=await Promise.all([params,searchParams]);const tenant=await getPublicTenant(slug);if(!tenant)notFound();if(await getCustomerSession(tenant.id))redirect(`/r/${slug}/mi-cuenta`);const settings=tenant.settings as {customerRegistrationEnabled?:boolean};return <main className="booking-page customer-portal"><div className="booking-wrap"><div className="public-brand"><div className="logo">{tenant.name[0]}</div><h1>Mi cuenta en {tenant.name}</h1><p className="muted">Consultá tus turnos, datos y cuenta corriente.</p></div>{query.registered==="pending"&&<p className="account-notice">Tu registro fue enviado. Podrás ingresar cuando el negocio apruebe tu cuenta.</p>}<CustomerLoginForm slug={slug}/><div className="customer-auth-links">{settings.customerRegistrationEnabled&&<Link href={`/r/${slug}/registro`}>Crear una cuenta</Link>}<Link href={`/r/${slug}`}>Volver a reservar</Link></div></div></main>}
