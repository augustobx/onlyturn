import { fromZonedTime } from "date-fns-tz";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarCheck2,
  Clock,
  CheckCircle2,
  UserPlus,
  ArrowUpRight,
  CalendarDays,
  Sparkles,
  Users,
  ShieldCheck,
  Activity,
  AlertCircle,
  XCircle,
} from "lucide-react";
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
  if (!tenant.onboardingDone) redirect("/onboarding");

  const now = new Date();
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: tenant.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const readableDate = new Intl.DateTimeFormat("es-AR", {
    timeZone: tenant.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
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

  const totalToday = bookings.length || 1;
  const confirmedPct = Math.round((confirmed / totalToday) * 100);
  const completedPct = Math.round((completed.length / totalToday) * 100);
  const pendingPct = Math.round((pending / totalToday) * 100);

  return (
    <>
      <div className="page-title">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Activity size={14} /> Operación de hoy · {readableDate}
            </span>
            <h1>Tu negocio de un vistazo</h1>
            <p className="muted">Monitoreo en tiempo real de la agenda, ocupación y atención a clientes.</p>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <Link className="button" href="/agenda" style={{ padding: "8px 14px", fontSize: "0.82rem" }}>
              <CalendarDays size={15} /> Abrir agenda
            </Link>
          </div>
        </div>
      </div>

      <section className="grid stats">
        {/* Stat 1: Activos */}
        <div className="card stat" style={{ borderLeft: "3px solid #6366f1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="muted">Turnos activos</span>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", display: "grid", placeItems: "center" }}>
              <CalendarCheck2 size={18} />
            </span>
          </div>
          <strong>{active.length}</strong>
          <span className="delta">
            <Sparkles size={12} /> Agenda programada hoy
          </span>
        </div>

        {/* Stat 2: Por atender */}
        <div className="card stat" style={{ borderLeft: "3px solid #f59e0b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="muted">Por atender</span>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", display: "grid", placeItems: "center" }}>
              <Clock size={18} />
            </span>
          </div>
          <strong>{pending + confirmed}</strong>
          <span className="muted" style={{ fontSize: "0.74rem", marginTop: 4, display: "block" }}>
            {confirmed} confirmados · {pending} pendientes
          </span>
        </div>

        {/* Stat 3: Facturación / Completados */}
        <div className="card stat" style={{ borderLeft: "3px solid #10b981" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="muted">Completados</span>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(16, 185, 129, 0.15)", color: "#34d399", display: "grid", placeItems: "center" }}>
              <CheckCircle2 size={18} />
            </span>
          </div>
          <strong>{completed.length}</strong>
          <span className="muted" style={{ fontSize: "0.74rem", marginTop: 4, display: "block", color: "#34d399", fontWeight: 700 }}>
            {formatter.format(completedValue / 100)} en servicios
          </span>
        </div>

        {/* Stat 4: Clientes nuevos */}
        <div className="card stat" style={{ borderLeft: "3px solid #0ea5e9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="muted">Clientes nuevos</span>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(14, 165, 233, 0.15)", color: "#38bdf8", display: "grid", placeItems: "center" }}>
              <UserPlus size={18} />
            </span>
          </div>
          <strong>{newCustomers}</strong>
          <span className="muted" style={{ fontSize: "0.74rem", marginTop: 4, display: "block" }}>
            Registrados en el día
          </span>
        </div>
      </section>

      <section className="grid two-col" style={{ marginTop: 22 }}>
        {/* Columna izquierda: Feed de Próximos turnos */}
        <div className="card" style={{ padding: "24px" }}>
          <div className="section-head" style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 800 }}>Próximos turnos</h2>
              <span className="pill" style={{ padding: "2px 8px", fontSize: "0.7rem" }}>
                {upcoming.length} pendientes
              </span>
            </div>
            <Link className="button ghost" href="/agenda" style={{ padding: "6px 10px", fontSize: "0.78rem" }}>
              Ver agenda completa <ArrowUpRight size={14} />
            </Link>
          </div>

          {upcoming.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {upcoming.map((booking) => {
                const initials = `${booking.customer.firstName[0] ?? ""}${booking.customer.lastName?.[0] ?? ""}`.toUpperCase() || "C";
                return (
                  <div
                    className="booking-row"
                    key={booking.id}
                    style={{
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      borderRadius: 14,
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(99, 102, 241, 0.1)", borderRadius: 10, padding: "6px 8px", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
                      <Clock size={13} style={{ color: "#818cf8", marginBottom: 2 }} />
                      <span className="time" style={{ fontSize: "0.85rem", color: "#f8fafc" }}>
                        {new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: tenant.timezone }).format(booking.startsAt)}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          background: "linear-gradient(135deg, #1e293b, #334155)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          display: "grid",
                          placeItems: "center",
                          fontSize: "0.8rem",
                          fontWeight: 800,
                          color: "#f8fafc",
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <strong style={{ fontSize: "0.92rem", color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {booking.customer.firstName} {booking.customer.lastName}
                          </strong>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.75rem", color: "#94a3b8" }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: booking.service.color || "#6366f1", display: "inline-block" }} />
                            {booking.service.name}
                          </span>
                          <span style={{ color: "#475569", fontSize: "0.75rem" }}>•</span>
                          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                            {booking.professional?.name ?? booking.resource?.name ?? "Sin asignar"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className={`status ${booking.status}`}>{labels[booking.status]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className="empty"
              style={{
                padding: "48px 24px",
                textAlign: "center",
                background: "rgba(255, 255, 255, 0.015)",
                border: "1px dashed rgba(255, 255, 255, 0.08)",
                borderRadius: 16,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: "rgba(99, 102, 241, 0.12)",
                  color: "#818cf8",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 14px",
                }}
              >
                <CalendarDays size={24} />
              </div>
              <strong style={{ display: "block", color: "#f8fafc", fontSize: "0.96rem" }}>Todo al día</strong>
              <p className="muted" style={{ fontSize: "0.82rem", margin: "6px auto 16px", maxWidth: 320 }}>
                No quedan más turnos pendientes por atender en lo que resta del día.
              </p>
              <Link className="button secondary" href="/agenda" style={{ fontSize: "0.8rem", padding: "7px 14px" }}>
                Ir a la Agenda
              </Link>
            </div>
          )}
        </div>

        {/* Columna derecha: Desglose de estados y métricas operativas */}
        <div className="card" style={{ padding: "24px" }}>
          <div className="section-head" style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 800 }}>Estado del día</h2>
            <span className="muted" style={{ fontSize: "0.74rem" }}>
              {bookings.length} turno{bookings.length === 1 ? "" : "s"} en total
            </span>
          </div>

          {/* Barra de progreso de distribución */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                height: 8,
                borderRadius: 999,
                overflow: "hidden",
                background: "rgba(255, 255, 255, 0.06)",
                gap: 2,
              }}
            >
              {confirmed > 0 && <div style={{ width: `${confirmedPct}%`, background: "#10b981", borderRadius: 999 }} title={`Confirmados: ${confirmed}`} />}
              {pending > 0 && <div style={{ width: `${pendingPct}%`, background: "#f59e0b", borderRadius: 999 }} title={`Pendientes: ${pending}`} />}
              {completed.length > 0 && <div style={{ width: `${completedPct}%`, background: "#6366f1", borderRadius: 999 }} title={`Completados: ${completed.length}`} />}
            </div>
          </div>

          <div className="dashboard-breakdown">
            <div style={{ borderLeft: "3px solid #f59e0b" }}>
              <span>Pendientes</span>
              <strong style={{ color: "#fbbf24" }}>{pending}</strong>
            </div>
            <div style={{ borderLeft: "3px solid #10b981" }}>
              <span>Confirmados</span>
              <strong style={{ color: "#34d399" }}>{confirmed}</strong>
            </div>
            <div style={{ borderLeft: "3px solid #0ea5e9" }}>
              <span>En atención</span>
              <strong style={{ color: "#38bdf8" }}>{inService}</strong>
            </div>
            <div style={{ borderLeft: "3px solid #6366f1" }}>
              <span>Completados</span>
              <strong style={{ color: "#818cf8" }}>{completed.length}</strong>
            </div>
            <div style={{ borderLeft: "3px solid #f43f5e" }}>
              <span>Cancelados</span>
              <strong style={{ color: "#fb7185" }}>{cancelled}</strong>
            </div>
            <div style={{ borderLeft: "3px solid #64748b" }}>
              <span>Ausentes</span>
              <strong style={{ color: "#94a3b8" }}>{noShow}</strong>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
