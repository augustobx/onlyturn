import Link from "next/link";
import { notFound } from "next/navigation";
import { changeTenantPlanAction, updateTenantStatusAction } from "@/app/actions/superadmin";
import { renewMembershipAction } from "@/app/actions/platform-management";
import { requireSuperAdmin } from "@/lib/auth";
import { platformDb } from "@/lib/db";
import { tenantPublicUrl } from "@/lib/hostnames";

export default async function SuperAdminTenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;

  const [tenant, plans] = await Promise.all([
    platformDb.tenant.findUnique({
      where: { id },
      include: {
        memberships: { where: { role: "OWNER", isActive: true }, include: { user: true }, take: 1 },
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { memberships: true, customers: true, bookings: true, locations: true, professionals: true, resources: true } },
      },
    }),
    platformDb.plan.findMany({ where: { isActive: true }, orderBy: { priceCents: "asc" } }),
  ]);
  if (!tenant) notFound();

  const owner = tenant.memberships[0]?.user;
  const subscription = tenant.subscriptions[0];
  const publicUrl = tenantPublicUrl(tenant.slug);
  const date = new Intl.DateTimeFormat("es-AR");

  return <>
    <div className="page-title">
      <span className="eyebrow">NanoLabs · Tenant</span>
      <h1>{tenant.name}</h1>
      <p className="muted">{publicUrl}</p>
    </div>

    <section className="grid stats">
      <div className="card stat"><span className="muted">Estado</span><strong style={{fontSize:22}}>{tenant.status}</strong></div>
      <div className="card stat"><span className="muted">Plan</span><strong style={{fontSize:22}}>{subscription?.plan.name ?? "Sin plan"}</strong></div>
      <div className="card stat"><span className="muted">Turnos</span><strong>{tenant._count.bookings}</strong></div>
      <div className="card stat"><span className="muted">Clientes</span><strong>{tenant._count.customers}</strong></div>
    </section>

    <div className="grid two-col" style={{marginTop:18}}>
      <section className="card">
        <h2>Accesos del tenant</h2>
        <div className="stack" style={{display:"grid",gap:10}}>
          <div><span className="muted">Sitio público</span><div><Link href={publicUrl} target="_blank">{publicUrl} ↗</Link></div></div>
          <div><span className="muted">Panel administrativo</span><div><Link href={`${publicUrl}/login`} target="_blank">{publicUrl}/login ↗</Link></div></div>
          <div><span className="muted">Owner</span><div><strong>{owner?.name ?? "Sin owner"}</strong> · {owner?.email ?? "—"}</div></div>
          <div><span className="muted">Alta</span><div>{date.format(tenant.createdAt)}</div></div>
        </div>
      </section>

      <section className="card">
        <h2>Membresía</h2>
        {subscription ? <>
          <p><strong>{subscription.status}</strong> · {subscription.plan.name}</p>
          <p className="muted">Inicio: {date.format(subscription.currentPeriodStart)} · Vencimiento: {date.format(subscription.currentPeriodEnd)}</p>
          <form action={renewMembershipAction} style={{display:"flex",gap:8,alignItems:"end",marginTop:14}}>
            <input type="hidden" name="tenantId" value={tenant.id}/>
            <div className="field" style={{margin:0}}><label>Renovar días</label><input className="input" name="days" type="number" min="1" max="3650" defaultValue="30"/></div>
            <button className="button">Renovar y activar</button>
          </form>
        </> : <div className="empty">Este tenant no tiene suscripción.</div>}
      </section>
    </div>

    <div className="grid two-col" style={{marginTop:18}}>
      <section className="card">
        <h2>Estado del servicio</h2>
        <form action={updateTenantStatusAction} style={{display:"flex",gap:8}}>
          <input type="hidden" name="tenantId" value={tenant.id}/>
          <select className="select" name="status" defaultValue={tenant.status}>
            <option value="TRIAL">Trial</option><option value="ACTIVE">Activo</option><option value="SUSPENDED">Suspendido</option><option value="CANCELLED">Cancelado</option>
          </select>
          <button className="button secondary">Guardar estado</button>
        </form>
      </section>

      <section className="card">
        <h2>Plan</h2>
        <form action={changeTenantPlanAction} style={{display:"flex",gap:8}}>
          <input type="hidden" name="tenantId" value={tenant.id}/>
          <select className="select" name="planId" defaultValue={subscription?.planId} disabled={!subscription}>
            {plans.map(plan=><option value={plan.id} key={plan.id}>{plan.name}</option>)}
          </select>
          <button className="button secondary" disabled={!subscription}>Cambiar plan</button>
        </form>
      </section>
    </div>

    <section className="card" style={{marginTop:18}}>
      <h2>Uso</h2>
      <div className="platform-summary">
        <div className="platform-stat"><span className="muted">Usuarios</span><strong>{tenant._count.memberships}</strong></div>
        <div className="platform-stat"><span className="muted">Sedes</span><strong>{tenant._count.locations}</strong></div>
        <div className="platform-stat"><span className="muted">Profesionales</span><strong>{tenant._count.professionals}</strong></div>
        <div className="platform-stat"><span className="muted">Recursos</span><strong>{tenant._count.resources}</strong></div>
      </div>
    </section>
  </>;
}
