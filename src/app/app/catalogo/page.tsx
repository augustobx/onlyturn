import {
  Archive,
  BriefcaseBusiness,
  Building2,
  Clock3,
  Globe2,
  Plus,
  Settings2,
  Users,
  Wrench,
} from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { getUniversalServiceCatalog } from "@/lib/service-catalog";
import {
  archiveServiceAction,
  createLocationAction,
  createProfessionalAction,
  createResourceAction,
  createServiceAction,
  updateServiceAction,
} from "@/app/actions/catalog";

const requirementLabels = {
  NONE: "No usa",
  OPTIONAL: "Opcional",
  REQUIRED: "Obligatorio",
} as const;

const bookingTypeLabels = {
  APPOINTMENT: "Cita / servicio",
  CLASS: "Clase / grupo",
  EVENT: "Evento / fecha",
  RESOURCE: "Reserva de recurso",
} as const;

export default async function CatalogPage() {
  const { membership, tenant } = await requireTenantSession();
  const [locations, services, professionals, resources] = await getUniversalServiceCatalog(membership.tenantId);
  const money = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: tenant.currency,
    maximumFractionDigits: 0,
  });

  return (
    <>
      <div className="page-title">
        <span className="eyebrow">Motor universal de reservas</span>
        <h1>Servicios, clases, eventos y recursos</h1>
        <p className="muted">
          El mismo motor sirve para consultas, peluquería, canchas, talleres, clases, alquileres, estudios,
          centros profesionales y cualquier actividad que reserve tiempo o capacidad.
        </p>
      </div>

      <section className="grid stats" style={{ marginBottom: 18 }}>
        <div className="card stat"><span className="muted">Tipos de reserva</span><strong>{services.length}</strong><small className="muted">configuraciones activas</small></div>
        <div className="card stat"><span className="muted">Profesionales</span><strong>{professionals.length}</strong><small className="muted">personas asignables</small></div>
        <div className="card stat"><span className="muted">Recursos</span><strong>{resources.length}</strong><small className="muted">salas, equipos, boxes…</small></div>
        <div className="card stat"><span className="muted">Sucursales</span><strong>{locations.length}</strong><small className="muted">puntos de atención</small></div>
      </section>

      <details className="card" open={!services.length}>
        <summary style={{ cursor: "pointer", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={17} /> Crear tipo de reserva
        </summary>
        <p className="muted" style={{ fontSize: 13 }}>
          Definí primero qué se reserva. El resto de las reglas se adaptan al tipo elegido.
        </p>
        {!locations.length ? (
          <div className="empty">Primero creá al menos una sucursal o punto de atención.</div>
        ) : (
          <ServiceForm action={createServiceAction} locations={locations} professionals={professionals} resources={resources} />
        )}
      </details>

      <div className="platform-toolbar">
        <h2>Tipos de reserva configurados</h2>
        <span className="muted" style={{ fontSize: 12 }}>Configuración operativa reutilizable en agenda, web pública y módulos futuros.</span>
      </div>

      <div className="grid" style={{ gap: 14 }}>
        {services.length ? services.map((service) => {
          const locationId = service.locations[0]?.locationId ?? locations[0]?.id ?? "";
          const professionalIds = service.professionals.map((item) => item.professionalId);
          const resourceIds = service.resources.map((item) => item.resourceId);
          return (
            <details className="card" key={service.id}>
              <summary style={{ cursor: "pointer", listStyle: "none" }}>
                <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 14, alignItems: "center" }}>
                  <span className="avatar" style={{ background: service.color }}>{service.name.charAt(0).toUpperCase()}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{service.name}</strong>
                      <span className="pill">{bookingTypeLabels[service.bookingType]}</span>
                      <span className="pill">{service.category ?? "General"}</span>
                      {service.allowWaitlist && <span className="pill">Lista de espera</span>}
                      {service.allowRecurring && <span className="pill">Recurrente</span>}
                      {!service.onlineEnabled && <span className="status SUSPENDED">Sólo interno</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>
                      {service.durationMinutes} min
                      {service.maxPartySize > 1 ? ` · hasta ${service.maxPartySize} asistentes` : ""}
                      {service.preparationMinutes ? ` · ${service.preparationMinutes} min preparación` : ""}
                      {service.bufferMinutes ? ` · ${service.bufferMinutes} min buffer` : ""}
                      {service._count.bookings ? ` · ${service._count.bookings} reservas` : ""}
                      {service._count.bookingSessions ? ` · ${service._count.bookingSessions} sesiones` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong>{service.priceCents == null ? "Consultar" : money.format(service.priceCents / 100)}</strong>
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Editar configuración ↓</div>
                  </div>
                </div>
              </summary>

              <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
                <ServiceForm
                  action={updateServiceAction}
                  serviceId={service.id}
                  locations={locations}
                  professionals={professionals}
                  resources={resources}
                  defaults={{
                    name: service.name,
                    description: service.description ?? "",
                    category: service.category ?? "",
                    bookingType: service.bookingType,
                    assignmentStrategy: service.assignmentStrategy,
                    durationMinutes: service.durationMinutes,
                    preparationMinutes: service.preparationMinutes,
                    bufferMinutes: service.bufferMinutes,
                    minPartySize: service.minPartySize,
                    maxPartySize: service.maxPartySize,
                    price: service.priceCents == null ? "" : service.priceCents / 100,
                    color: service.color,
                    locationId,
                    professionalMode: service.professionalMode,
                    resourceMode: service.resourceMode,
                    allowWaitlist: service.allowWaitlist,
                    allowRecurring: service.allowRecurring,
                    onlineEnabled: service.onlineEnabled,
                    professionalIds,
                    resourceIds,
                  }}
                  submitLabel="Guardar configuración"
                />
                <form action={archiveServiceAction} style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                  <input type="hidden" name="serviceId" value={service.id} />
                  <button className="button ghost" type="submit" style={{ color: "#b42331", display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <Archive size={14} /> Archivar tipo de reserva
                  </button>
                </form>
              </div>
            </details>
          );
        }) : <div className="card empty">Todavía no hay tipos de reserva. Creá el primero arriba.</div>}
      </div>

      <div className="platform-toolbar" style={{ marginTop: 28 }}>
        <h2>Infraestructura de agenda</h2>
        <span className="muted" style={{ fontSize: 12 }}>Elementos reutilizables por todos los tipos de reserva.</span>
      </div>

      <section className="grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", alignItems: "start" }}>
        <aside className="card">
          <div className="section-head"><h2 style={{ display: "flex", gap: 8, alignItems: "center" }}><Users size={17} /> Profesionales</h2><span className="pill">{professionals.length}</span></div>
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            {professionals.map((item) => <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="dot" style={{ background: item.color }} /><span>{item.name}</span></div>)}
          </div>
          <form action={createProfessionalAction} className="grid" style={{ gap: 8 }}>
            <input className="input" name="name" placeholder="Nombre del profesional" required />
            <select className="select" name="locationId" defaultValue=""><option value="">Sin sede fija</option>{locations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><input name="color" type="color" defaultValue="#2563eb" /><button className="button secondary" style={{ flex: 1 }}>Agregar profesional</button></div>
          </form>
        </aside>

        <aside className="card">
          <div className="section-head"><h2 style={{ display: "flex", gap: 8, alignItems: "center" }}><Wrench size={17} /> Recursos</h2><span className="pill">{resources.length}</span></div>
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            {resources.map((item) => <div key={item.id}><span className="dot" style={{ background: item.color }} /><strong>{item.name}</strong><div className="muted" style={{ fontSize: 11 }}>{item.type ?? "Recurso"} · capacidad física {item.capacity}</div></div>)}
          </div>
          <form action={createResourceAction} className="grid" style={{ gap: 8 }}>
            <input className="input" name="name" placeholder="Sala, box, cancha, equipo…" required />
            <input className="input" name="type" placeholder="Tipo de recurso" />
            <select className="select" name="locationId" defaultValue=""><option value="">Sin sede fija</option>{locations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
            <input className="input" name="capacity" type="number" min="1" max="1000" defaultValue="1" aria-label="Capacidad física" />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><input name="color" type="color" defaultValue="#10b981" /><button className="button secondary" style={{ flex: 1 }}>Agregar recurso</button></div>
          </form>
        </aside>

        <aside className="card">
          <div className="section-head"><h2 style={{ display: "flex", gap: 8, alignItems: "center" }}><Building2 size={17} /> Sucursales</h2><span className="pill">{locations.length}</span></div>
          <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
            {locations.map((item) => <div key={item.id}><strong>{item.name}</strong><div className="muted" style={{ fontSize: 11 }}>{item.address || "Sin dirección cargada"}</div></div>)}
          </div>
          <form action={createLocationAction} className="grid" style={{ gap: 8 }}>
            <input className="input" name="name" placeholder="Nombre de la sede" required />
            <input className="input" name="address" placeholder="Dirección" />
            <button className="button secondary">Agregar sucursal</button>
          </form>
        </aside>
      </section>
    </>
  );
}

type ServiceDefaults = {
  name: string;
  description: string;
  category: string;
  bookingType: "APPOINTMENT" | "CLASS" | "EVENT" | "RESOURCE";
  assignmentStrategy: "CLIENT_CHOOSES" | "ANY_AVAILABLE" | "ROUND_ROBIN" | "MANUAL";
  durationMinutes: number;
  preparationMinutes: number;
  bufferMinutes: number;
  minPartySize: number;
  maxPartySize: number;
  price: number | "";
  color: string;
  locationId: string;
  professionalMode: "NONE" | "OPTIONAL" | "REQUIRED";
  resourceMode: "NONE" | "OPTIONAL" | "REQUIRED";
  allowWaitlist: boolean;
  allowRecurring: boolean;
  onlineEnabled: boolean;
  professionalIds: string[];
  resourceIds: string[];
};

function ServiceForm({
  action,
  serviceId,
  locations,
  professionals,
  resources,
  defaults,
  submitLabel = "Crear tipo de reserva",
}: {
  action: (formData: FormData) => Promise<void>;
  serviceId?: string;
  locations: { id: string; name: string }[];
  professionals: { id: string; name: string }[];
  resources: { id: string; name: string; type?: string | null }[];
  defaults?: ServiceDefaults;
  submitLabel?: string;
}) {
  return (
    <form action={action} style={{ marginTop: 18 }}>
      {serviceId && <input type="hidden" name="serviceId" value={serviceId} />}
      <input type="hidden" name="assignmentStrategy" value={defaults?.assignmentStrategy ?? "CLIENT_CHOOSES"} />

      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div className="field"><label>Nombre *</label><input className="input" name="name" required defaultValue={defaults?.name} placeholder="Ej. Consulta inicial" /></div>
        <div className="field"><label>Categoría</label><input className="input" name="category" defaultValue={defaults?.category} placeholder="Ej. Consultas, Canchas, Belleza" /></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label>Qué se reserva *</label>
          <select className="select" name="bookingType" defaultValue={defaults?.bookingType ?? "APPOINTMENT"}>
            {Object.entries(bookingTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          <small className="muted">Clase y evento trabajan con sesiones y cupos; recurso permite operar sin profesional.</small>
        </div>
        <div className="field">
          <label><Building2 size={13} /> Sucursal *</label>
          <select className="select" name="locationId" required defaultValue={defaults?.locationId ?? locations[0]?.id}>
            {locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}
          </select>
        </div>
      </div>

      <div className="field"><label>Descripción pública</label><textarea className="input" name="description" rows={2} defaultValue={defaults?.description} placeholder="Qué incluye, indicaciones o información útil para el cliente" /></div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
        <div className="field"><label><Clock3 size={13} /> Duración</label><input className="input" name="durationMinutes" type="number" min="5" max="1440" defaultValue={defaults?.durationMinutes ?? 30} required /></div>
        <div className="field"><label>Preparación previa</label><input className="input" name="preparationMinutes" type="number" min="0" max="720" defaultValue={defaults?.preparationMinutes ?? 0} required /></div>
        <div className="field"><label>Buffer posterior</label><input className="input" name="bufferMinutes" type="number" min="0" max="720" defaultValue={defaults?.bufferMinutes ?? 0} required /></div>
        <div className="field"><label>Precio por reserva/persona</label><input className="input" name="price" type="number" min="0" step="0.01" defaultValue={defaults?.price} placeholder="Consultar" /></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
        <div className="field"><label>Mín. asistentes</label><input className="input" name="minPartySize" type="number" min="1" max="1000" defaultValue={defaults?.minPartySize ?? 1} required /></div>
        <div className="field"><label>Máx. asistentes / cupos</label><input className="input" name="maxPartySize" type="number" min="1" max="1000" defaultValue={defaults?.maxPartySize ?? 1} required /></div>
        <div className="field"><label>Color en agenda</label><input name="color" type="color" defaultValue={defaults?.color ?? "#2563eb"} style={{ width: "100%", height: 44, border: "1px solid var(--line)", borderRadius: 11, padding: 5, background: "var(--surface)" }} /></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card" style={{ boxShadow: "none", padding: 14 }}>
          <label className="field" style={{ margin: 0 }}>
            <span style={{ display: "flex", gap: 7, alignItems: "center", fontWeight: 750 }}><BriefcaseBusiness size={14} /> ¿Usa profesional?</span>
            <select className="select" name="professionalMode" defaultValue={defaults?.professionalMode ?? "OPTIONAL"}>
              {Object.entries(requirementLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <label className="muted" style={{ display: "block", fontSize: 11, margin: "10px 0 6px" }}>Profesionales habilitados</label>
          <select className="select" name="professionalIds" multiple size={Math.min(5, Math.max(2, professionals.length || 2))} defaultValue={defaults?.professionalIds ?? []}>
            {professionals.map((professional) => <option value={professional.id} key={professional.id}>{professional.name}</option>)}
          </select>
          <small className="muted">Podés habilitar varios. La asignación automática se incorporará como estrategia independiente.</small>
        </div>

        <div className="card" style={{ boxShadow: "none", padding: 14 }}>
          <label className="field" style={{ margin: 0 }}>
            <span style={{ display: "flex", gap: 7, alignItems: "center", fontWeight: 750 }}><Settings2 size={14} /> ¿Usa recurso?</span>
            <select className="select" name="resourceMode" defaultValue={defaults?.resourceMode ?? "NONE"}>
              {Object.entries(requirementLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
          <label className="muted" style={{ display: "block", fontSize: 11, margin: "10px 0 6px" }}>Recursos habilitados</label>
          <select className="select" name="resourceIds" multiple size={Math.min(5, Math.max(2, resources.length || 2))} defaultValue={defaults?.resourceIds ?? []}>
            {resources.map((resource) => <option value={resource.id} key={resource.id}>{resource.name}{resource.type ? ` · ${resource.type}` : ""}</option>)}
          </select>
          <small className="muted">Sala, equipo, box, cancha, vehículo o cualquier activo reservable.</small>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginTop: 16 }}>
        <label className="card" style={{ boxShadow: "none", padding: 12, display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="onlineEnabled" defaultChecked={defaults?.onlineEnabled ?? true} /><Globe2 size={14} /><span><strong>Reserva online</strong><small className="muted" style={{ display: "block" }}>Visible al cliente</small></span></label>
        <label className="card" style={{ boxShadow: "none", padding: 12, display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="allowWaitlist" defaultChecked={defaults?.allowWaitlist ?? false} /><span><strong>Lista de espera</strong><small className="muted" style={{ display: "block" }}>Captura demanda sin lugar</small></span></label>
        <label className="card" style={{ boxShadow: "none", padding: 12, display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="allowRecurring" defaultChecked={defaults?.allowRecurring ?? false} /><span><strong>Recurrencia</strong><small className="muted" style={{ display: "block" }}>Series de turnos o sesiones</small></span></label>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><button className="button" type="submit">{submitLabel}</button></div>
    </form>
  );
}
