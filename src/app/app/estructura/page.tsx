import { Building2, Plus, Users, Wrench } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { getUniversalServiceCatalog } from "@/lib/service-catalog";
import { createLocationAction, createProfessionalAction, createResourceAction } from "@/app/actions/catalog";

export default async function StructureSetupPage() {
  const { membership } = await requireTenantSession();
  const [locations, , professionals, resources] = await getUniversalServiceCatalog(membership.tenantId);

  return <>
    <div className="page-title">
      <span className="eyebrow">Paso 2 · Estructura</span>
      <h1>Sedes, profesionales y recursos</h1>
      <p className="muted">Definí primero quién atiende, dónde y con qué recursos. Después los vinculás a los servicios que correspondan.</p>
    </div>

    <section className="setup-structure-grid">
      <div className="card setup-entity-card">
        <div className="section-head"><div><span className="eyebrow">Ubicaciones</span><h2>Sedes</h2></div><span className="setup-count"><Building2 size={15} /> {locations.length}</span></div>
        <div className="setup-entity-list">{locations.length ? locations.map((entry) => <div className="setup-entity-row" key={entry.id}><span className="setup-entity-icon"><Building2 size={14} /></span><div><strong>{entry.name}</strong><small>{entry.address || "Sin dirección cargada"}</small></div><span className="status ACTIVE">Activa</span></div>) : <div className="empty">Todavía no hay sedes.</div>}</div>
        <form action={createLocationAction} className="setup-inline-form">
          <div className="setup-inline-form-head"><Plus size={14} /><strong>Agregar sede</strong></div>
          <input className="input" name="name" placeholder="Ej. Sucursal Centro" required />
          <input className="input" name="address" placeholder="Dirección (opcional)" />
          <button className="button secondary">Agregar</button>
        </form>
      </div>

      <div className="card setup-entity-card">
        <div className="section-head"><div><span className="eyebrow">Personas</span><h2>Profesionales</h2></div><span className="setup-count"><Users size={15} /> {professionals.length}</span></div>
        <div className="setup-entity-list">{professionals.length ? professionals.map((entry) => <div className="setup-entity-row" key={entry.id}><span className="dot" style={{ background: entry.color }} /><div><strong>{entry.name}</strong><small>{entry.location?.name || "Sin sede fija"}</small></div><span className="status ACTIVE">Activo</span></div>) : <div className="empty">Todavía no hay profesionales.</div>}</div>
        <form action={createProfessionalAction} className="setup-inline-form">
          <div className="setup-inline-form-head"><Plus size={14} /><strong>Agregar profesional</strong></div>
          <input className="input" name="name" placeholder="Nombre" required />
          <select className="select" name="locationId" defaultValue=""><option value="">Sin sede fija</option>{locations.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select>
          <div className="setup-color-submit"><input type="color" name="color" defaultValue="#2563eb" aria-label="Color en agenda" /><button className="button secondary">Agregar</button></div>
        </form>
      </div>

      <div className="card setup-entity-card">
        <div className="section-head"><div><span className="eyebrow">Activos reservables</span><h2>Recursos</h2></div><span className="setup-count"><Wrench size={15} /> {resources.length}</span></div>
        <div className="setup-entity-list">{resources.length ? resources.map((entry) => <div className="setup-entity-row" key={entry.id}><span className="dot" style={{ background: entry.color }} /><div><strong>{entry.name}</strong><small>{entry.type || "Recurso"} · capacidad {entry.capacity}{entry.location?.name ? ` · ${entry.location.name}` : ""}</small></div><span className="status ACTIVE">Activo</span></div>) : <div className="empty">Todavía no hay recursos.</div>}</div>
        <form action={createResourceAction} className="setup-inline-form">
          <div className="setup-inline-form-head"><Plus size={14} /><strong>Agregar recurso</strong></div>
          <input className="input" name="name" placeholder="Sala, cancha, box, equipo…" required />
          <div className="grid" style={{ gridTemplateColumns: "1fr 100px", gap: 8 }}><input className="input" name="type" placeholder="Tipo" /><input className="input" name="capacity" type="number" min="1" max="1000" defaultValue="1" aria-label="Capacidad" /></div>
          <select className="select" name="locationId" defaultValue=""><option value="">Sin sede fija</option>{locations.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select>
          <div className="setup-color-submit"><input type="color" name="color" defaultValue="#10b981" aria-label="Color en agenda" /><button className="button secondary">Agregar</button></div>
        </form>
      </div>
    </section>

    <div className="card setup-note"><strong>¿Qué hago después?</strong><p className="muted">Entrá a <b>Servicios</b> y elegí qué profesionales o recursos pueden atender cada tipo de reserva. Si un negocio no usa profesionales o recursos, simplemente dejalos sin cargar.</p></div>
  </>;
}
