import { requireSuperAdmin } from "@/lib/auth";
import { platformDb } from "@/lib/db";
import { changeTenantPlanAction, createTenantAction, extendTrialAction, updateTenantStatusAction } from "@/app/actions/superadmin";

export default async function SuperAdminPage(){
  await requireSuperAdmin();
  const [tenants,plans]=await Promise.all([
    platformDb.tenant.findMany({include:{subscriptions:{include:{plan:true},orderBy:{createdAt:"desc"},take:1},_count:{select:{memberships:true,customers:true,bookings:true,locations:true}}},orderBy:{createdAt:"desc"}}),
    platformDb.plan.findMany({where:{isActive:true},orderBy:{priceCents:"asc"}})
  ]);
  return <><div className="page-title"><span className="eyebrow">Plano de plataforma</span><h1>SuperAdmin</h1><p className="muted">Tenants, suscripciones y uso global sin mezclar permisos operativos.</p></div>
    <section className="grid stats"><div className="card stat"><span className="muted">Tenants</span><strong>{tenants.length}</strong></div><div className="card stat"><span className="muted">Activos / trial</span><strong>{tenants.filter(t=>["ACTIVE","TRIAL"].includes(t.status)).length}</strong></div><div className="card stat"><span className="muted">Reservas</span><strong>{tenants.reduce((n,t)=>n+t._count.bookings,0)}</strong></div><div className="card stat"><span className="muted">Clientes</span><strong>{tenants.reduce((n,t)=>n+t._count.customers,0)}</strong></div></section>
    <details className="card" style={{marginTop:18}}><summary style={{cursor:"pointer",fontWeight:750}}>Crear tenant</summary><form action={createTenantAction} className="grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginTop:16}}><input className="input" name="name" placeholder="Nombre del negocio" required/><input className="input" name="slug" placeholder="slug-publico" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required/><select className="select" name="planId">{plans.map(plan=><option value={plan.id} key={plan.id}>{plan.name}</option>)}</select><input className="input" name="ownerName" placeholder="Nombre del owner" required/><input className="input" name="ownerEmail" type="email" placeholder="owner@negocio.com" required/><input className="input" name="password" type="password" minLength={10} placeholder="Contraseña temporal" required/><button className="button" style={{gridColumn:"1/-1"}}>Crear tenant y trial de 14 días</button></form></details>
    <div className="card table-wrap" style={{marginTop:18}}><table className="table"><thead><tr><th>Negocio</th><th>Estado</th><th>Plan</th><th>Uso</th><th>Trial</th><th>Control</th></tr></thead><tbody>{tenants.map(tenant=><tr key={tenant.id}>
      <td><strong>{tenant.name}</strong><div className="muted" style={{fontSize:11}}>{tenant.slug} · alta {new Intl.DateTimeFormat("es-AR").format(tenant.createdAt)}</div></td>
      <td><span className={`status ${tenant.status}`}>{tenant.status}</span></td>
      <td><form action={changeTenantPlanAction} style={{display:"flex",gap:5}}><input type="hidden" name="tenantId" value={tenant.id}/><select className="select" name="planId" defaultValue={tenant.subscriptions[0]?.planId}>{plans.map(plan=><option value={plan.id} key={plan.id}>{plan.name}</option>)}</select><button className="button secondary">Aplicar</button></form></td>
      <td><strong>{tenant._count.bookings}</strong> turnos<div className="muted" style={{fontSize:11}}>{tenant._count.memberships} usuarios · {tenant._count.customers} clientes · {tenant._count.locations} sucursales</div></td>
      <td><form action={extendTrialAction} style={{display:"flex",gap:5}}><input type="hidden" name="tenantId" value={tenant.id}/><input className="input" name="days" type="number" min="1" max="365" defaultValue="7" style={{width:64}}/><button className="button secondary">Extender</button></form></td>
      <td><form action={updateTenantStatusAction} style={{display:"flex",gap:5}}><input type="hidden" name="tenantId" value={tenant.id}/><select className="select" name="status" defaultValue={tenant.status}><option value="TRIAL">Trial</option><option value="ACTIVE">Activo</option><option value="SUSPENDED">Suspendido</option><option value="CANCELLED">Cancelado</option></select><button className="button secondary">Guardar</button></form></td>
    </tr>)}</tbody></table></div></>;
}
