import { addDays, addMonths, format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { CalendarDays, Filter, Plus, Sparkles } from "lucide-react";
import type { BookingStatus } from "@prisma/client";
import { requireTenantSession } from "@/lib/auth";
import { createTenantDb } from "@/lib/tenant-db";
import { platformDb } from "@/lib/db";
import { getAdminFreeSlots } from "@/lib/admin-availability";
import { createManualBookingAction } from "@/app/actions/bookings";
import { FeedbackForm } from "@/components/feedback-form";
import { InteractiveCalendar } from "./interactive-calendar";

const mutableStatuses = [["PENDING","Pendiente"],["CONFIRMED","Confirmado"],["CHECKED_IN","Llegó"],["IN_PROGRESS","En atención"],["COMPLETED","Completado"],["NO_SHOW","Ausente"],["CANCELLED","Cancelar"]] as const;
const validStatuses = new Set(mutableStatuses.map(([value])=>value));
type Query = { date?: string; view?: string; locationId?: string; serviceId?: string; professionalId?: string; resourceId?: string; status?: string; startsAt?: string };

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
  const [locations, services, professionals, resources] = await tenantDb.catalog();

  const service = services.find((item)=>item.id===query.serviceId);
  const requestedLocation = locations.find((item)=>item.id===query.locationId)?.id;
  const serviceWithLocations = service ? await platformDb.service.findFirst({
    where:{id:service.id,tenantId:membership.tenantId,isActive:true},
    select:{bookingType:true,locations:{select:{locationId:true}}},
  }) : null;
  const inferredLocation = !requestedLocation && serviceWithLocations?.locations.length===1 ? serviceWithLocations.locations[0].locationId : undefined;
  const effectiveLocationId = requestedLocation ?? inferredLocation;
  const effectiveProfessionalId = professionals.some((item)=>item.id===query.professionalId) ? query.professionalId : undefined;
  const effectiveResourceId = resources.some((item)=>item.id===query.resourceId) ? query.resourceId : undefined;

  const filters = {
    ...(effectiveLocationId?{locationId:effectiveLocationId}:{}),
    ...(service?{serviceId:service.id}:{}),
    ...(effectiveProfessionalId?{professionalId:effectiveProfessionalId}:{}),
    ...(effectiveResourceId?{resourceId:effectiveResourceId}:{}),
    ...(validStatuses.has(query.status as BookingStatus)?{status:query.status as BookingStatus}:{})
  };
  const bookings = await tenantDb.agenda(from,to,filters);

  const visibleDates = Array.from({length:view==="day"?1:view==="week"?7:0},(_,index)=>format(addDays(anchor,index),"yyyy-MM-dd"));
  const canCalculateFree = Boolean(service && effectiveLocationId && serviceWithLocations && !["CLASS","EVENT"].includes(serviceWithLocations.bookingType));
  const freeSlots = canCalculateFree ? (await Promise.all(visibleDates.map((date)=>getAdminFreeSlots({
    tenantId:membership.tenantId,
    date,
    locationId:effectiveLocationId!,
    serviceId:service!.id,
    professionalId:effectiveProfessionalId,
    resourceId:effectiveResourceId,
  }).catch(()=>[])))).flat() : [];

  const nav = (direction:number) => {
    const shifted = view === "month" ? addMonths(anchor,direction) : addDays(anchor,direction * (view === "day" ? 1 : 7));
    const params = new URLSearchParams({date:format(shifted,"yyyy-MM-dd"),view});
    if (query.locationId) params.set("locationId",query.locationId);
    if (query.serviceId) params.set("serviceId",query.serviceId);
    if (query.professionalId) params.set("professionalId",query.professionalId);
    if (query.resourceId) params.set("resourceId",query.resourceId);
    if (query.status) params.set("status",query.status);
    return `/app/agenda?${params.toString()}`;
  };
  const manualStartsAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(query.startsAt??"") ? query.startsAt! : `${selectedDate}T09:00`;
  const availabilityLabel = service ? `${service.name}${effectiveLocationId ? ` · ${locations.find((item)=>item.id===effectiveLocationId)?.name ?? ""}` : ""}` : "";

  return <>
    <div className="page-title agenda-page-title"><span className="eyebrow">Operación diaria</span><h1>Agenda inteligente</h1><p className="muted">Turnos ocupados y huecos realmente disponibles en la misma vista.</p></div>

    <section className="agenda-control card">
      <div className="agenda-control-head"><div><span className="agenda-control-icon"><CalendarDays size={18}/></span><div><strong>{view==="day"?"Vista diaria":view==="week"?"Vista semanal":"Vista mensual"}</strong><small>{formatInTimeZone(from,tenant.timezone,"dd/MM/yyyy")} — {formatInTimeZone(addDays(to,-1),tenant.timezone,"dd/MM/yyyy")}</small></div></div><span className={`availability-state ${canCalculateFree?"ready":"waiting"}`}><Sparkles size={14}/>{canCalculateFree?`${freeSlots.length} huecos libres calculados`:"Elegí servicio para calcular libres"}</span></div>
      <form method="get" className="agenda-filters">
        <div className="field"><label>Fecha</label><input className="input" name="date" type="date" defaultValue={selectedDate}/></div>
        <div className="field"><label>Vista</label><select className="select" name="view" defaultValue={view}><option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option></select></div>
        <div className="field"><label>Servicio</label><select className="select" name="serviceId" defaultValue={query.serviceId??""}><option value="">Todos</option>{services.map((item)=><option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
        <div className="field"><label>Sede</label><select className="select" name="locationId" defaultValue={query.locationId??""}><option value="">Todas / automática</option>{locations.map((item)=><option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
        <div className="field"><label>Profesional</label><select className="select" name="professionalId" defaultValue={query.professionalId??""}><option value="">Todos / automático</option>{professionals.map((item)=><option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
        <div className="field"><label>Recurso</label><select className="select" name="resourceId" defaultValue={query.resourceId??""}><option value="">Todos / automático</option>{resources.map((item)=><option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
        <div className="field"><label>Estado</label><select className="select" name="status" defaultValue={query.status??""}><option value="">Todos</option>{mutableStatuses.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></div>
        <button className="button"><Filter size={15}/> Aplicar</button><a className="button ghost" href="/app/agenda">Limpiar</a>
      </form>
      <div className="agenda-nav"><a className="button secondary" href={nav(-1)}>← Anterior</a><a className="button ghost" href={`/app/agenda?date=${today}&view=${view}${query.serviceId?`&serviceId=${query.serviceId}`:""}${query.locationId?`&locationId=${query.locationId}`:""}`}>Hoy</a><a className="button secondary" href={nav(1)}>Siguiente →</a></div>
      {!canCalculateFree && view!=="month" && <div className="agenda-hint"><Sparkles size={16}/><span><strong>Huecos libres inteligentes.</strong> Seleccioná un servicio y, si tiene varias sedes, una sede. OnlyTurn cruzará horarios, profesional, recurso, bloqueos y reservas existentes.</span></div>}
    </section>

    <details id="manual-booking" className="card agenda-manual" open={Boolean(query.startsAt)}><summary><Plus size={16}/> Crear turno manual</summary><FeedbackForm action={createManualBookingAction} className="agenda-manual-form" savedMessage="Turno creado correctamente"><input className="input" name="firstName" placeholder="Nombre" required/><input className="input" name="lastName" placeholder="Apellido"/><input className="input" name="phone" placeholder="Teléfono" required/><input className="input" name="email" type="email" placeholder="Email opcional"/><select className="select" name="locationId" defaultValue={effectiveLocationId??""} required>{locations.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select><select className="select" name="serviceId" defaultValue={service?.id??""} required>{services.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select><select className="select" name="professionalId" defaultValue={effectiveProfessionalId??""}><option value="">Asignación automática / sin profesional</option>{professionals.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select><select className="select" name="resourceId" defaultValue={effectiveResourceId??""}><option value="">Asignación automática / sin recurso</option>{resources.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select><input className="input" name="startsAt" type="datetime-local" defaultValue={manualStartsAt} required/><button className="button"><Plus size={15}/> Crear turno</button></FeedbackForm></details>

    <InteractiveCalendar
      view={view}
      startDate={selectedDate}
      availabilityLabel={availabilityLabel}
      events={bookings.map((booking)=>({id:booking.id,date:formatInTimeZone(booking.startsAt,tenant.timezone,"yyyy-MM-dd"),time:formatInTimeZone(booking.startsAt,tenant.timezone,"HH:mm"),endTime:formatInTimeZone(booking.endsAt,tenant.timezone,"HH:mm"),startsAt:booking.startsAt.toISOString(),status:booking.status,customer:`${booking.customer.firstName} ${booking.customer.lastName??""}`.trim(),phone:booking.customer.phone,service:booking.service.name,color:booking.service.color,assignee:booking.professional?.name??booking.resource?.name??"Sin asignar",location:booking.location.name,paymentStatus:booking.paymentStatus,paymentAmountCents:booking.paymentAmountCents,priceCents:booking.priceCents}))}
      freeSlots={freeSlots.map((slot)=>({date:slot.date,time:formatInTimeZone(slot.startsAt,tenant.timezone,"HH:mm"),endTime:formatInTimeZone(slot.endsAt,tenant.timezone,"HH:mm"),startsAt:formatInTimeZone(slot.startsAt,tenant.timezone,"yyyy-MM-dd'T'HH:mm"),href:`/app/agenda?${new URLSearchParams({date:slot.date,view,startsAt:formatInTimeZone(slot.startsAt,tenant.timezone,"yyyy-MM-dd'T'HH:mm"),...(service?{serviceId:service.id}:{}),...(effectiveLocationId?{locationId:effectiveLocationId}:{}),...(effectiveProfessionalId?{professionalId:effectiveProfessionalId}:{}),...(effectiveResourceId?{resourceId:effectiveResourceId}:{})}).toString()}#manual-booking`}))}
    />
  </>;
}
