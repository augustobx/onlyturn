import { BadgeCheck, Gift, PackagePlus, Pencil, RotateCcw, TicketCheck, XCircle } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { getPackageManagementData } from "@/lib/packages";
import { cancelCustomerPackageAction, createServicePackageAction, grantCustomerPackageAction, setServicePackageActiveAction, updateServicePackageAction } from "@/app/actions/packages";

export default async function PackagesPage() {
  const { membership, tenant } = await requireTenantSession();
  const [packages, services, customers, customerPackages] = await getPackageManagementData(membership.tenantId);
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: tenant.currency, maximumFractionDigits: 0 });
  const activeMemberships = customerPackages.filter((item) => item.status === "ACTIVE").length;

  return <>
    <div className="page-title"><span className="eyebrow">Bonos y fidelización</span><h1>Paquetes y membresías</h1><p className="muted">Editá el catálogo comercial cuando quieras. Las membresías ya asignadas conservan nombre, precio y cantidad de usos originales.</p></div>
    <section className="grid stats" style={{ marginBottom: 18 }}>
      <div className="card stat"><span className="muted">Paquetes activos</span><strong>{packages.filter((item) => item.isActive).length}</strong><small className="muted">catálogo comercial</small></div>
      <div className="card stat"><span className="muted">Membresías activas</span><strong>{activeMemberships}</strong><small className="muted">clientes con usos disponibles</small></div>
      <div className="card stat"><span className="muted">Usos restantes</span><strong>{customerPackages.filter((item) => item.status === "ACTIVE").reduce((sum, item) => sum + item.remainingUses, 0)}</strong><small className="muted">entre todos los clientes</small></div>
      <div className="card stat"><span className="muted">Archivados</span><strong>{packages.filter((item) => !item.isActive).length}</strong><small className="muted">recuperables</small></div>
    </section>

    <section className="grid two-col" style={{ alignItems: "start" }}>
      <form action={createServicePackageAction} className="card">
        <div className="section-head"><h2><PackagePlus size={17} /> Crear paquete</h2></div>
        <div className="field"><label>Nombre *</label><input className="input" name="name" placeholder="Ej. Pack 10 sesiones" required /></div>
        <div className="field"><label>Descripción</label><textarea className="input" name="description" rows={3} placeholder="Qué incluye y condiciones comerciales" /></div>
        <div className="setup-edit-form"><div className="field"><label>Precio</label><input className="input" name="price" type="number" min="0" step="0.01" defaultValue="0" required /></div><div className="field"><label>Usos</label><input className="input" name="uses" type="number" min="1" max="1000" defaultValue="5" required /></div><div className="field"><label>Vigencia</label><input className="input" name="validityDays" type="number" min="1" max="3650" placeholder="Sin vencimiento" /></div></div>
        <div className="field"><label>Servicios incluidos *</label><select className="select" name="serviceIds" multiple size={Math.min(8, Math.max(3, services.length))} required>{services.map((service) => <option value={service.id} key={service.id}>{service.category ? `${service.category} · ` : ""}{service.name}</option>)}</select><small className="muted">Podés seleccionar uno o varios servicios.</small></div>
        <button className="button" style={{ width: "100%" }}><Gift size={15} /> Crear paquete</button>
      </form>

      <form action={grantCustomerPackageAction} className="card">
        <div className="section-head"><h2><BadgeCheck size={17} /> Asignar a cliente</h2></div>
        <p className="muted">Usalo después de una venta presencial, transferencia, promoción o cortesía.</p>
        <div className="field"><label>Paquete *</label><select className="select" name="packageId" required defaultValue=""><option value="" disabled>Seleccionar</option>{packages.filter((item) => item.isActive).map((item) => <option value={item.id} key={item.id}>{item.name} · {item.uses} usos · {money.format(item.priceCents / 100)}</option>)}</select></div>
        <div className="field"><label>Cliente *</label><select className="select" name="customerId" required defaultValue=""><option value="" disabled>Seleccionar</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.firstName} {customer.lastName ?? ""} · {customer.phone}</option>)}</select></div>
        <button className="button" style={{ width: "100%" }}><TicketCheck size={15} /> Asignar membresía</button>
      </form>
    </section>

    <div className="platform-toolbar"><div><h2>Catálogo de paquetes</h2><span className="muted">Abrí cualquiera para editarlo o cambiar su estado.</span></div></div>
    <div className="settings-manage-list">
      {packages.map((item) => <details className={`card settings-manage-item ${item.isActive ? "" : "is-archived"}`} key={item.id}>
        <summary><div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><strong>{item.name}</strong><span className="pill">{item.uses} usos</span></div><small>{money.format(item.priceCents / 100)} · {item.validityDays ? `${item.validityDays} días` : "sin vencimiento"} · {item.services.map((link) => link.service.name).join(", ")} · {item._count.customerPackages} asignaciones</small></div><span className={`status ${item.isActive ? "ACTIVE" : "SUSPENDED"}`}>{item.isActive ? "Activo" : "Archivado"}</span></summary>
        <div className="settings-manage-panel">
          <form action={updateServicePackageAction} className="setup-edit-form">
            <input type="hidden" name="packageId" value={item.id} />
            <div className="field"><label>Nombre</label><input className="input" name="name" defaultValue={item.name} required /></div>
            <div className="field"><label>Descripción</label><input className="input" name="description" defaultValue={item.description ?? ""} /></div>
            <div className="field"><label>Precio</label><input className="input" name="price" type="number" min="0" step="0.01" defaultValue={item.priceCents / 100} required /></div>
            <div className="field"><label>Usos</label><input className="input" name="uses" type="number" min="1" max="1000" defaultValue={item.uses} required /></div>
            <div className="field"><label>Vigencia en días</label><input className="input" name="validityDays" type="number" min="1" max="3650" defaultValue={item.validityDays ?? ""} /></div>
            <div className="field"><label>Servicios incluidos</label><select className="select" name="serviceIds" multiple size={Math.min(8, Math.max(3, services.length))} defaultValue={item.services.map((link) => link.serviceId)} required>{services.map((service) => <option value={service.id} key={service.id}>{service.category ? `${service.category} · ` : ""}{service.name}</option>)}</select></div>
            <button className="button secondary"><Pencil size={14} /> Guardar cambios</button>
          </form>
          <form action={setServicePackageActiveAction} className="setup-lifecycle-action"><input type="hidden" name="packageId" value={item.id} /><input type="hidden" name="active" value={item.isActive ? "false" : "true"} /><button className={`button ${item.isActive ? "ghost danger-action" : "secondary"}`}>{item.isActive ? <><XCircle size={14} /> Archivar paquete</> : <><RotateCcw size={14} /> Reactivar paquete</>}</button><small className="muted">Esto sólo afecta nuevas asignaciones. Las membresías ya entregadas no cambian.</small></form>
        </div>
      </details>)}
      {!packages.length && <div className="card empty">Todavía no hay paquetes.</div>}
    </div>

    <div className="platform-toolbar"><h2>Membresías de clientes</h2></div>
    <div className="card table-wrap"><table className="table"><thead><tr><th>Cliente</th><th>Paquete</th><th>Usos</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>{customerPackages.length ? customerPackages.map((item) => <tr key={item.id}><td><strong>{item.customer.firstName} {item.customer.lastName ?? ""}</strong><div className="muted" style={{ fontSize: 11 }}>{item.customer.phone}</div></td><td>{item.name}</td><td><strong>{item.remainingUses}</strong> / {item.totalUses}</td><td>{item.expiresAt ? new Intl.DateTimeFormat("es-AR").format(item.expiresAt) : "Sin vencimiento"}</td><td><span className={`status ${item.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED"}`}>{item.status}</span></td><td style={{ textAlign: "right" }}>{item.status === "ACTIVE" && <form action={cancelCustomerPackageAction}><input type="hidden" name="customerPackageId" value={item.id} /><button className="button ghost danger-action" aria-label="Cancelar membresía"><XCircle size={14} /></button></form>}</td></tr>) : <tr><td colSpan={6}><div className="empty">Todavía no hay membresías asignadas.</div></td></tr>}</tbody></table></div>
  </>;
}
