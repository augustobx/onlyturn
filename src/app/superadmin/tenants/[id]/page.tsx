import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CreditCard,
  ExternalLink,
  Gauge,
  KeyRound,
  Layers3,
  Shield,
  Users,
} from "lucide-react";
import { changeTenantPlanAction, updateTenantStatusAction } from "@/app/actions/superadmin";
import {
  registerSaasPaymentAction,
  renewMembershipAction,
  updateMembershipDatesAction,
} from "@/app/actions/platform-management";
import { requireSuperAdmin } from "@/lib/auth";
import { platformDb } from "@/lib/db";
import { tenantPublicUrl } from "@/lib/hostnames";
import { TenantOverrides } from "./tenant-overrides";

type AuditMetadata = {
  amountCents?: number;
  currency?: string;
  method?: string;
  reference?: string | null;
  days?: number;
  currentPeriodEnd?: string;
  previousEnd?: string;
};

type PlanFeatures = {
  maxLocations?: number;
  maxStaff?: number;
  maxResources?: number;
  maxBookings?: number;
  deposits?: boolean;
  whatsappNotifications?: boolean;
  advancedReports?: boolean;
  waitlist?: boolean;
  recurringBookings?: boolean;
  customDomain?: boolean;
};

const statusLabels: Record<string, string> = {
  TRIAL: "Prueba",
  ACTIVE: "Activo",
  SUSPENDED: "Suspendido",
  CANCELLED: "Cancelado",
};

const date = new Intl.DateTimeFormat("es-AR");

export default async function SuperAdminTenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;

  const [tenant, plans, audit] = await Promise.all([
    platformDb.tenant.findUnique({
      where: { id },
      include: {
        memberships: { where: { role: "OWNER", isActive: true }, include: { user: true }, take: 1 },
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: {
          select: {
            memberships: true,
            customers: true,
            bookings: true,
            locations: true,
            professionals: true,
            resources: true,
            services: true,
          },
        },
      },
    }),
    platformDb.plan.findMany({ where: { isActive: true }, orderBy: { priceCents: "asc" } }),
    platformDb.auditLog.findMany({
      where: { tenantId: id, scope: "PLATFORM" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  if (!tenant) notFound();

  const owner = tenant.memberships[0]?.user;
  const subscription = tenant.subscriptions[0];
  const publicUrl = tenantPublicUrl(tenant.slug);
  const adminUrl = `${publicUrl}/login`;
  const features = (subscription?.plan.features ?? {}) as PlanFeatures;

  return (
    <div className="sa-stack">
      <div className="sa-page-head">
        <Link href="/superadmin/tenants" className="sa-secondary-button"><ArrowLeft size={14} /> Volver a empresas</Link>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="sa-secondary-button"><ExternalLink size={13} /> Sitio público</a>
          <a href={adminUrl} target="_blank" rel="noreferrer" className="sa-secondary-button"><KeyRound size={13} /> Login tenant</a>
        </div>
      </div>

      <section className="sa-tenant-hero">
        <div className="sa-tenant-title">
          <span className="sa-tenant-logo"><Building2 size={24} /></span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <h1>{tenant.name}</h1>
              <span className={`sa-status ${tenant.status.toLowerCase()}`}>{statusLabels[tenant.status] ?? tenant.status}</span>
            </div>
            <small>{tenant.slug}.nanoapps.ar</small>
          </div>
        </div>

        <div className="sa-counter-row">
          <div className="sa-counter"><span>Usuarios</span><strong>{tenant._count.memberships}</strong></div>
          <div className="sa-counter"><span>Sedes</span><strong>{tenant._count.locations}</strong></div>
          <div className="sa-counter"><span>Servicios</span><strong>{tenant._count.services}</strong></div>
          <div className="sa-counter"><span>Turnos</span><strong>{tenant._count.bookings}</strong></div>
        </div>
      </section>

      <section className="sa-detail-grid">
        <article className="sa-detail-card">
          <h2><Shield size={15} /> Estado y plan</h2>
          <form action={updateTenantStatusAction}>
            <input type="hidden" name="tenantId" value={tenant.id} />
            <label className="sa-label">Estado operativo</label>
            <select className="sa-select" name="status" defaultValue={tenant.status}>
              <option value="TRIAL">Período de prueba</option>
              <option value="ACTIVE">Activo / habilitado</option>
              <option value="SUSPENDED">Suspendido</option>
              <option value="CANCELLED">Cancelado / baja</option>
            </select>
            <div className="sa-form-actions"><button className="sa-secondary-button">Guardar estado</button></div>
          </form>

          <form action={changeTenantPlanAction} className="sa-form-section">
            <input type="hidden" name="tenantId" value={tenant.id} />
            <label className="sa-label">Plan SaaS asignado</label>
            <select className="sa-select" name="planId" defaultValue={subscription?.planId} disabled={!subscription}>
              {plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name} · ${(plan.priceCents / 100).toLocaleString("es-AR")}/mes</option>)}
            </select>
            <div className="sa-form-actions"><button className="sa-secondary-button" disabled={!subscription}>Cambiar plan</button></div>
          </form>
        </article>

        <article className="sa-detail-card">
          <h2><CalendarClock size={15} /> Membresía</h2>
          {subscription ? (
            <>
              <div className="sa-detail-list">
                <div><span>Estado de suscripción</span><strong>{subscription.status}</strong></div>
                <div><span>Inicio</span><strong>{date.format(subscription.currentPeriodStart)}</strong></div>
                <div><span>Vencimiento</span><strong>{date.format(subscription.currentPeriodEnd)}</strong></div>
              </div>

              <form action={updateMembershipDatesAction} className="sa-form-section">
                <div className="sa-form-grid">
                  <div><label className="sa-label">Fecha de inicio</label><input className="sa-input" name="membershipStart" type="date" required defaultValue={subscription.currentPeriodStart.toISOString().slice(0, 10)} /></div>
                  <div><label className="sa-label">Fecha de vencimiento</label><input className="sa-input" name="membershipEnd" type="date" required defaultValue={subscription.currentPeriodEnd.toISOString().slice(0, 10)} /></div>
                </div>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <div className="sa-form-actions"><button className="sa-secondary-button">Actualizar fechas</button></div>
              </form>

              <form action={renewMembershipAction} className="sa-form-section">
                <input type="hidden" name="tenantId" value={tenant.id} />
                <label className="sa-label">Renovación rápida</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <input className="sa-input" name="days" type="number" min="1" max="3650" defaultValue="30" />
                  <button className="sa-primary-button">Renovar y activar</button>
                </div>
              </form>
            </>
          ) : <div className="sa-empty">Este tenant no tiene una membresía asociada.</div>}
        </article>

        <article className="sa-detail-card">
          <h2><Users size={15} /> Owner y accesos</h2>
          <div className="sa-detail-list">
            <div><span>Administrador propietario</span><strong>{owner?.name ?? "Sin owner"}</strong><span style={{ marginTop: 2 }}>{owner?.email ?? "—"}</span></div>
            <div><span>Reserva pública</span><a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a></div>
            <div><span>Panel administrativo</span><a href={adminUrl} target="_blank" rel="noreferrer">{adminUrl}</a></div>
            <div><span>Alta del tenant</span><strong>{date.format(tenant.createdAt)}</strong></div>
            <div><span>Último acceso</span><strong>{tenant.lastAccessAt ? date.format(tenant.lastAccessAt) : "Sin registros"}</strong></div>
          </div>
        </article>
      </section>

      <section className="sa-dashboard-grid">
        <article className="sa-panel sa-panel-wide">
          <div className="sa-panel-head">
            <div><h2>Registrar cobro SaaS</h2><p>Registra el pago, renueva la membresía y reactiva el tenant si estaba suspendido.</p></div>
            <CreditCard size={20} style={{ color: "#34d399" }} />
          </div>
          {subscription ? (
            <form action={registerSaasPaymentAction}>
              <input type="hidden" name="tenantId" value={tenant.id} />
              <div className="sa-form-grid">
                <div><label className="sa-label">Monto (ARS)</label><input className="sa-input" name="amountPesos" type="number" min="1" step="1" required defaultValue={subscription.plan.priceCents / 100} /></div>
                <div><label className="sa-label">Días a renovar</label><input className="sa-input" name="days" type="number" min="1" max="3650" required defaultValue="30" /></div>
                <div><label className="sa-label">Método de pago</label><select className="sa-select" name="method" defaultValue="TRANSFERENCIA"><option value="TRANSFERENCIA">Transferencia</option><option value="EFECTIVO">Efectivo</option><option value="MERCADOPAGO">Mercado Pago</option><option value="OTRO">Otro</option></select></div>
                <div><label className="sa-label">Referencia</label><input className="sa-input" name="reference" placeholder="Comprobante / operación" /></div>
                <div style={{ gridColumn: "1/-1" }}><label className="sa-label">Notas</label><textarea className="sa-textarea" name="notes" rows={2} placeholder="Observaciones comerciales opcionales" /></div>
              </div>
              <div className="sa-form-actions"><button className="sa-primary-button"><CreditCard size={14} /> Registrar cobro y renovar</button></div>
            </form>
          ) : <div className="sa-empty">No se puede registrar un cobro sin suscripción.</div>}
        </article>

        <aside className="sa-panel">
          <div className="sa-panel-head"><div><h2>Uso vs. plan</h2><p>Capacidad actual del tenant.</p></div><Gauge size={20} /></div>
          <div className="sa-detail-list">
            <div><span>Sedes</span><strong>{tenant._count.locations} / {features.maxLocations ?? "—"}</strong></div>
            <div><span>Profesionales</span><strong>{tenant._count.professionals} / {features.maxStaff ?? "—"}</strong></div>
            <div><span>Recursos</span><strong>{tenant._count.resources} / {features.maxResources ?? "—"}</strong></div>
            <div><span>Turnos acumulados</span><strong>{tenant._count.bookings}</strong></div>
            <div><span>Clientes</span><strong>{tenant._count.customers}</strong></div>
          </div>
        </aside>
      </section>

      {subscription && <TenantOverrides tenantId={tenant.id} planFeatures={features} />}

      <section className="sa-panel">
        <div className="sa-panel-head"><div><h2>Actividad del plano de control</h2><p>Cambios de plan, membresía, estado, overrides y cobros registrados por NanoLabs.</p></div><Layers3 size={19} /></div>
        <div className="sa-audit-list">
          {audit.length ? audit.map((entry) => {
            const metadata = (entry.metadata ?? {}) as AuditMetadata;
            const paymentText = entry.action === "saas.payment_registered" && metadata.amountCents
              ? ` · ${(metadata.amountCents / 100).toLocaleString("es-AR", { style: "currency", currency: metadata.currency ?? "ARS" })}${metadata.method ? ` · ${metadata.method}` : ""}`
              : "";
            return (
              <div className="sa-audit-item" key={entry.id}>
                <div><strong>{entry.action}{paymentText}</strong><small>{metadata.reference ? `Ref. ${metadata.reference}` : entry.entityType}{metadata.currentPeriodEnd ? ` · vence ${date.format(new Date(metadata.currentPeriodEnd))}` : ""}</small></div>
                <span>{date.format(entry.createdAt)}</span>
              </div>
            );
          }) : <div className="sa-empty">Todavía no hay actividad de plataforma registrada para este tenant.</div>}
        </div>
      </section>
    </div>
  );
}
