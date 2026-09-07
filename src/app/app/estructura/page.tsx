import { Building2, Pencil, Plus, RotateCcw, Users, Wrench, XCircle } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { getStructureManagementData } from "@/lib/structure-management";
import {
  createLocationAction,
  createProfessionalAction,
  createResourceAction,
  setLocationActiveAction,
  setProfessionalActiveAction,
  setResourceActiveAction,
  updateLocationAction,
  updateProfessionalAction,
  updateResourceAction,
} from "@/app/actions/catalog";

export default async function StructureSetupPage() {
  const { membership } = await requireTenantSession();
  const { locations, professionals, resources } = await getStructureManagementData(membership.tenantId);
  const activeLocations = locations.filter((entry) => entry.isActive);
  const activeProfessionals = professionals.filter((entry) => entry.isActive);
  const activeResources = resources.filter((entry) => entry.isActive);

  return <>
    <div className="page-title">
      <span className="eyebrow">Paso 2 · Estructura</span>
      <h1>Sedes, profesionales y recursos</h1>
      <p className="muted">Creá, editá, desactivá o recuperá la estructura del negocio sin perder historial ni reservas anteriores.</p>
    </div>

    <section className="setup-structure-grid">
      <div className="card setup-entity-card">
        <div className="section-head"><div><span className="eyebrow">Ubicaciones</span><h2>Sedes</h2></div><span className="setup-count"><Building2 size={15} /> {activeLocations.length} activas</span></div>
        <div className="setup-entity-list">
          {locations.length ? locations.map((entry) => <details className={`setup-manage-row ${entry.isActive ? "" : "is-archived"}`} key={entry.id}>
            <summary>
              <span className="setup-entity-icon"><Building2 size={14} /></span>
              <div><strong>{entry.name}</strong><small>{entry.address || "Sin dirección cargada"} · {entry._count.professionals} profesionales · {entry._count.resources} recursos</small></div>
              <span className={`status ${entry.isActive ? "ACTIVE" : "SUSPENDED"}`}>{entry.isActive ? "Activa" : "Inactiva"}</span>
            </summary>
            <div className="setup-manage-panel">
              <form action={updateLocationAction} className="setup-edit-form">
                <input type="hidden" name="locationId" value={entry.id} />
                <div className="field"><label>Nombre</label><input className="input" name="name" defaultValue={entry.name} required /></div>
                <div className="field"><label>Dirección</label><input className="input" name="address" defaultValue={entry.address ?? ""} /></div>
                <button className="button secondary"><Pencil size={14} /> Guardar cambios</button>
              </form>
              <form action={setLocationActiveAction} className="setup-lifecycle-action">
                <input type="hidden" name="locationId" value={entry.id} />
                <input type="hidden" name="active" value={entry.isActive ? "false" : "true"} />
                <button className={`button ${entry.isActive ? "ghost danger-action" : "secondary"}`}>
                  {entry.isActive ? <><XCircle size={14} /> Desactivar sede</> : <><RotateCcw size={14} /> Reactivar sede</>}
                </button>
                <small className="muted">{entry.isActive ? "Se bloqueará si tiene reservas o sesiones futuras." : "Vuelve a estar disponible para nuevas configuraciones."}</small>
              </form>
            </div>
          </details>) : <div className="empty">Todavía no hay sedes.</div>}
        </div>
        <form action={createLocationAction} className="setup-inline-form">
          <div className="setup-inline-form-head"><Plus size={14} /><strong>Agregar sede</strong></div>
          <input className="input" name="name" placeholder="Ej. Sucursal Centro" required />
          <input className="input" name="address" placeholder="Dirección (opcional)" />
          <button className="button secondary">Agregar</button>
        </form>
      </div>

      <div className="card setup-entity-card">
        <div className="section-head"><div><span className="eyebrow">Personas</span><h2>Profesionales</h2></div><span className="setup-count"><Users size={15} /> {activeProfessionals.length} activos</span></div>
        <div className="setup-entity-list">
          {professionals.length ? professionals.map((entry) => <details className={`setup-manage-row ${entry.isActive ? "" : "is-archived"}`} key={entry.id}>
            <summary>
              <span className="dot" style={{ background: entry.color }} />
              <div><strong>{entry.name}</strong><small>{entry.location?.name || "Sin sede fija"} · {entry._count.services} servicios · {entry._count.bookings} reservas históricas</small></div>
              <span className={`status ${entry.isActive ? "ACTIVE" : "SUSPENDED"}`}>{entry.isActive ? "Activo" : "Inactivo"}</span>
            </summary>
            <div className="setup-manage-panel">
              <form action={updateProfessionalAction} className="setup-edit-form">
                <input type="hidden" name="professionalId" value={entry.id} />
                <div className="field"><label>Nombre</label><input className="input" name="name" defaultValue={entry.name} required /></div>
                <div className="field"><label>Sede fija</label><select className="select" name="locationId" defaultValue={entry.locationId ?? ""}><option value="">Sin sede fija</option>{activeLocations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></div>
                <div className="setup-color-submit"><input type="color" name="color" defaultValue={entry.color} aria-label="Color en agenda" /><button className="button secondary"><Pencil size={14} /> Guardar cambios</button></div>
              </form>
              <form action={setProfessionalActiveAction} className="setup-lifecycle-action">
                <input type="hidden" name="professionalId" value={entry.id} />
                <input type="hidden" name="active" value={entry.isActive ? "false" : "true"} />
                <button className={`button ${entry.isActive ? "ghost danger-action" : "secondary"}`}>
                  {entry.isActive ? <><XCircle size={14} /> Desactivar profesional</> : <><RotateCcw size={14} /> Reactivar profesional</>}
                </button>
                <small className="muted">{entry.isActive ? "No se puede desactivar si tiene actividad futura." : "Conserva historial, servicios y reservas anteriores."}</small>
              </form>
            </div>
          </details>) : <div className="empty">Todavía no hay profesionales.</div>}
        </div>
        <form action={createProfessionalAction} className="setup-inline-form">
          <div className="setup-inline-form-head"><Plus size={14} /><strong>Agregar profesional</strong></div>
          <input className="input" name="name" placeholder="Nombre" required />
          <select className="select" name="locationId" defaultValue=""><option value="">Sin sede fija</option>{activeLocations.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select>
          <div className="setup-color-submit"><input type="color" name="color" defaultValue="#2563eb" aria-label="Color en agenda" /><button className="button secondary">Agregar</button></div>
        </form>
      </div>

      <div className="card setup-entity-card">
        <div className="section-head"><div><span className="eyebrow">Activos reservables</span><h2>Recursos</h2></div><span className="setup-count"><Wrench size={15} /> {activeResources.length} activos</span></div>
        <div className="setup-entity-list">
          {resources.length ? resources.map((entry) => <details className={`setup-manage-row ${entry.isActive ? "" : "is-archived"}`} key={entry.id}>
            <summary>
              <span className="dot" style={{ background: entry.color }} />
              <div><strong>{entry.name}</strong><small>{entry.type || "Recurso"} · capacidad {entry.capacity}{entry.location?.name ? ` · ${entry.location.name}` : ""} · {entry._count.services} servicios</small></div>
              <span className={`status ${entry.isActive ? "ACTIVE" : "SUSPENDED"}`}>{entry.isActive ? "Activo" : "Inactivo"}</span>
            </summary>
            <div className="setup-manage-panel">
              <form action={updateResourceAction} className="setup-edit-form">
                <input type="hidden" name="resourceId" value={entry.id} />
                <div className="field"><label>Nombre</label><input className="input" name="name" defaultValue={entry.name} required /></div>
                <div className="field"><label>Tipo</label><input className="input" name="type" defaultValue={entry.type ?? ""} /></div>
                <div className="field"><label>Capacidad</label><input className="input" name="capacity" type="number" min="1" max="1000" defaultValue={entry.capacity} required /></div>
                <div className="field"><label>Sede fija</label><select className="select" name="locationId" defaultValue={entry.locationId ?? ""}><option value="">Sin sede fija</option>{activeLocations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></div>
                <div className="setup-color-submit"><input type="color" name="color" defaultValue={entry.color} aria-label="Color en agenda" /><button className="button secondary"><Pencil size={14} /> Guardar cambios</button></div>
              </form>
              <form action={setResourceActiveAction} className="setup-lifecycle-action">
                <input type="hidden" name="resourceId" value={entry.id} />
                <input type="hidden" name="active" value={entry.isActive ? "false" : "true"} />
                <button className={`button ${entry.isActive ? "ghost danger-action" : "secondary"}`}>
                  {entry.isActive ? <><XCircle size={14} /> Desactivar recurso</> : <><RotateCcw size={14} /> Reactivar recurso</>}
                </button>
                <small className="muted">{entry.isActive ? "Se bloqueará si el recurso tiene reservas o sesiones futuras." : "El historial y sus relaciones se conservan."}</small>
              </form>
            </div>
          </details>) : <div className="empty">Todavía no hay recursos.</div>}
        </div>
        <form action={createResourceAction} className="setup-inline-form">
          <div className="setup-inline-form-head"><Plus size={14} /><strong>Agregar recurso</strong></div>
          <input className="input" name="name" placeholder="Sala, cancha, box, equipo…" required />
          <div className="grid" style={{ gridTemplateColumns: "1fr 100px", gap: 8 }}><input className="input" name="type" placeholder="Tipo" /><input className="input" name="capacity" type="number" min="1" max="1000" defaultValue="1" aria-label="Capacidad" /></div>
          <select className="select" name="locationId" defaultValue=""><option value="">Sin sede fija</option>{activeLocations.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select>
          <div className="setup-color-submit"><input type="color" name="color" defaultValue="#10b981" aria-label="Color en agenda" /><button className="button secondary">Agregar</button></div>
        </form>
      </div>
    </section>

    <div className="card setup-note"><strong>Gestión segura</strong><p className="muted">OnlyTurn no borra historial operativo. Si una sede, profesional o recurso ya participó de reservas, se desactiva y puede reactivarse después. Si tiene actividad futura, primero hay que cancelar o reasignar esas reservas.</p></div>
  </>;
}
