import Link from "next/link";
import { createTenantAction } from "@/app/actions/superadmin";
import { requireSuperAdmin } from "@/lib/auth";
import { platformDb } from "@/lib/db";
import { tenantPublicUrl } from "@/lib/hostnames";

const statusLabel: Record<string, string> = { TRIAL: "Trial", ACTIVE: "Activo", SUSPENDED: "Suspendido", CANCELLED: "Cancelado" };

export default async function SuperAdminTenantsPage() {
  await requireSuperAdmin();

  const [tenants, plans] = await Promise.all([
    platformDb.tenant.findMany({
      include: {
        memberships: { where: { role: "OWNER", isActive: true }, include: { user: true }, take: 1 },
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { memberships: true, customers: true, bookings: true, locations: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    platformDb.plan.findMany({ where: { isActive: true }, orderBy: { priceCents: "asc" } }),
  ]);

  return <>
    <div className="page-title">
      <span className="eyebrow">NanoLabs · SaaS</span>
      <h1>Tenants</h1>
      <p className="muted">Alta y control de clientes OnlyTurn. Cada tenant opera en su propio <strong>slug.nanoapps.ar</strong>.</p>
    </div>

    <details className="card" style={{marginBottom:18}}>
      <summary style={{cursor:"pointer",fontWeight:800}}>Crear tenant</summary>
      <form action={createTenantAction} className="grid" style={{gridTemplateColumns:"repeat(3,minmax(0,1fr))",marginTop:16}}>
        <input className="input" name="name" placeholder="Nombre del negocio" required />
        <input className="input" name="slug" placeholder="slug-del-negocio" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
        <select className="select" name="planId" required>{plans.map(plan=><option value={plan.id} key={plan.id}>{plan.name}</option>)}</select>
        <input className="input" name="ownerName" placeholder="Responsable" required />
        <input className="input" name="ownerEmail" type="email" placeholder="responsable@negocio.com" required />
        <input className="input" name="password" type="password" minLength={10} placeholder="Contraseña inicial" required />
        <button className="button" style={{gridColumn:"1/-1"}}>Crear tenant</button>
      </form>
    </details>

    <div className="card table-wrap">
      <table className="table">
        <thead><tr><th>Negocio</th><th>Owner</th><th>Estado</th><th>Plan</th><th>Membresía</th><th>Uso</th><th></th></tr></thead>
        <tbody>{tenants.length ? tenants.map(tenant=>{
          const owner=tenant.memberships[0]?.user;
          const subscription=tenant.subscriptions[0];
          return <tr key={tenant.id}>
            <td><strong>{tenant.name}</strong><div className="muted" style={{fontSize:11}}>{tenantPublicUrl(tenant.slug)}</div></td>
            <td>{owner?.name ?? "—"}<div className="muted" style={{fontSize:11}}>{owner?.email ?? "Sin owner"}</div></td>
            <td><span className={`status ${tenant.status}`}>{statusLabel[tenant.status] ?? tenant.status}</span></td>
            <td>{subscription?.plan.name ?? "Sin plan"}</td>
            <td>{subscription ? <><strong>{new Intl.DateTimeFormat("es-AR").format(subscription.currentPeriodEnd)}</strong><div className="muted" style={{fontSize:11}}>{subscription.status}</div></> : "—"}</td>
            <td>{tenant._count.bookings} turnos<div className="muted" style={{fontSize:11}}>{tenant._count.customers} clientes · {tenant._count.locations} sedes</div></td>
            <td><Link className="button secondary" href={`/superadmin/tenants/${tenant.id}`}>Administrar</Link></td>
          </tr>;
        }) : <tr><td colSpan={7}><div className="empty">Todavía no hay tenants.</div></td></tr>}</tbody>
      </table>
    </div>
  </>;
}
