import { CalendarRange, CircleX, Plus, Users } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { requireTenantSession } from "@/lib/auth";
import { getSessionManagementData } from "@/lib/session-management";
import { cancelBookingSessionAction, createBookingSessionAction } from "@/app/actions/session-management";

export default async function SessionsPage() {
  const { membership, tenant } = await requireTenantSession();
  const [services, sessions] = await getSessionManagementData(membership.tenantId);

  return (
    <>
      <div className="page-title">
        <span className="eyebrow">Clases y eventos</span>
        <h1>Sesiones programadas</h1>
        <p className="muted">Una sesión reserva al instructor/recurso una sola vez y administra cupos independientes para sus asistentes.</p>
      </div>

      {!services.length ? (
        <div className="card empty">Creá primero un tipo de reserva “Clase / grupo” o “Evento / fecha” desde Servicios.</div>
      ) : (
        <details className="card" open={!sessions.length}>
          <summary style={{ cursor: "pointer", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><Plus size={17} /> Programar sesión</summary>
          <form action={createBookingSessionAction} style={{ marginTop: 18 }}>
            <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div className="field">
                <label>Clase / evento *</label>
                <select className="select" name="serviceId" required defaultValue="">
                  <option value="" disabled>Seleccionar</option>
                  {services.map((service) => <option value={service.id} key={service.id}>{service.name} · {service.bookingType === "CLASS" ? "Clase" : "Evento"} · máx. {service.maxPartySize}</option>)}
                </select>
              </div>
              <div className="field"><label>Fecha y hora *</label><input className="input" name="startsAt" type="datetime-local" required /></div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
              <div className="field">
                <label>Sucursal *</label>
                <select className="select" name="locationId" required defaultValue="">
                  <option value="" disabled>Seleccionar sede</option>
                  {[...new Map(services.flatMap((service) => service.locations.map((link) => [link.location.id, link.location] as const))).values()].map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Profesional / instructor</label>
                <select className="select" name="professionalId" defaultValue="">
                  <option value="">Sin asignar</option>
                  {[...new Map(services.flatMap((service) => service.professionals.map((link) => [link.professional.id, link.professional] as const))).values()].map((professional) => <option value={professional.id} key={professional.id}>{professional.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Recurso</label>
                <select className="select" name="resourceId" defaultValue="">
                  <option value="">Sin asignar</option>
                  {[...new Map(services.flatMap((service) => service.resources.map((link) => [link.resource.id, link.resource] as const))).values()].map((resource) => <option value={resource.id} key={resource.id}>{resource.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: "1fr 2fr", gap: 12 }}>
              <div className="field"><label>Cupos *</label><input className="input" name="capacity" type="number" min="1" max="1000" defaultValue="10" required /></div>
              <div className="field"><label>Título opcional</label><input className="input" name="title" maxLength={120} placeholder="Ej. Yoga suave · grupo mañana" /></div>
            </div>
            <div className="field"><label>Notas internas</label><textarea className="input" name="notes" rows={2} maxLength={500} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}><input type="checkbox" name="onlineEnabled" defaultChecked /> Publicar online</label>
              <button className="button"><CalendarRange size={15} /> Crear sesión</button>
            </div>
          </form>
        </details>
      )}

      <div className="platform-toolbar">
        <h2>Próximas sesiones</h2>
        <span className="muted" style={{ fontSize: 12 }}>{sessions.length} programada{sessions.length === 1 ? "" : "s"}</span>
      </div>

      <div className="grid" style={{ gap: 12 }}>
        {sessions.length ? sessions.map((session) => {
          const occupied = session.bookings.reduce((sum, booking) => sum + booking.partySize, 0);
          const available = Math.max(0, session.capacity - occupied);
          return (
            <article className="card" key={session.id}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 16, alignItems: "start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className={`status ${session.status}`}>{session.status}</span>
                    <span className="pill">{session.service.bookingType === "CLASS" ? "Clase" : "Evento"}</span>
                    {!session.onlineEnabled && <span className="pill">Interna</span>}
                  </div>
                  <h3 style={{ margin: "9px 0 5px" }}>{session.title || session.service.name}</h3>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {formatInTimeZone(session.startsAt, tenant.timezone, "EEEE dd/MM · HH:mm")} — {formatInTimeZone(session.endsAt, tenant.timezone, "HH:mm")}
                    {` · ${session.location.name}`}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>
                    {session.professional?.name ? `Instructor: ${session.professional.name}` : "Sin profesional"}
                    {session.resource?.name ? ` · Recurso: ${session.resource.name}` : ""}
                  </div>
                </div>
                <div style={{ minWidth: 155, textAlign: "right" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Users size={16} /><strong>{occupied}/{session.capacity}</strong></div>
                  <div className="muted" style={{ fontSize: 11 }}>{available} cupo{available === 1 ? "" : "s"} libre{available === 1 ? "" : "s"}</div>
                  {session.status === "SCHEDULED" && (
                    <form action={cancelBookingSessionAction} style={{ marginTop: 10 }}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <button className="button ghost" style={{ color: "#b42331", padding: "7px 9px" }}><CircleX size={14} /> Cancelar sesión</button>
                    </form>
                  )}
                </div>
              </div>
              {session.bookings.length > 0 && (
                <details style={{ marginTop: 13 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 12 }}>Ver asistentes ({session.bookings.length})</summary>
                  <div className="option-grid" style={{ marginTop: 9 }}>
                    {session.bookings.map((booking) => <div className="option" key={booking.id}><span><strong>{booking.customer.firstName} {booking.customer.lastName}</strong><br /><small className="muted">{booking.partySize} lugar{booking.partySize === 1 ? "" : "es"}</small></span><span className={`status ${booking.status}`}>{booking.status}</span></div>)}
                  </div>
                </details>
              )}
            </article>
          );
        }) : <div className="card empty">No hay clases o eventos próximos.</div>}
      </div>
    </>
  );
}
