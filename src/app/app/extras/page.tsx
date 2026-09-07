import { Clock3, Pencil, Plus, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { getServiceAddonManagementData } from "@/lib/service-addons";
import { createServiceAddonAction, setServiceAddonActiveAction, updateServiceAddonAction } from "@/app/actions/service-addons";

export default async function ExtrasPage() {
  const { membership, tenant } = await requireTenantSession();
  const [services, addons] = await getServiceAddonManagementData(membership.tenantId);
  const activeAddons = addons.filter((addon) => addon.isActive);
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: tenant.currency, maximumFractionDigits: 0 });

  return <>
    <div className="page-title">
      <span className="eyebrow">Personalización de la reserva</span>
      <h1>Extras y complementos</h1>
      <p className="muted">Creá, editá, desactivá o recuperá adicionales sin alterar las reservas históricas que ya guardaron su propio snapshot.</p>
    </div>

    {!services.length ? <div className="card empty">Creá al menos un tipo de reserva antes de configurar extras.</div> : <details className="card" open={!activeAddons.length}>
      <summary style={{ cursor: "pointer", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><Plus size={17} /> Nuevo extra</summary>
      <form action={createServiceAddonAction} className="setup-edit-form" style={{ marginTop: 18 }}>
        <div className="field"><label>Aplicar a *</label><select className="select" name="serviceId" required defaultValue=""><option value="" disabled>Seleccionar servicio</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name} · {service.bookingType}</option>)}</select></div>
        <div className="field"><label>Nombre *</label><input className="input" name="name" required maxLength={100} placeholder="Ej. Masaje capilar premium" /></div>
        <div className="field"><label>Descripción pública</label><input className="input" name="description" maxLength={300} placeholder="Qué agrega este complemento" /></div>
        <div className="field"><label>Precio adicional</label><input className="input" name="price" type="number" min="0" step="0.01" defaultValue="0" required /></div>
        <div className="field"><label>Minutos adicionales</label><input className="input" name="durationMinutes" type="number" min="0" max="720" defaultValue="0" required /></div>
        <div className="field"><label>Preparación adicional</label><input className="input" name="preparationMinutes" type="number" min="0" max="720" defaultValue="0" required /></div>
        <button className="button"><Sparkles size={15} /> Crear extra</button>
      </form>
    </details>}

    <div className="platform-toolbar"><div><h2>Extras configurados</h2><span className="muted">{activeAddons.length} activos · {addons.length - activeAddons.length} archivados</span></div></div>
    <div className="settings-manage-list">
      {addons.length ? addons.map((addon) => <details className={`card settings-manage-item ${addon.isActive ? "" : "is-archived"}`} key={addon.id}>
        <summary>
          <div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><strong>{addon.name}</strong><span className="pill">{addon.service.name}</span></div><small>{money.format(addon.priceCents / 100)}{addon.durationMinutes ? ` · +${addon.durationMinutes} min` : ""}{addon.preparationMinutes ? ` · +${addon.preparationMinutes} min preparación` : ""}</small></div>
          <span className={`status ${addon.isActive ? "ACTIVE" : "SUSPENDED"}`}>{addon.isActive ? "Activo" : "Archivado"}</span>
        </summary>
        <div className="settings-manage-panel">
          <form action={updateServiceAddonAction} className="setup-edit-form">
            <input type="hidden" name="addonId" value={addon.id} />
            <div className="field"><label>Servicio</label><select className="select" name="serviceId" defaultValue={addon.serviceId} required>{services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></div>
            <div className="field"><label>Nombre</label><input className="input" name="name" defaultValue={addon.name} required /></div>
            <div className="field"><label>Descripción</label><input className="input" name="description" defaultValue={addon.description ?? ""} /></div>
            <div className="field"><label>Precio adicional</label><input className="input" name="price" type="number" min="0" step="0.01" defaultValue={addon.priceCents / 100} required /></div>
            <div className="field"><label>Minutos adicionales</label><input className="input" name="durationMinutes" type="number" min="0" max="720" defaultValue={addon.durationMinutes} required /></div>
            <div className="field"><label>Preparación adicional</label><input className="input" name="preparationMinutes" type="number" min="0" max="720" defaultValue={addon.preparationMinutes} required /></div>
            <button className="button secondary"><Pencil size={14} /> Guardar cambios</button>
          </form>
          <form action={setServiceAddonActiveAction} className="setup-lifecycle-action"><input type="hidden" name="addonId" value={addon.id} /><input type="hidden" name="active" value={addon.isActive ? "false" : "true"} /><button className={`button ${addon.isActive ? "ghost danger-action" : "secondary"}`}>{addon.isActive ? <><XCircle size={14} /> Archivar extra</> : <><RotateCcw size={14} /> Reactivar extra</>}</button><small className="muted">Los extras ya usados en reservas conservan precio, nombre y duración históricos.</small></form>
        </div>
      </details>) : <div className="card empty">Todavía no hay extras.</div>}
    </div>
  </>;
}
