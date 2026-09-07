import { fromZonedTime } from "date-fns-tz";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTenantSession } from "@/lib/auth";
import { createTenantDb } from "@/lib/tenant-db";

const labels: Record<string, string> = {
  CONFIRMED: "Confirmado",
  PENDING: "Pendiente",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  NO_SHOW: "Ausente",
  CHECKED_IN: "Llegó",
  IN_PROGRESS: "En atención",
};

export default async function DashboardPage() {
  const { membership, tenant } = await requireTenantSession();
  if (!tenant.onboardingDone) redirect("/app/onboarding");

  const now = new Date();
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: tenant.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const { bookings, newCustomers } = await createTenantDb(membership.tenantId).dashboard(
    fromZonedTime(`${localDate}T00:00:00`, tenant.timezone),
    fromZonedTime(`${localDate}T23:59:59.999`, tenant.timezone),
  );

  const active = bookings.filter((booking) => !["CANCELLED", "NO_SHOW"].includes(booking.status));
  const upcoming = active.filter((booking) => booking.startsAt >= now).slice(0, 7);
  const completed = bookings.filter((booking) => booking.status === "COMPLETED");
  const pending = bookings.filter((booking) => booking.status === "PENDING").length;
  const confirmed = bookings.filter((booking) => booking.status === "CONFIRMED").length;
  const inService = bookings.filter((booking) => ["CHECKED_IN", "IN_PROGRESS"].includes(booking.status)).length;
  const cancelled = bookings.filter((booking) => booking.status === "CANCELLED").length;
  const noShow = bookings.filter((booking) => booking.status === "NO_SHOW").length;
  const completedValue = completed.reduce((total, booking) => total + (booking.priceCents ?? 0), 0);
  const formatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: tenant.currency, maximumFractionDigits: 0 });

  return <>
    <div className="page-title">
      <span className="eyebrow">Operación de hoy</span>
      <h1>Tu negocio de un vistazo</h1>
      <p className="muted">Datos reales de la agenda del día, sin estimaciones artificiales.</p>
    </div>

    <section className="grid stats">
      <div className="card stat"><span className="muted">Turnos activos</span><strong>{active.length}</strong><span className="delta">agenda de hoy</span></div>
      <div className="card stat"><span className="muted">Por atender</span><strong>{pending + confirmed}</strong><span className="muted" style={{fontSize:12}}>{pending} pendientes · {confirmed} confirmados</span></div>
      <div className="card stat"><span className="muted">Completados</span><strong>{completed.length}</strong><span className="muted" style={{fontSize:12}}>{formatter.format(completedValue / 100)} en servicios</span></div>
      <div className="card stat"><span className="muted">Clientes nuevos</span><strong>{newCustomers}</strong><span className="muted" style={{fontSize:12}}>registrados hoy</span></div>
    </section>

    <section className="grid two-col">
      <div className="card">
        <div className="section-head"><h2>Próximos turnos</h2><Link className="pill" href="/app/agenda">Ver agenda</Link></div>
        {upcoming.length ? upcoming.map((booking) => <div className="booking-row" key={booking.id}>
          <div className="time">{new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: tenant.timezone }).format(booking.startsAt)}</div>
          <div><strong><span className="dot" style={{background:booking.service.color}} />{booking.customer.firstName} {booking.customer.lastName}</strong><div className="muted" style={{fontSize:12}}>{booking.service.name} · {booking.professional?.name ?? booking.resource?.name ?? "Sin asignar"}</div></div>
          <span className={`status ${booking.status}`}>{labels[booking.status]}</span>
        </div>) : <div className="empty">No quedan turnos programados para hoy.</div>}
      </div>

      <div className="card">
        <div className="section-head"><h2>Estado del día</h2></div>
        <div className="dashboard-breakdown">
          <div><span>Pendientes</span><strong>{pending}</strong></div>
          <div><span>Confirmados</span><strong>{confirmed}</strong></div>
          <div><span>En atención</span><strong>{inService}</strong></div>
          <div><span>Completados</span><strong>{completed.length}</strong></div>
          <div><span>Cancelados</span><strong>{cancelled}</strong></div>
          <div><span>Ausentes</span><strong>{noShow}</strong></div>
        </div>
      </div>
    </section>
  </>;
}
