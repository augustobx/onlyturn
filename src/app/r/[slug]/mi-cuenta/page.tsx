import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import {
  Calendar,
  CalendarDays,
  Clock,
  LogOut,
  MapPin,
  Plus,
  Sparkles,
  Ticket,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import { cancelCustomerBookingAction, logoutCustomerAction, updateCustomerProfileAction } from "@/app/actions/customer-account";
import { getPublicTenant } from "@/lib/booking-service";
import { requireCustomerSession } from "@/lib/customer-auth";
import { platformDb } from "@/lib/db";
import { publicThemeVariables, type PublicBranding } from "@/lib/public-themes";

const labels = { CHARGE: "Cargo", PAYMENT: "Pago", CREDIT: "Crédito", ADJUSTMENT: "Ajuste" } as const;
const packageLabels = { ACTIVE: "Activo", EXHAUSTED: "Agotado", EXPIRED: "Vencido", CANCELLED: "Cancelado" } as const;

export default async function CustomerPortalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) notFound();
  const session = await requireCustomerSession(tenant.id);
  const customer = await platformDb.customer.findFirst({
    where: { id: session.account.customerId, tenantId: tenant.id },
    include: {
      bookings: {
        include: { service: true, professional: true, location: true, packageUsage: { include: { customerPackage: true } } },
        orderBy: { startsAt: "desc" },
        take: 100,
      },
      ledgerEntries: { orderBy: { createdAt: "desc" }, take: 200 },
      packages: {
        include: { package: { include: { services: { include: { service: { select: { name: true } } } } } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
  if (!customer) notFound();
  const balance = customer.ledgerEntries.reduce((sum, item) => sum + item.amountCents, 0);
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: tenant.currency, maximumFractionDigits: 0 });
  const now = new Date();
  const future = customer.bookings.filter((item) => item.startsAt > now && ["PENDING", "CONFIRMED"].includes(item.status)).length;
  const activePackages = customer.packages.filter((item) => item.status === "ACTIVE" && item.remainingUses > 0 && (!item.expiresAt || item.expiresAt >= now));
  const availableUses = activePackages.reduce((sum, item) => sum + item.remainingUses, 0);
  const { theme, style } = publicThemeVariables(tenant.branding as PublicBranding);

  const initials = `${customer.firstName[0] ?? ""}${customer.lastName?.[0] ?? ""}`.toUpperCase() || "C";

  return (
    <main
      className="booking-page booking-page-v2 customer-portal"
      data-theme={theme.id}
      data-theme-mode={theme.dark ? "dark" : "light"}
      style={style as React.CSSProperties}
    >
      <div className="customer-portal-wrap" style={{ maxWidth: 1000, margin: "0 auto", padding: "16px 14px 60px" }}>
        {/* Modern Header */}
        <header
          className="card"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 24px",
            marginBottom: 20,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                background: "linear-gradient(135deg, var(--brand), var(--public-secondary, #2563eb))",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 850,
                fontSize: "1.1rem",
                boxShadow: "0 8px 20px color-mix(in srgb, var(--brand) 25%, transparent)",
              }}
            >
              {initials}
            </div>
            <div>
              <span className="eyebrow" style={{ display: "block", fontSize: "0.72rem", marginBottom: 2 }}>
                Mi Cuenta · {tenant.name}
              </span>
              <h1 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 850 }}>
                Hola, {customer.firstName}
              </h1>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Link className="button" href={`/r/${slug}#reservar`} style={{ padding: "8px 16px", fontSize: "0.84rem" }}>
              <Plus size={15} /> Nueva reserva
            </Link>
            <form action={logoutCustomerAction}>
              <input type="hidden" name="slug" value={slug} />
              <button
                className="button ghost"
                type="submit"
                style={{ padding: "8px 12px", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <LogOut size={15} /> Salir
              </button>
            </form>
          </div>
        </header>

        {/* 4 Stat Cards */}
        <div className="customer-account-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 20 }}>
          <section className="card" style={{ padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span className="muted" style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase" }}>
                Saldo / Créditos
              </span>
              <Wallet size={17} style={{ color: "var(--brand)" }} />
            </div>
            <strong className={balance > 0 ? "account-balance due" : "account-balance"} style={{ fontSize: "1.8rem", display: "block" }}>
              {money.format(balance / 100)}
            </strong>
            <p className="muted" style={{ fontSize: "0.76rem", margin: "4px 0 0" }}>
              {balance > 0 ? "Saldo pendiente a regularizar" : balance < 0 ? "Crédito a tu favor" : "Sin saldo pendiente"}
            </p>
          </section>

          <section className="card" style={{ padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span className="muted" style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase" }}>
                Pases Activos
              </span>
              <Ticket size={17} style={{ color: "var(--brand)" }} />
            </div>
            <strong className="account-balance" style={{ fontSize: "1.8rem", display: "block" }}>
              {availableUses}
            </strong>
            <p className="muted" style={{ fontSize: "0.76rem", margin: "4px 0 0" }}>
              usos disponibles en {activePackages.length} membresía{activePackages.length === 1 ? "" : "s"}
            </p>
          </section>

          <section className="card" style={{ padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span className="muted" style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase" }}>
                Próximos Turnos
              </span>
              <CalendarDays size={17} style={{ color: "var(--brand)" }} />
            </div>
            <strong className="account-balance" style={{ fontSize: "1.8rem", display: "block" }}>
              {future}
            </strong>
            <p className="muted" style={{ fontSize: "0.76rem", margin: "4px 0 0" }}>
              reservas activas confirmadas
            </p>
          </section>

          <section className="card" style={{ padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span className="muted" style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase" }}>
                Historial
              </span>
              <Sparkles size={17} style={{ color: "var(--brand)" }} />
            </div>
            <strong className="account-balance" style={{ fontSize: "1.8rem", display: "block" }}>
              {customer.bookings.length}
            </strong>
            <p className="muted" style={{ fontSize: "0.76rem", margin: "4px 0 0" }}>
              turnos totales realizados
            </p>
          </section>
        </div>

        {/* Membresías con Barra de Progreso */}
        {customer.packages.length > 0 && (
          <section className="card" style={{ padding: "22px", marginBottom: 20 }}>
            <div className="section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>Mis paquetes y membresías</h2>
              <Link className="pill" href={`/r/${slug}#reservar`} style={{ fontSize: "0.74rem" }}>
                Usar en una reserva
              </Link>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {customer.packages.map((item) => {
                const percent = Math.round((item.remainingUses / (item.totalUses || 1)) * 100);
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: "16px",
                      borderRadius: 14,
                      border: "1px solid var(--public-line)",
                      background: "color-mix(in srgb, var(--public-surface) 95%, transparent)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <strong style={{ fontSize: "1rem", color: "var(--public-text)" }}>{item.name}</strong>
                        <div style={{ color: "var(--public-muted)", fontSize: "0.78rem", marginTop: 2 }}>
                          {item.package.services.map((link) => link.service.name).join(", ")}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span className={`status ${item.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED"}`}>
                          {packageLabels[item.status]}
                        </span>
                        <div style={{ fontSize: "0.92rem", fontWeight: 800, marginTop: 4 }}>
                          {item.remainingUses} de {item.totalUses} usos
                        </div>
                      </div>
                    </div>
                    {/* Barra de progreso */}
                    <div style={{ height: 6, borderRadius: 999, background: "var(--public-line)", marginTop: 12, overflow: "hidden" }}>
                      <div style={{ width: `${percent}%`, height: "100%", background: "var(--brand)", borderRadius: 999 }} />
                    </div>
                    <small style={{ display: "block", color: "var(--public-muted)", fontSize: "0.72rem", marginTop: 6 }}>
                      {item.expiresAt ? `Válido hasta ${formatInTimeZone(item.expiresAt, tenant.timezone, "dd/MM/yyyy")}` : "Sin fecha de vencimiento"}
                    </small>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Dos columnas: Reservas y Perfil */}
        <div className="grid two-col customer-portal-columns" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.9fr)", gap: 16 }}>
          {/* Reservas */}
          <section className="card" style={{ padding: "22px" }}>
            <div className="section-head" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>Mis reservas</h2>
            </div>
            {customer.bookings.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {customer.bookings.map((item) => {
                  const canCancel = item.startsAt > now && ["PENDING", "CONFIRMED"].includes(item.status);
                  return (
                    <article
                      key={item.id}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 14,
                        border: "1px solid var(--public-line)",
                        background: "color-mix(in srgb, var(--public-surface) 95%, transparent)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "0.96rem", color: "var(--public-text)" }}>{item.service.name}</strong>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--public-muted)", fontSize: "0.76rem", marginTop: 3, flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <MapPin size={12} /> {item.location.name}
                          </span>
                          {item.professional && (
                            <>
                              <span>•</span>
                              <span>{item.professional.name}</span>
                            </>
                          )}
                          {item.packageUsage && (
                            <>
                              <span>•</span>
                              <span style={{ color: "var(--brand)" }}>{item.packageUsage.customerPackage.name}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span className={`status ${item.status}`}>{item.status}</span>
                        <small style={{ color: "var(--public-text)", fontWeight: 700, fontSize: "0.78rem" }}>
                          {formatInTimeZone(item.startsAt, tenant.timezone, "dd/MM/yyyy HH:mm")}
                        </small>
                        {canCancel && (
                          <form action={cancelCustomerBookingAction} style={{ marginTop: 2 }}>
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="bookingId" value={item.id} />
                            <button
                              className="button ghost"
                              style={{ color: "#ef4444", padding: "2px 6px", fontSize: "0.7rem", fontWeight: 700 }}
                            >
                              Cancelar turno
                            </button>
                          </form>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty" style={{ padding: "36px 18px", textAlign: "center" }}>
                <Calendar size={28} style={{ color: "var(--public-muted)", margin: "0 auto 8px" }} />
                <p style={{ margin: 0 }}>Todavía no tenés turnos registrados.</p>
                <Link className="button" href={`/r/${slug}#reservar`} style={{ marginTop: 12, fontSize: "0.8rem", padding: "8px 14px" }}>
                  Hacer mi primera reserva
                </Link>
              </div>
            )}
            <p className="muted" style={{ fontSize: "0.72rem", marginTop: 14, lineHeight: 1.4 }}>
              Cancelaciones online sujetas a la política de anticipación del negocio. En reservas con membresía, los usos se reintegran automáticamente.
            </p>
          </section>

          {/* Mi perfil */}
          <section className="card" style={{ padding: "22px" }}>
            <div className="section-head" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0 }}>Mis datos</h2>
            </div>
            <form action={updateCustomerProfileAction}>
              <input type="hidden" name="slug" value={slug} />
              <div className="field">
                <label>Nombre</label>
                <input className="input" name="firstName" defaultValue={customer.firstName} required />
              </div>
              <div className="field">
                <label>Apellido</label>
                <input className="input" name="lastName" defaultValue={customer.lastName ?? ""} />
              </div>
              <div className="field">
                <label>Email</label>
                <input className="input" value={session.account.email} disabled />
              </div>
              <div className="field">
                <label>Teléfono</label>
                <input className="input" value={customer.phone} disabled />
              </div>
              <div className="field">
                <label>Documento / DNI</label>
                <input className="input" name="document" defaultValue={customer.document ?? ""} />
              </div>
              <div className="field">
                <label>Fecha de nacimiento</label>
                <input className="input" name="birthDate" type="date" defaultValue={customer.birthDate?.toISOString().slice(0, 10) ?? ""} />
              </div>
              <button className="button" style={{ width: "100%", marginTop: 10 }}>
                Guardar cambios
              </button>
            </form>
          </section>
        </div>

        {/* Movimientos de saldo */}
        <section className="card account-ledger" style={{ padding: "22px", marginTop: 20 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 16px" }}>Historial de pagos y movimientos</h2>
          {customer.ledgerEntries.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th>Tipo</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.ledgerEntries.map((item) => (
                    <tr key={item.id}>
                      <td>{formatInTimeZone(item.createdAt, tenant.timezone, "dd/MM/yyyy")}</td>
                      <td>{item.description}</td>
                      <td>{labels[item.type]}</td>
                      <td className={item.amountCents > 0 ? "ledger-debit" : "ledger-credit"}>
                        {money.format(item.amountCents / 100)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty" style={{ padding: "24px", textAlign: "center" }}>
              No hay movimientos de saldo registrados.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
