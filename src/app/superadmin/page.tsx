import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  DollarSign,
  Layers3,
  Plus,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { platformDb } from "@/lib/db";
import { tenantPublicUrl } from "@/lib/hostnames";
import { reconcileExpiredMemberships } from "@/lib/membership";

const statusLabels: Record<string, string> = {
  TRIAL: "Prueba",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  CANCELLED: "Cancelado",
};

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const date = new Intl.DateTimeFormat("es-AR");

export default async function SuperAdminPage() {
  await requireSuperAdmin();
  await reconcileExpiredMemberships();

  const [tenants, plans] = await Promise.all([
    platformDb.tenant.findMany({
      include: {
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { memberships: true, customers: true, bookings: true, locations: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    platformDb.plan.findMany({
      orderBy: { priceCents: "asc" },
      include: { _count: { select: { subscriptions: true } } },
    }),
  ]);

  const activeCount = tenants.filter((tenant) => tenant.status === "ACTIVE").length;
  const trialCount = tenants.filter((tenant) => tenant.status === "TRIAL").length;
  const suspendedCount = tenants.filter((tenant) => tenant.status === "SUSPENDED").length;
  const cancelledCount = tenants.filter((tenant) => tenant.status === "CANCELLED").length;

  const mrrCents = tenants.reduce((total, tenant) => {
    const subscription = tenant.subscriptions[0];
    if (!subscription || !["ACTIVE", "TRIALING"].includes(subscription.status)) return total;
    const discountMultiplier = Math.max(0, 100 - subscription.discountPercent) / 100;
    return total + Math.round(subscription.plan.priceCents * discountMultiplier);
  }, 0);

  const now = new Date();
  const next30Days = new Date(now.getTime() + 30 * 86_400_000);
  const expiringSoon = tenants
    .filter((tenant) => {
      const end = tenant.subscriptions[0]?.currentPeriodEnd;
      return end && end >= now && end <= next30Days;
    })
    .sort((a, b) => a.subscriptions[0]!.currentPeriodEnd.getTime() - b.subscriptions[0]!.currentPeriodEnd.getTime());

  return (
    <div className="sa-stack">
      <section className="sa-hero">
        <div>
          <span className="sa-kicker">NanoLabs · Plano de Control</span>
          <h1>OnlyTurn SuperAdmin <ShieldCheck size={25} /></h1>
          <p>Supervisión global de empresas, membresías, planes y operación SaaS en producción.</p>
        </div>
        <Link href="/superadmin/tenants" className="sa-primary-button"><Plus size={16} /> Nueva empresa</Link>
      </section>

      <section className="sa-kpi-grid">
        <article className="sa-kpi-card">
          <div className="sa-kpi-head"><span>Total tenants</span><i className="sa-icon indigo"><Building2 size={20} /></i></div>
          <strong>{tenants.length}</strong>
          <small><b className="success">{activeCount} activos</b> · <b className="warning">{trialCount} prueba</b></small>
        </article>

        <article className="sa-kpi-card">
          <div className="sa-kpi-head"><span>MRR proyectado</span><i className="sa-icon emerald"><DollarSign size={20} /></i></div>
          <strong>{money.format(mrrCents / 100)}</strong>
          <small className="success"><TrendingUp size={13} /> facturación mensual recurrente</small>
        </article>

        <article className="sa-kpi-card">
          <div className="sa-kpi-head"><span>Planes disponibles</span><i className="sa-icon cyan"><Layers3 size={20} /></i></div>
          <strong>{plans.filter((plan) => plan.isActive).length}</strong>
          <small>{plans.map((plan) => plan.code).join(" · ")}</small>
        </article>

        <article className="sa-kpi-card">
          <div className="sa-kpi-head"><span>Bloqueados</span><i className="sa-icon red"><AlertTriangle size={20} /></i></div>
          <strong>{suspendedCount + cancelledCount}</strong>
          <small>{suspendedCount} suspendidos · {cancelledCount} cancelados</small>
        </article>
      </section>

      <section className="sa-dashboard-grid">
        <article className="sa-panel sa-panel-wide">
          <div className="sa-panel-head">
            <div><h2>Empresas registradas</h2><p>Últimos tenants aprovisionados en OnlyTurn.</p></div>
            <Link href="/superadmin/tenants">Ver todas ({tenants.length}) <ArrowUpRight size={14} /></Link>
          </div>

          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead><tr><th>Empresa / dominio</th><th>Plan</th><th>Estado</th><th>Membresía</th><th></th></tr></thead>
              <tbody>
                {tenants.slice(0, 10).length ? tenants.slice(0, 10).map((tenant) => {
                  const subscription = tenant.subscriptions[0];
                  return (
                    <tr key={tenant.id}>
                      <td>
                        <strong>{tenant.name}</strong>
                        <small className="mono">{tenant.slug}.nanoapps.ar</small>
                      </td>
                      <td><span className="sa-plan-pill">{subscription?.plan.name ?? "Sin plan"}</span></td>
                      <td><span className={`sa-status ${tenant.status.toLowerCase()}`}>{statusLabels[tenant.status] ?? tenant.status}</span></td>
                      <td>
                        {subscription ? <><strong>{date.format(subscription.currentPeriodEnd)}</strong><small>{subscription.status}</small></> : <span className="sa-muted">Sin membresía</span>}
                      </td>
                      <td className="sa-table-action"><Link href={`/superadmin/tenants/${tenant.id}`}>Configurar</Link></td>
                    </tr>
                  );
                }) : <tr><td colSpan={5} className="sa-empty">No hay empresas registradas.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="sa-panel">
          <div className="sa-panel-head"><div><h2>Planes y cobertura</h2><p>Configuración comercial vigente.</p></div></div>
          <div className="sa-plan-summary">
            {plans.map((plan) => (
              <div className="sa-plan-summary-card" key={plan.id}>
                <div><strong>{plan.name}</strong><span>{money.format(plan.priceCents / 100)}/mes</span></div>
                <p>{plan.description ?? `Plan ${plan.code}`}</p>
                <footer><span>{plan._count.subscriptions} suscripción(es)</span><b className={plan.isActive ? "success" : "danger"}>{plan.isActive ? "Activo" : "Inactivo"}</b></footer>
              </div>
            ))}
          </div>
          <Link href="/superadmin/planes" className="sa-panel-link">Administrar planes <ArrowUpRight size={14} /></Link>
        </aside>
      </section>

      <section className="sa-panel">
        <div className="sa-panel-head">
          <div><h2>Vencimientos próximos</h2><p>Membresías que vencen durante los próximos 30 días.</p></div>
          <CalendarClock size={20} />
        </div>
        {expiringSoon.length ? (
          <div className="sa-expiry-grid">
            {expiringSoon.slice(0, 8).map((tenant) => {
              const subscription = tenant.subscriptions[0]!;
              return <Link href={`/superadmin/tenants/${tenant.id}`} className="sa-expiry-card" key={tenant.id}>
                <div><strong>{tenant.name}</strong><small>{tenantPublicUrl(tenant.slug)}</small></div>
                <span>{date.format(subscription.currentPeriodEnd)}</span>
              </Link>;
            })}
          </div>
        ) : <div className="sa-empty">No hay membresías con vencimiento dentro de los próximos 30 días.</div>}
      </section>
    </div>
  );
}
