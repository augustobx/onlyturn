import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
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
      bookings: { include: { service: true, professional: true, location: true, packageUsage: { include: { customerPackage: true } } }, orderBy: { startsAt: "desc" }, take: 100 },
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
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: tenant.currency });
  const now = new Date();
  const future = customer.bookings.filter((item) => item.startsAt > now && ["PENDING", "CONFIRMED"].includes(item.status)).length;
  const activePackages = customer.packages.filter((item) => item.status === "ACTIVE" && item.remainingUses > 0 && (!item.expiresAt || item.expiresAt >= now));
  const availableUses = activePackages.reduce((sum, item) => sum + item.remainingUses, 0);
  const { theme, style } = publicThemeVariables(tenant.branding as PublicBranding);

  return <main className="booking-page booking-page-v2 customer-portal" data-theme={theme.id} data-theme-mode={theme.dark ? "dark" : "light"} style={style as React.CSSProperties}>
    <div className="customer-portal-wrap">
      <header className="customer-portal-head">
        <div><span className="eyebrow">Mi cuenta</span><h1>Hola, {customer.firstName}</h1><p>{tenant.name}</p></div>
        <div className="customer-portal-actions"><Link className="button secondary" href="/">Nueva reserva</Link><form action={logoutCustomerAction}><input type="hidden" name="slug" value={slug} /><button className="button ghost">Salir</button></form></div>
      </header>

      <div className="customer-account-grid">
        <section className="card"><span className="eyebrow">Saldo / créditos</span><strong className={balance > 0 ? "account-balance due" : "account-balance"}>{money.format(balance / 100)}</strong><p className="muted">{balance > 0 ? "Saldo pendiente con el negocio" : balance < 0 ? "Crédito disponible a tu favor" : "Sin saldo pendiente"}</p></section>
        <section className="card"><span className="eyebrow">Pases disponibles</span><strong className="account-balance">{availableUses}</strong><p className="muted">usos activos en {activePackages.length} paquete{activePackages.length === 1 ? "" : "s"}</p></section>
        <section className="card"><span className="eyebrow">Próximas</span><strong className="account-balance">{future}</strong><p className="muted">reservas futuras activas</p></section>
        <section className="card"><span className="eyebrow">Actividad</span><strong className="account-balance">{customer.bookings.length}</strong><p className="muted">reservas en tu historial</p></section>
      </div>

      {customer.packages.length > 0 && <section className="card" style={{ marginBottom: 18 }}>
        <div className="section-head"><h2>Mis paquetes y membresías</h2><Link className="button ghost" href="/">Usar en una reserva</Link></div>
        <div className="account-history">{customer.packages.map((item) => <article key={item.id}>
          <div><strong>{item.name}</strong><small>{item.package.services.map((link) => link.service.name).join(", ")}</small></div>
          <div style={{ display: "grid", justifyItems: "end", gap: 4 }}><span className={`status ${item.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED"}`}>{packageLabels[item.status]}</span><strong>{item.remainingUses} / {item.totalUses} usos</strong><small>{item.expiresAt ? `Vence ${formatInTimeZone(item.expiresAt, tenant.timezone, "dd/MM/yyyy")}` : "Sin vencimiento"}</small></div>
        </article>)}</div>
      </section>}

      <div className="grid two-col customer-portal-columns">
        <section className="card">
          <h2>Mis reservas</h2>
          {customer.bookings.length ? <div className="account-history">{customer.bookings.map((item) => {
            const canCancel = item.startsAt > now && ["PENDING", "CONFIRMED"].includes(item.status);
            return <article key={item.id}>
              <div><strong>{item.service.name}</strong><small>{item.location.name}{item.professional ? ` · ${item.professional.name}` : ""}{item.packageUsage ? ` · ${item.packageUsage.uses} uso(s) de ${item.packageUsage.customerPackage.name}` : ""}</small></div>
              <div style={{ display: "grid", justifyItems: "end", gap: 5 }}><span className={`status ${item.status}`}>{item.status}</span><small>{formatInTimeZone(item.startsAt, tenant.timezone, "dd/MM/yyyy HH:mm")}</small>{canCancel && <form action={cancelCustomerBookingAction}><input type="hidden" name="slug" value={slug} /><input type="hidden" name="bookingId" value={item.id} /><button className="button ghost" style={{ color: "#b42331", padding: "5px 8px", fontSize: 11 }}>Cancelar</button></form>}</div>
            </article>;
          })}</div> : <div className="empty">Todavía no tenés reservas.</div>}
          <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>La cancelación online respeta la política específica del servicio. Si la reserva usó un paquete, sus usos vuelven automáticamente. Pagos o señas ya cobrados no se reembolsan automáticamente.</p>
        </section>

        <section className="card">
          <h2>Mi perfil</h2>
          <form action={updateCustomerProfileAction}>
            <input type="hidden" name="slug" value={slug} />
            <div className="field"><label>Nombre</label><input className="input" name="firstName" defaultValue={customer.firstName} required /></div>
            <div className="field"><label>Apellido</label><input className="input" name="lastName" defaultValue={customer.lastName ?? ""} /></div>
            <div className="field"><label>Email</label><input className="input" value={session.account.email} disabled /></div>
            <div className="field"><label>Teléfono</label><input className="input" value={customer.phone} disabled /></div>
            <div className="field"><label>Documento</label><input className="input" name="document" defaultValue={customer.document ?? ""} /></div>
            <div className="field"><label>Fecha de nacimiento</label><input className="input" name="birthDate" type="date" defaultValue={customer.birthDate?.toISOString().slice(0, 10) ?? ""} /></div>
            <button className="button">Guardar perfil</button>
          </form>
        </section>
      </div>

      <section className="card account-ledger"><h2>Movimientos de saldo</h2>{customer.ledgerEntries.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Importe</th></tr></thead><tbody>{customer.ledgerEntries.map((item) => <tr key={item.id}><td>{formatInTimeZone(item.createdAt, tenant.timezone, "dd/MM/yyyy")}</td><td>{item.description}</td><td>{labels[item.type]}</td><td className={item.amountCents > 0 ? "ledger-debit" : "ledger-credit"}>{money.format(item.amountCents / 100)}</td></tr>)}</tbody></table></div> : <div className="empty">No hay movimientos registrados.</div>}</section>
    </div>
  </main>;
}
