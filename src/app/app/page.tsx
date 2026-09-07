import { fromZonedTime } from "date-fns-tz";
import { requireTenantSession } from "@/lib/auth";
import { createTenantDb } from "@/lib/tenant-db";
import { redirect } from "next/navigation";

const labels: Record<string,string> = { CONFIRMED:"Confirmado",PENDING:"Pendiente",COMPLETED:"Completado",CANCELLED:"Cancelado",NO_SHOW:"Ausente",CHECKED_IN:"Llegó",IN_PROGRESS:"En atención" };
export default async function DashboardPage() {
  const { membership, tenant } = await requireTenantSession();
  if (!tenant.onboardingDone) redirect("/app/onboarding");
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: tenant.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { bookings, newCustomers } = await createTenantDb(membership.tenantId).dashboard(fromZonedTime(`${localDate}T00:00:00`, tenant.timezone), fromZonedTime(`${localDate}T23:59:59.999`, tenant.timezone));
  const active = bookings.filter((b)=>!["CANCELLED","NO_SHOW"].includes(b.status));
  const revenue = bookings.filter((b)=>b.status==="COMPLETED").reduce((n,b)=>n+(b.priceCents??0),0);
  const formatter = new Intl.NumberFormat("es-AR",{style:"currency",currency:tenant.currency,maximumFractionDigits:0});
  return <><div className="page-title"><span className="eyebrow">Hoy</span><h1>Tu negocio de un vistazo</h1><p className="muted">Lo importante para organizar el día.</p></div>
    <section className="grid stats">
      <div className="card stat"><span className="muted">Turnos de hoy</span><strong>{active.length}</strong><span className="delta">Agenda actualizada</span></div>
      <div className="card stat"><span className="muted">Completados</span><strong>{bookings.filter(b=>b.status==="COMPLETED").length}</strong><span className="muted" style={{fontSize:12}}>en el día</span></div>
      <div className="card stat"><span className="muted">Ingresos estimados</span><strong>{formatter.format(revenue/100)}</strong><span className="muted" style={{fontSize:12}}>turnos completados</span></div>
      <div className="card stat"><span className="muted">Clientes nuevos</span><strong>{newCustomers}</strong><span className="muted" style={{fontSize:12}}>hoy</span></div>
    </section>
    <section className="grid two-col"><div className="card"><div className="section-head"><h2>Próximos turnos</h2><a className="pill" href="/app/agenda">Ver agenda</a></div>{active.length?active.slice(0,7).map(b=><div className="booking-row" key={b.id}><div className="time">{new Intl.DateTimeFormat("es-AR",{hour:"2-digit",minute:"2-digit",timeZone:tenant.timezone}).format(b.startsAt)}</div><div><strong><span className="dot" style={{background:b.service.color}}/>{b.customer.firstName} {b.customer.lastName}</strong><div className="muted" style={{fontSize:12}}>{b.service.name} · {b.professional?.name??b.resource?.name??"Sin asignar"}</div></div><span className={`status ${b.status}`}>{labels[b.status]}</span></div>):<div className="empty">No hay turnos para hoy.</div>}</div>
      <div className="card"><div className="section-head"><h2>Estado del día</h2></div><div style={{display:"grid",gap:16}}><div><div className="muted" style={{fontSize:12}}>Ocupación</div><strong style={{fontSize:28}}>{active.length ? Math.min(100,Math.round(active.length/12*100)) : 0}%</strong></div><div><div className="muted" style={{fontSize:12}}>Cancelaciones</div><strong style={{fontSize:24}}>{bookings.filter(b=>b.status==="CANCELLED").length}</strong></div><div><div className="muted" style={{fontSize:12}}>Ausencias</div><strong style={{fontSize:24}}>{bookings.filter(b=>b.status==="NO_SHOW").length}</strong></div></div></div></section>
  </>;
}
