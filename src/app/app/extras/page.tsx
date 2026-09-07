import { Archive, Clock3, Plus, Sparkles } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { getServiceAddonManagementData } from "@/lib/service-addons";
import { archiveServiceAddonAction, createServiceAddonAction } from "@/app/actions/service-addons";

export default async function ExtrasPage() {
  const { membership, tenant } = await requireTenantSession();
  const [services, addons] = await getServiceAddonManagementData(membership.tenantId);
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: tenant.currency, maximumFractionDigits: 0 });

  return (
    <>
      <div className="page-title">
        <span className="eyebrow">Personalización de la reserva</span>
        <h1>Extras y complementos</h1>
        <p className="muted">Vendé adicionales o extendé un turno sin duplicar servicios: tratamientos extra, equipamiento, desayuno, materiales, informes, opciones premium y más.</p>
      </div>

      {!services.length ? (
        <div className="card empty">Creá al menos un tipo de reserva antes de configurar extras.</div>
      ) : (
        <details className="card" open={!addons.length}>
          <summary style={{ cursor: "pointer", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}><Plus size={17} /> Nuevo extra</summary>
          <form action={createServiceAddonAction} style={{ marginTop: 18 }}>
            <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
              <div className="field"><label>Aplicar a *</label><select className="select" name="serviceId" required defaultValue=""><option value="" disabled>Seleccionar servicio</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name} · {service.bookingType}</option>)}</select></div>
              <div className="field"><label>Nombre *</label><input className="input" name="name" required maxLength={100} placeholder="Ej. Masaje capilar premium" /></div>
            </div>
            <div className="field"><label>Descripción pública</label><input className="input" name="description" maxLength={300} placeholder="Qué agrega este complemento" /></div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
              <div className="field"><label>Precio adicional</label><input className="input" name="price" type="number" min="0" step="0.01" defaultValue="0" required /></div>
              <div className="field"><label>Minutos adicionales</label><input className="input" name="durationMinutes" type="number" min="0" max="720" defaultValue="0" required /><small className="muted">Para turnos o recursos.</small></div>
              <div className="field"><label>Preparación adicional</label><input className="input" name="preparationMinutes" type="number" min="0" max="720" defaultValue="0" required /></div>
            </div>
            <button className="button"><Sparkles size={15} /> Crear extra</button>
          </form>
        </details>
      )}

      <div className="platform-toolbar"><h2>Extras activos</h2><span className="muted" style={{ fontSize: 12 }}>{addons.length} configurado{addons.length === 1 ? "" : "s"}</span></div>

      <div className="grid" style={{ gap: 12 }}>
        {addons.length ? addons.map((addon) => (
          <article className="card" key={addon.id}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 16, alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><strong>{addon.name}</strong><span className="pill">{addon.service.name}</span></div>
                {addon.description && <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>{addon.description}</div>}
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  <strong>{money.format(addon.priceCents / 100)}</strong>
                  {addon.durationMinutes ? <span> · <Clock3 size={12} style={{ verticalAlign: "-2px" }} /> +{addon.durationMinutes} min</span> : null}
                  {addon.preparationMinutes ? ` · +${addon.preparationMinutes} min preparación` : ""}
                  {(addon.service.bookingType === "CLASS" || addon.service.bookingType === "EVENT") && <span> · sólo precio en sesiones</span>}
                </div>
              </div>
              <form action={archiveServiceAddonAction}>
                <input type="hidden" name="addonId" value={addon.id} />
                <button className="button ghost" style={{ color: "#b42331" }}><Archive size={14} /> Archivar</button>
              </form>
            </div>
          </article>
        )) : <div className="card empty">Todavía no hay extras. Podés seguir usando todos los servicios sin complementos.</div>}
      </div>
    </>
  );
}
