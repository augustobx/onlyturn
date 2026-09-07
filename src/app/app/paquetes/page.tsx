import { Archive, BadgeCheck, Gift, PackagePlus, TicketCheck, XCircle } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { getPackageManagementData } from "@/lib/packages";
import { archiveServicePackageAction, cancelCustomerPackageAction, createServicePackageAction, grantCustomerPackageAction } from "@/app/actions/packages";

export default async function PackagesPage() {
  const { membership, tenant } = await requireTenantSession();
  const [packages, services, customers, customerPackages] = await getPackageManagementData(membership.tenantId);
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: tenant.currency, maximumFractionDigits: 0 });
  const activeMemberships = customerPackages.filter((item) => item.status === "ACTIVE").length;

  return (
    <>
      <div className="page-title"><span className="eyebrow">Bonos y fidelización</span><h1>Paquetes y membresías</h1><p className="muted">Vendé o asigná packs de usos válidos para uno o varios servicios, con vencimiento opcional y consumo trazable por reserva.</p></div>
      <section className="grid stats" style={{ marginBottom: 18 }}>
        <div className="card stat"><span className="muted">Paquetes activos</span><strong>{packages.filter((item) => item.isActive).length}</strong><small className="muted">catálogo comercial</small></div>
        <div className="card stat"><span className="muted">Membresías activas</span><strong>{activeMemberships}</strong><small className="muted">clientes con usos disponibles</small></div>
        <div className="card stat"><span className="muted">Usos restantes</span><strong>{customerPackages.filter((item) => item.status === "ACTIVE").reduce((sum, item) => sum + item.remainingUses, 0)}</strong><small className="muted">entre todos los clientes</small></div>
        <div className="card stat"><span className="muted">Servicios elegibles</span><strong>{services.length}</strong><small className="muted">servicios activos</small></div>
      </section>

      <section className="grid two-col" style={{ alignItems: "start" }}>
        <form action={createServicePackageAction} className="card">
          <div className="section-head"><h2><PackagePlus size={17} /> Crear paquete</h2></div>
          <div className="field"><label>Nombre *</label><input className="input" name="name" placeholder="Ej. Pack 10 sesiones" required /></div>
          <div className="field"><label>Descripción</label><textarea className="input" name="description" rows={3} placeholder="Qué incluye y condiciones comerciales" /></div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
            <div className="field"><label>Precio</label><input className="input" name="price" type="number" min="0" step="0.01" defaultValue="0" required /></div>
            <div className="field"><label>Usos</label><input className="input" name="uses" type="number" min="1" max="1000" defaultValue="5" required /></div>
            <div className="field"><label>Vigencia</label><input className="input" name="validityDays" type="number" min="1" max="3650" placeholder="Sin vencimiento" /></div>
          </div>
          <div className="field"><label>Servicios incluidos *</label><select className="select" name="serviceIds" multiple size={Math.min(8, Math.max(3, services.length))} required>{services.map((service) => <option value={service.id} key={service.id}>{service.category ? `${service.category} · ` : ""}{service.name}</option>)}</select><small className="muted">Podés seleccionar uno o varios servicios.</small></div>
          <button className="button" style={{ width: "100%" }}><Gift size={15} /> Crear paquete</button>
        </form>

        <form action={grantCustomerPackageAction} className="card">
          <div className="section-head"><h2><BadgeCheck size={17} /> Asignar a cliente</h2></div>
          <p className="muted">Usalo después de una venta presencial, transferencia, promoción o cortesía. El cliente verá el pase en su cuenta y podrá usarlo al reservar.</p>
          <div className="field"><label>Paquete *</label><select className="select" name="packageId" required defaultValue=""><option value="" disabled>Seleccionar</option>{packages.filter((item) => item.isActive).map((item) => <option value={item.id} key={item.id}>{item.name} · {item.uses} usos · {money.format(item.priceCents / 100)}</option>)}</select></div>
          <div className="field"><label>Cliente *</label><select className="select" name="customerId" required defaultValue=""><option value="" disabled>Seleccionar</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.firstName} {customer.lastName ?? ""} · {customer.phone}</option>)}</select></div>
          <button className="button" style={{ width: "100%" }}><TicketCheck size={15} /> Asignar membresía</button>
        </form>
      </section>

      <div className="platform-toolbar"><h2>Catálogo de paquetes</h2></div>
      <div className="grid" style={{ gap: 10 }}>
        {packages.map((item) => <div className="card" key={item.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, alignItems: "center" }}>
          <div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><strong>{item.name}</strong><span className={`status ${item.isActive ? "ACTIVE" : "SUSPENDED"}`}>{item.isActive ? "Activo" : "Archivado"}</span><span className="pill">{item.uses} usos</span></div><p className="muted" style={{ margin: "5px 0" }}>{item.description || "Sin descripción"}</p><small className="muted">{money.format(item.priceCents / 100)} · {item.validityDays ? `${item.validityDays} días de vigencia` : "sin vencimiento"} · {item.services.map((link) => link.service.name).join(", ")} · {item._count.customerPackages} asignaciones</small></div>
          {item.isActive && <form action={archiveServicePackageAction}><input type="hidden" name="packageId" value={item.id} /><button className="button ghost" style={{ color: "#b42331" }}><Archive size={14} /></button></form>}
        </div>)}
        {!packages.length && <div className="card empty">Todavía no hay paquetes.</div>}
      </div>

      <div className="platform-toolbar"><h2>Membresías de clientes</h2></div>
      <div className="card table-wrap"><table className="table"><thead><tr><th>Cliente</th><th>Paquete</th><th>Usos</th><th>Vence</th><th>Estado</th><th></th></tr></thead><tbody>{customerPackages.length ? customerPackages.map((item) => <tr key={item.id}><td><strong>{item.customer.firstName} {item.customer.lastName ?? ""}</strong><div className="muted" style={{ fontSize: 11 }}>{item.customer.phone}</div></td><td>{item.name}</td><td><strong>{item.remainingUses}</strong> / {item.totalUses}</td><td>{item.expiresAt ? new Intl.DateTimeFormat("es-AR").format(item.expiresAt) : "Sin vencimiento"}</td><td><span className={`status ${item.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED"}`}>{item.status}</span></td><td style={{ textAlign: "right" }}>{item.status === "ACTIVE" && <form action={cancelCustomerPackageAction}><input type="hidden" name="customerPackageId" value={item.id} /><button className="button ghost" style={{ color: "#b42331", padding: 7 }} aria-label="Cancelar membresía"><XCircle size={14} /></button></form>}</td></tr>) : <tr><td colSpan={6}><div className="empty">Todavía no hay membresías asignadas.</div></td></tr>}</tbody></table></div>
    </>
  );
}
