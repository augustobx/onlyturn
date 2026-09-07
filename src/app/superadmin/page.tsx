import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth";
import { platformDb } from "@/lib/db";
import { tenantPublicUrl } from "@/lib/hostnames";
import { changeTenantPlanAction, createTenantAction, extendTrialAction, updateTenantStatusAction } from "@/app/actions/superadmin";

const statusLabels: Record<string, string> = {
  TRIAL: "Trial",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  CANCELLED: "Cancelado",
};

export default async function SuperAdminPage() {
  await requireSuperAdmin();

  const [tenants, plans] = await Promise.all([
    platformDb.tenant.findMany({
      include: {
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { memberships: true, customers: true, bookings: true, locations: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    platformDb.plan.findMany({ where: { isActive: true }, orderBy: { priceCents: "asc" } }),
  ]);

  const totalBookings = tenants.reduce((total, tenant) => total + tenant._count.bookings, 0);
  const activeCount = tenants.filter((tenant) => tenant.status === "ACTIVE").length;
  const trialCount = tenants.filter((tenant) => tenant.status === "TRIAL").length;
  const suspendedCount = tenants.filter((tenant) => tenant.status === "SUSPENDED").length;

  return <>
    <div className="page-title">
      <span className="eyebrow">NanoLabs · Control de plataforma</span>
      <h1>OnlyTurn SuperAdmin</h1>
      <p className="muted">Tenants, planes, trials y uso global desde una única consola.</p>
    </div>

    <section className="platform-summary">
      <div className="card platform-stat"><span className="muted">Tenants</span><strong>{tenants.length}</strong><small className="muted">total registrados</small></div>
      <div className="card platform-stat"><span className="muted">Activos</span><strong>{activeCount}</strong><small className="muted">en producción</small></div>
      <div className="card platform-stat"><span className="muted">Trials</span><strong>{trialCount}</strong><small className="muted">en evaluación</small></div>
      <div className="card platform-stat"><span className="muted">Suspendidos</span><strong>{suspendedCount}</strong><small className="muted">sin acceso operativo</small></div>
      <div className="card platform-stat"><span className="muted">Reservas</span><strong>{totalBookings}</strong><small className="muted">acumuladas</small></div>
    </section>

    <details className="card" style={{marginTop:18}}>
      <summary style={{cursor:"pointer",fontWeight:750}}>Alta de nuevo cliente</summary>
      <p className="muted" style={{fontSize:13}}>Crea el tenant, owner y trial inicial en una sola transacción.</p>
      <form action={createTenantAction} className="grid" style={{gridTemplateColumns:"repeat(3,minmax(0,1fr))",marginTop:16}}>
        <input className="input" name="name" placeholder="Nombre del negocio" required />
        <input className="input" name="slug" placeholder="slug-del-negocio" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
        <select className="select" name="planId" required>{plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name}</option>)}</select>
        <input className="input" name="ownerName" placeholder="Nombre del responsable" required />
        <input className="input" name="ownerEmail" type="email" placeholder="responsable@negocio.com" required />
        <input className="input" name="password" type="password" minLength={10} placeholder="Contraseña temporal" required />
        <button className="button" style={{gridColumn:"1/-1"}}>Crear tenant con trial de 14 días</button>
      </form>
    </details>

    <div className="platform-toolbar"><h2>Clientes de OnlyTurn</h2><span className="muted" style={{fontSize:12}}>{tenants.length ? "Administración productiva" : "Todavía no hay clientes cargados"}</span></div>

    <div className="card table-wrap">
      <table className="table">
        <thead><tr><th>Negocio</th><th>Estado</th><th>Plan</th><th>Uso</th><th>Trial</th><th>Control</th></tr></thead>
        <tbody>
          {tenants.length ? tenants.map((tenant) => {
            const subscription = tenant.subscriptions[0];
            return <tr key={tenant.id}>
              <td>
                <div className="tenant-cell">
                  <strong>{tenant.name}</strong>
                  <small>{tenant.slug} · alta {new Intl.DateTimeFormat("es-AR").format(tenant.createdAt)}</small>
                  <Link href={tenantPublicUrl(tenant.slug)} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#2563eb"}}>Abrir sitio público ↗</Link>
                </div>
              </td>
              <td><span className={`status ${tenant.status}`}>{statusLabels[tenant.status] ?? tenant.status}</span></td>
              <td>
                <form action={changeTenantPlanAction} style={{display:"flex",gap:6,minWidth:210}}>
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <select className="select" name="planId" defaultValue={subscription?.planId} disabled={!subscription}>{plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name}</option>)}</select>
                  <button className="button secondary" disabled={!subscription}>Aplicar</button>
                </form>
              </td>
              <td><strong>{tenant._count.bookings}</strong> turnos<div className="muted" style={{fontSize:11}}>{tenant._count.memberships} usuarios · {tenant._count.customers} clientes · {tenant._count.locations} sedes</div></td>
              <td>
                <form action={extendTrialAction} style={{display:"flex",gap:6}}>
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <input className="input" name="days" type="number" min="1" max="365" defaultValue="7" style={{width:68}} />
                  <button className="button secondary">Extender</button>
                </form>
                <div className="muted" style={{fontSize:10,marginTop:5}}>{tenant.trialEndsAt ? `vence ${new Intl.DateTimeFormat("es-AR").format(tenant.trialEndsAt)}` : "sin trial vigente"}</div>
              </td>
              <td>
                <form action={updateTenantStatusAction} style={{display:"flex",gap:6,minWidth:200}}>
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <select className="select" name="status" defaultValue={tenant.status}>
                    <option value="TRIAL">Trial</option><option value="ACTIVE">Activo</option><option value="SUSPENDED">Suspendido</option><option value="CANCELLED">Cancelado</option>
                  </select>
                  <button className="button secondary">Guardar</button>
                </form>
              </td>
            </tr>;
          }) : <tr><td colSpan={6}><div className="empty">OnlyTurn está listo para crear el primer tenant productivo.</div></td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}
