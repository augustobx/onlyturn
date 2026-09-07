import { CalendarRange, Repeat2, Trash2 } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { formatSeriesAnchor, getRecurrenceData } from "@/lib/recurrence";
import { cancelBookingSeriesAction, createBookingSeriesAction } from "@/app/actions/recurrence";

const weekdays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const typeLabels = { APPOINTMENT: "Cita", CLASS: "Clase", EVENT: "Evento", RESOURCE: "Recurso" } as const;

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item] as const)).values()];
}

export default async function RecurrencePage() {
  const { membership, tenant } = await requireTenantSession();
  const [services, customers, series] = await getRecurrenceData(membership.tenantId);
  const locations = uniqueById(services.flatMap((service) => service.locations.map((item) => item.location)));
  const professionals = uniqueById(services.flatMap((service) => service.professionals.map((item) => item.professional)));
  const resources = uniqueById(services.flatMap((service) => service.resources.map((item) => item.resource)));

  return (
    <>
      <div className="page-title">
        <span className="eyebrow">Programación avanzada</span>
        <h1>Recurrencias</h1>
        <p className="muted">Generá series consistentes de citas, reservas, clases o eventos y administrá sus ocurrencias como una unidad.</p>
      </div>

      <section className="grid two-col" style={{ alignItems: "start" }}>
        <form action={createBookingSeriesAction} className="card">
          <div className="section-head"><h2><Repeat2 size={17} /> Nueva serie</h2></div>
          <div className="field"><label>Servicio *</label><select className="select" name="serviceId" required defaultValue=""><option value="" disabled>Seleccionar</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name} · {typeLabels[service.bookingType]}</option>)}</select></div>
          <div className="field"><label>Sucursal *</label><select className="select" name="locationId" required defaultValue=""><option value="" disabled>Seleccionar</option>{locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></div>
          <div className="field"><label>Cliente</label><select className="select" name="customerId" defaultValue=""><option value="">No aplica / clase o evento</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.firstName} {customer.lastName ?? ""} · {customer.phone}</option>)}</select><small className="muted">Obligatorio para citas y reservas 1:1; no se usa para sesiones grupales.</small></div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field"><label>Profesional</label><select className="select" name="professionalId" defaultValue=""><option value="">Sin asignar</option>{professionals.map((professional) => <option value={professional.id} key={professional.id}>{professional.name}</option>)}</select></div>
            <div className="field"><label>Recurso</label><select className="select" name="resourceId" defaultValue=""><option value="">Sin asignar</option>{resources.map((resource) => <option value={resource.id} key={resource.id}>{resource.name}</option>)}</select></div>
          </div>
          <div className="field"><label>Primera ocurrencia *</label><input className="input" type="datetime-local" name="anchorLocal" required /></div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div className="field"><label>Frecuencia</label><select className="select" name="frequency" defaultValue="WEEKLY"><option value="WEEKLY">Semanal</option><option value="DAILY">Diaria</option></select></div>
            <div className="field"><label>Cada</label><input className="input" type="number" name="interval" min="1" max="52" defaultValue="1" required /></div>
            <div className="field"><label>Ocurrencias</label><input className="input" type="number" name="count" min="2" max="250" defaultValue="8" required /></div>
          </div>
          <div className="field"><label>Días para recurrencia semanal</label><div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 6 }}>{weekdays.map((day, index) => <label key={day} style={{ display: "grid", justifyItems: "center", gap: 5, padding: 8, border: "1px solid var(--line)", borderRadius: 9, fontSize: 11 }}><input type="checkbox" name="weekdays" value={index} defaultChecked={index >= 1 && index <= 5} />{day}</label>)}</div></div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field"><label>Cupo de sesión</label><input className="input" type="number" name="capacity" min="1" max="1000" placeholder="Sólo clases/eventos" /></div>
            <div className="field"><label>Título opcional</label><input className="input" name="title" placeholder="Ej. Yoga de los martes" /></div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}><input type="checkbox" name="onlineEnabled" defaultChecked /> Publicar sesiones online cuando corresponda</label>
          <button className="button" style={{ width: "100%" }}><CalendarRange size={15} /> Crear serie</button>
        </form>

        <aside className="card">
          <h2>Reglas de consistencia</h2>
          <div className="option-grid">
            <div className="option"><span><strong>Citas recurrentes</strong><br /><small className="muted">Cada ocurrencia es una reserva real ligada a la serie y requiere cliente.</small></span></div>
            <div className="option"><span><strong>Clases/eventos recurrentes</strong><br /><small className="muted">Cada fecha se genera como una sesión con su propio cupo y asistentes.</small></span></div>
            <div className="option"><span><strong>Conflictos</strong><br /><small className="muted">Si una ocurrencia choca con agenda existente, se cancela la creación completa: no quedan series a medias.</small></span></div>
          </div>
        </aside>
      </section>

      <div className="platform-toolbar"><h2>Series activas</h2><span className="muted" style={{ fontSize: 12 }}>{series.length} serie{series.length === 1 ? "" : "s"}</span></div>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Serie</th><th>Inicio</th><th>Regla</th><th>Ocurrencias</th><th>Asignación</th><th></th></tr></thead>
          <tbody>{series.length ? series.map((item) => <tr key={item.id}>
            <td><strong>{item.service.name}</strong><div className="muted" style={{ fontSize: 11 }}>{typeLabels[item.bookingType]} · {item.location.name}{item.customer ? ` · ${item.customer.firstName} ${item.customer.lastName ?? ""}` : ""}</div></td>
            <td>{formatSeriesAnchor(item.anchorStartsAt, tenant.timezone)}</td>
            <td><code style={{ fontSize: 11 }}>{item.rrule}</code></td>
            <td>{item._count.bookings + item._count.sessions}</td>
            <td className="muted">{item.professional?.name ?? "—"}{item.resource?.name ? ` · ${item.resource.name}` : ""}</td>
            <td style={{ textAlign: "right" }}><form action={cancelBookingSeriesAction}><input type="hidden" name="seriesId" value={item.id} /><button className="button ghost" style={{ color: "#b42331", padding: 7 }} aria-label="Cancelar futuras ocurrencias"><Trash2 size={14} /></button></form></td>
          </tr>) : <tr><td colSpan={6}><div className="empty">Todavía no hay series recurrentes.</div></td></tr>}</tbody>
        </table>
      </div>
    </>
  );
}
