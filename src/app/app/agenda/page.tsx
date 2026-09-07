import { addDays, addMonths, format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { BookingStatus } from "@prisma/client";
import { requireTenantSession } from "@/lib/auth";
import { createTenantDb } from "@/lib/tenant-db";
import { createManualBookingAction } from "@/app/actions/bookings";
import { InteractiveCalendar } from "./interactive-calendar";

const mutableStatuses = [["PENDING","Pendiente"],["CONFIRMED","Confirmado"],["CHECKED_IN","Llegó"],["IN_PROGRESS","En atención"],["COMPLETED","Completado"],["NO_SHOW","Ausente"],["CANCELLED","Cancelar"]] as const;
const validStatuses = new Set(mutableStatuses.map(([value])=>value));

type Query = { date?: string; view?: string; locationId?: string; serviceId?: string; professionalId?: string; resourceId?: string; status?: string };

export default async function AgendaPage({searchParams}:{searchParams:Promise<Query>}) {
  const { membership, tenant } = await requireTenantSession();
  const query = await searchParams;
  const today = formatInTimeZone(new Date(),tenant.timezone,"yyyy-MM-dd");
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(query.date ?? "") ? query.date! : today;
  const view = ["day","week","month"].includes(query.view ?? "") ? query.view! : "week";
  const anchor = new Date(`${selectedDate}T12:00:00Z`);
  const endAnchor = view === "day" ? addDays(anchor,1) : view === "month" ? addMonths(anchor,1) : addDays(anchor,7);
  const from = fromZonedTime(`${selectedDate}T00:00:00`,tenant.timezone);
  const to = fromZonedTime(`${format(endAnchor,"yyyy-MM-dd")}T00:00:00`,tenant.timezone);
  const tenantDb = createTenantDb(membership.tenantId);
  const catalog = await tenantDb.catalog();
  const [locations, services, professionals, resources] = catalog;
  const filters = {
    ...(locations.some(x=>x.id===query.locationId)?{locationId:query.locationId}:{}),
    ...(services.some(x=>x.id===query.serviceId)?{serviceId:query.serviceId}:{}),
    ...(professionals.some(x=>x.id===query.professionalId)?{professionalId:query.professionalId}:{}),
    ...(resources.some(x=>x.id===query.resourceId)?{resourceId:query.resourceId}:{}),
    ...(validStatuses.has(query.status as BookingStatus)?{status:query.status as BookingStatus}:{})
  };
  const bookings = await tenantDb.agenda(from,to,filters);
  const nav = (direction:number) => {
    const shifted = view === "month" ? addMonths(anchor,direction) : addDays(anchor,direction * (view === "day" ? 1 : 7));
    return `/app/agenda?${new URLSearchParams({date:format(shifted,"yyyy-MM-dd"),view}).toString()}`;
  };

  return <>
    <div className="page-title"><span className="eyebrow">Operación</span><h1>Agenda</h1><p className="muted">Del {formatInTimeZone(from,tenant.timezone,"dd/MM/yyyy")} al {formatInTimeZone(addDays(to,-1),tenant.timezone,"dd/MM/yyyy")}.</p></div>
    <div className="card" style={{marginBottom:18}}>
      <form method="get" style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"end"}}>
        <div className="field" style={{margin:0}}><label>Fecha inicial</label><input className="input" name="date" type="date" defaultValue={selectedDate}/></div>
        <div className="field" style={{margin:0}}><label>Vista</label><select className="select" name="view" defaultValue={view}><option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option></select></div>
        <div className="field" style={{margin:0}}><label>Sede</label><select className="select" name="locationId" defaultValue={query.locationId??""}><option value="">Todas</option>{locations.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></div>
        <div className="field" style={{margin:0}}><label>Servicio</label><select className="select" name="serviceId" defaultValue={query.serviceId??""}><option value="">Todos</option>{services.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></div>
        <div className="field" style={{margin:0}}><label>Profesional</label><select className="select" name="professionalId" defaultValue={query.professionalId??""}><option value="">Todos</option>{professionals.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></div>
        <div className="field" style={{margin:0}}><label>Recurso</label><select className="select" name="resourceId" defaultValue={query.resourceId??""}><option value="">Todos</option>{resources.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></div>
        <div className="field" style={{margin:0}}><label>Estado</label><select className="select" name="status" defaultValue={query.status??""}><option value="">Todos</option>{mutableStatuses.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></div>
        <button className="button">Aplicar</button><a className="button ghost" href="/app/agenda">Limpiar</a>
      </form>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:14}}><a className="button secondary" href={nav(-1)}>← Anterior</a><a className="button ghost" href={`/app/agenda?date=${today}&view=${view}`}>Hoy</a><a className="button secondary" href={nav(1)}>Siguiente →</a></div>
    </div>
    <details className="card" style={{marginBottom:18}}><summary style={{cursor:"pointer",fontWeight:750}}>Crear turno manual</summary><form action={createManualBookingAction} className="grid" style={{gridTemplateColumns:"repeat(4,minmax(0,1fr))",marginTop:16}}><input className="input" name="firstName" placeholder="Nombre" required/><input className="input" name="lastName" placeholder="Apellido"/><input className="input" name="phone" placeholder="Teléfono" required/><input className="input" name="email" type="email" placeholder="Email opcional"/><select className="select" name="locationId" required>{locations.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select><select className="select" name="serviceId" required>{services.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select><select className="select" name="professionalId"><option value="">Sin profesional</option>{professionals.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select><select className="select" name="resourceId"><option value="">Sin recurso</option>{resources.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select><input className="input" name="startsAt" type="datetime-local" defaultValue={`${selectedDate}T09:00`} required/><button className="button" style={{gridColumn:"span 3"}}>Crear turno</button></form></details>
    <InteractiveCalendar view={view} startDate={selectedDate} events={bookings.map(booking=>({id:booking.id,date:formatInTimeZone(booking.startsAt,tenant.timezone,"yyyy-MM-dd"),time:formatInTimeZone(booking.startsAt,tenant.timezone,"HH:mm"),startsAt:booking.startsAt.toISOString(),status:booking.status,customer:`${booking.customer.firstName} ${booking.customer.lastName??""}`.trim(),phone:booking.customer.phone,service:booking.service.name,color:booking.service.color,assignee:booking.professional?.name??booking.resource?.name??"Sin asignar",location:booking.location.name}))}/>
  </>;
}
