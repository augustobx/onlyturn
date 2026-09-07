import Link from "next/link";
import { Archive, BriefcaseBusiness, Building2, Clock3, Globe2, Plus, RotateCcw, Settings2 } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { getArchivedServices, getUniversalServiceCatalog } from "@/lib/service-catalog";
import { archiveServiceAction, createServiceAction, restoreServiceAction, updateServiceAction } from "@/app/actions/catalog";
import { FeedbackForm } from "@/components/feedback-form";

const requirementLabels = { NONE: "No usa", OPTIONAL: "Opcional", REQUIRED: "Obligatorio" } as const;
const bookingTypeLabels = { APPOINTMENT: "Cita / servicio", CLASS: "Clase / grupo", EVENT: "Evento / fecha", RESOURCE: "Reserva de recurso" } as const;

export default async function CatalogPage() {
  const { membership, tenant } = await requireTenantSession();
  const [[locations, services, professionals, resources], archivedServices] = await Promise.all([
    getUniversalServiceCatalog(membership.tenantId),
    getArchivedServices(membership.tenantId),
  ]);
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: tenant.currency, maximumFractionDigits: 0 });

  return <>
    <div className="page-title"><span className="eyebrow">Paso 3 · Oferta reservable</span><h1>Servicios y tipos de reserva</h1><p className="muted">Configurá qué puede reservar el cliente, quién lo atiende, cuánto dura y cuánto cuesta. Todo se puede editar después con confirmación visible de guardado.</p></div>

    <div className="card setup-context-note"><div><strong>{locations.length} sedes · {professionals.length} profesionales · {resources.length} recursos disponibles</strong><p className="muted">La estructura del negocio se vincula a cada servicio desde acá.</p></div><Link className="button secondary" href="/estructura">Administrar sedes y equipo</Link></div>

    <section className="grid stats service-summary-stats"><div className="card stat"><span className="muted">Activos</span><strong>{services.length}</strong><small className="muted">tipos de reserva</small></div><div className="card stat"><span className="muted">Citas</span><strong>{services.filter((item) => item.bookingType === "APPOINTMENT").length}</strong><small className="muted">servicios 1:1</small></div><div className="card stat"><span className="muted">Clases / eventos</span><strong>{services.filter((item) => ["CLASS", "EVENT"].includes(item.bookingType)).length}</strong><small className="muted">con sesiones y cupos</small></div><div className="card stat"><span className="muted">Archivados</span><strong>{archivedServices.length}</strong><small className="muted">recuperables</small></div></section>

    <details className="card service-create-card" open={!services.length}><summary><Plus size={17} /> Crear tipo de reserva</summary><p className="muted">Definí qué se reserva y vinculalo a la sede, profesionales o recursos correspondientes.</p>{!locations.length ? <div className="empty">Primero creá una sede desde <Link href="/estructura">Sedes y equipo</Link>.</div> : <ServiceForm action={createServiceAction} locations={locations} professionals={professionals} resources={resources} />}</details>

    <div className="platform-toolbar"><div><h2>Servicios configurados</h2><span className="muted">Abrí cualquiera para editarlo.</span></div></div>
    <div className="service-admin-list">
      {services.length ? services.map((service) => {
        const locationId = service.locations[0]?.locationId ?? locations[0]?.id ?? "";
        const professionalIds = service.professionals.map((entry) => entry.professionalId);
        const resourceIds = service.resources.map((entry) => entry.resourceId);
        return <details className="card service-admin-card" key={service.id}>
          <summary><span className="service-admin-avatar" style={{ background: service.color }}>{service.name.charAt(0).toUpperCase()}</span><div><div className="service-admin-name"><strong>{service.name}</strong><span className="pill">{bookingTypeLabels[service.bookingType]}</span>{!service.onlineEnabled && <span className="status SUSPENDED">Sólo interno</span>}</div><small>{service.category ?? "General"} · {service.durationMinutes} min{service.maxPartySize > 1 ? ` · hasta ${service.maxPartySize} asistentes` : ""}{service._count.bookings ? ` · ${service._count.bookings} reservas` : ""}</small></div><div className="service-admin-price"><strong>{service.priceCents == null ? "Consultar" : money.format(service.priceCents / 100)}</strong><span>Editar ↓</span></div></summary>
          <div className="service-admin-editor">
            <ServiceForm action={updateServiceAction} serviceId={service.id} locations={locations} professionals={professionals} resources={resources} defaults={{ name: service.name, description: service.description ?? "", category: service.category ?? "", bookingType: service.bookingType, assignmentStrategy: service.assignmentStrategy, durationMinutes: service.durationMinutes, preparationMinutes: service.preparationMinutes, bufferMinutes: service.bufferMinutes, minPartySize: service.minPartySize, maxPartySize: service.maxPartySize, price: service.priceCents == null ? "" : service.priceCents / 100, color: service.color, locationId, professionalMode: service.professionalMode, resourceMode: service.resourceMode, allowWaitlist: service.allowWaitlist, allowRecurring: service.allowRecurring, onlineEnabled: service.onlineEnabled, professionalIds, resourceIds }} submitLabel="Guardar configuración" />
            <FeedbackForm action={archiveServiceAction} className="setup-lifecycle-action" savedMessage="Servicio archivado"><input type="hidden" name="serviceId" value={service.id} /><button className="button ghost danger-action" type="submit"><Archive size={14} /> Archivar tipo de reserva</button><small className="muted">Si tiene reservas o sesiones futuras, OnlyTurn te va a indicar qué hay que resolver antes.</small></FeedbackForm>
          </div>
        </details>;
      }) : <div className="card empty">Todavía no hay tipos de reserva. Creá el primero arriba.</div>}
    </div>

    {archivedServices.length > 0 && <><div className="platform-toolbar"><div><h2>Archivados</h2><span className="muted">Conservan todo el historial.</span></div></div><div className="card archived-entity-list">{archivedServices.map((service) => <div className="archived-entity-row" key={service.id}><div><strong>{service.name}</strong><small className="muted">{bookingTypeLabels[service.bookingType]} · {service._count.bookings} reservas · {service._count.bookingSessions} sesiones</small></div><FeedbackForm action={restoreServiceAction} savedMessage="Servicio reactivado"><input type="hidden" name="serviceId" value={service.id} /><button className="button secondary" type="submit"><RotateCcw size={14} /> Reactivar</button></FeedbackForm></div>)}</div></>}
  </>;
}

type ServiceDefaults = {
  name: string; description: string; category: string;
  bookingType: "APPOINTMENT" | "CLASS" | "EVENT" | "RESOURCE";
  assignmentStrategy: "CLIENT_CHOOSES" | "ANY_AVAILABLE" | "ROUND_ROBIN" | "MANUAL";
  durationMinutes: number; preparationMinutes: number; bufferMinutes: number; minPartySize: number; maxPartySize: number;
  price: number | ""; color: string; locationId: string;
  professionalMode: "NONE" | "OPTIONAL" | "REQUIRED"; resourceMode: "NONE" | "OPTIONAL" | "REQUIRED";
  allowWaitlist: boolean; allowRecurring: boolean; onlineEnabled: boolean; professionalIds: string[]; resourceIds: string[];
};

function ServiceForm({ action, serviceId, locations, professionals, resources, defaults, submitLabel = "Crear tipo de reserva" }: {
  action: (formData: FormData) => Promise<void>;
  serviceId?: string;
  locations: { id: string; name: string }[];
  professionals: { id: string; name: string }[];
  resources: { id: string; name: string; type?: string | null }[];
  defaults?: ServiceDefaults;
  submitLabel?: string;
}) {
  return <FeedbackForm action={action} className="setup-service-form service-editor-form" savedMessage={serviceId ? "Servicio actualizado" : "Servicio creado"}>
    {serviceId && <input type="hidden" name="serviceId" value={serviceId} />}
    <input type="hidden" name="assignmentStrategy" value={defaults?.assignmentStrategy ?? "CLIENT_CHOOSES"} />

    <div className="service-form-section"><div className="service-form-heading"><span>01</span><div><strong>Información principal</strong><small>Lo que va a entender el cliente al elegir.</small></div></div><div className="service-form-grid"><div className="field"><label>Nombre *</label><input className="input" name="name" required defaultValue={defaults?.name} placeholder="Ej. Consulta inicial" /></div><div className="field"><label>Categoría</label><input className="input" name="category" defaultValue={defaults?.category} placeholder="Ej. Consultas, Canchas, Belleza" /></div><div className="field"><label>Qué se reserva *</label><select className="select" name="bookingType" defaultValue={defaults?.bookingType ?? "APPOINTMENT"}>{Object.entries(bookingTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div><div className="field"><label><Building2 size={13} /> Sede *</label><select className="select" name="locationId" required defaultValue={defaults?.locationId ?? locations[0]?.id}>{locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></div></div><div className="field"><label>Descripción pública</label><textarea className="input" name="description" rows={3} defaultValue={defaults?.description} placeholder="Qué incluye, indicaciones o información útil para el cliente" /></div></div>

    <div className="service-form-section"><div className="service-form-heading"><span>02</span><div><strong>Tiempo, capacidad y precio</strong><small>OnlyTurn usa estos datos para calcular huecos reales.</small></div></div><div className="service-form-grid"><div className="field"><label><Clock3 size={13} /> Duración</label><input className="input" name="durationMinutes" type="number" min="5" max="1440" defaultValue={defaults?.durationMinutes ?? 30} required /></div><div className="field"><label>Preparación previa</label><input className="input" name="preparationMinutes" type="number" min="0" max="720" defaultValue={defaults?.preparationMinutes ?? 0} required /></div><div className="field"><label>Buffer posterior</label><input className="input" name="bufferMinutes" type="number" min="0" max="720" defaultValue={defaults?.bufferMinutes ?? 0} required /></div><div className="field"><label>Precio</label><input className="input" name="price" type="number" min="0" step="0.01" defaultValue={defaults?.price} placeholder="Consultar" /></div><div className="field"><label>Mín. asistentes</label><input className="input" name="minPartySize" type="number" min="1" max="1000" defaultValue={defaults?.minPartySize ?? 1} required /></div><div className="field"><label>Máx. asistentes / cupos</label><input className="input" name="maxPartySize" type="number" min="1" max="1000" defaultValue={defaults?.maxPartySize ?? 1} required /></div><div className="field"><label>Color en agenda</label><input className="service-color-input" name="color" type="color" defaultValue={defaults?.color ?? "#2563eb"} /></div></div></div>

    <div className="service-form-section"><div className="service-form-heading"><span>03</span><div><strong>Asignación</strong><small>Quién o qué tiene que estar libre para permitir la reserva.</small></div></div><div className="service-assignment-grid"><div className="service-assignment-card"><label><BriefcaseBusiness size={15} /> ¿Usa profesional?</label><select className="select" name="professionalMode" defaultValue={defaults?.professionalMode ?? "OPTIONAL"}>{Object.entries(requirementLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><small>Profesionales habilitados</small><select className="select" name="professionalIds" multiple size={Math.min(5, Math.max(2, professionals.length || 2))} defaultValue={defaults?.professionalIds ?? []}>{professionals.map((professional) => <option value={professional.id} key={professional.id}>{professional.name}</option>)}</select></div><div className="service-assignment-card"><label><Settings2 size={15} /> ¿Usa recurso?</label><select className="select" name="resourceMode" defaultValue={defaults?.resourceMode ?? "NONE"}>{Object.entries(requirementLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><small>Recursos habilitados</small><select className="select" name="resourceIds" multiple size={Math.min(5, Math.max(2, resources.length || 2))} defaultValue={defaults?.resourceIds ?? []}>{resources.map((resource) => <option value={resource.id} key={resource.id}>{resource.name}{resource.type ? ` · ${resource.type}` : ""}</option>)}</select></div></div></div>

    <div className="service-form-section"><div className="service-form-heading"><span>04</span><div><strong>Comportamiento</strong><small>Cómo participa este servicio en la experiencia pública.</small></div></div><div className="service-toggle-grid"><label><input type="checkbox" name="onlineEnabled" defaultChecked={defaults?.onlineEnabled ?? true} /><Globe2 size={15}/><span><strong>Reserva online</strong><small>Visible al cliente</small></span></label><label><input type="checkbox" name="allowWaitlist" defaultChecked={defaults?.allowWaitlist ?? false} /><span><strong>Lista de espera</strong><small>Captura demanda sin lugar</small></span></label><label><input type="checkbox" name="allowRecurring" defaultChecked={defaults?.allowRecurring ?? false} /><span><strong>Recurrencia</strong><small>Series de turnos o sesiones</small></span></label></div></div>

    <div className="service-form-actions"><button className="button" type="submit">{submitLabel}</button></div>
  </FeedbackForm>;
}
