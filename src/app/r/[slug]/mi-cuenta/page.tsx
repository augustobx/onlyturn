import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { cancelCustomerBookingAction, logoutCustomerAction, updateCustomerProfileAction } from "@/app/actions/customer-account";
import { getPublicTenant } from "@/lib/booking-service";
import { requireCustomerSession } from "@/lib/customer-auth";
import { platformDb } from "@/lib/db";

const labels = { CHARGE: "Cargo", PAYMENT: "Pago", CREDIT: "Crédito", ADJUSTMENT: "Ajuste" } as const;

export default async function CustomerPortalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) notFound();
  const session = await requireCustomerSession(tenant.id);
  const customer = await platformDb.customer.findFirst({
    where: { id: session.account.customerId, tenantId: tenant.id },
    include: {
      bookings: { include: { service: true, professional: true, location: true }, orderBy: { startsAt: "desc" }, take: 100 },
      ledgerEntries: { orderBy: { createdAt: "desc" }, take: 200 },
    },
  });
  if (!customer) notFound();
  const balance = customer.ledgerEntries.reduce((sum, item) => sum + item.amountCents, 0);
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: tenant.currency });
  const now = new Date();
  const future = customer.bookings.filter((item) => item.startsAt > now && ["PENDING", "CONFIRMED"].includes(item.status)).length;

  return <main className="booking-page customer-portal">
    <div className="customer-portal-wrap">
      <header className="customer-portal-head">
        <div><span className="eyebrow">Mi cuenta</span><h1>Hola, {customer.firstName}</h1><p>{tenant.name}</p></div>
        <div className="customer-portal-actions"><Link className="button secondary" href="/">Nueva reserva</Link><form action={logoutCustomerAction}><input type="hidden" name="slug" value={slug} /><button className="button ghost">Salir</button></form></div>
      </header>

      <div className="customer-account-grid">
        <section className="card"><span className="eyebrow">Saldo / créditos</span><strong className={balance > 0 ? "account-balance due" : "account-balance"}>{money.format(balance / 100)}</strong><p className="muted">{balance > 0 ? "Saldo pendiente con el negocio" : balance < 0 ? "Crédito disponible a tu favor" : "Sin saldo pendiente"}</p></section>
        <section className="card"><span className="eyebrow">Próximas</span><strong className="account-balance">{future}</strong><p className="muted">reservas futuras activas</p></section>
        <section className="card"><span className="eyebrow">Actividad</span><strong className="account-balance">{customer.bookings.length}</strong><p className="muted">reservas en tu historial</p></section>
      </div>

      <div className="grid two-col customer-portal-columns">
        <section className="card">
          <h2>Mis reservas</h2>
          {customer.bookings.length ? <div className="account-history">{customer.bookings.map((item) => {
            const canCancel = item.startsAt > now && ["PENDING", "CONFIRMED"].includes(item.status);
            return <article key={item.id}>
              <div><strong>{item.service.name}</strong><small>{item.location.name}{item.professional ? ` · ${item.professional.name}` : ""}</small></div>
              <div style={{ display: "grid", justifyItems: "end", gap: 5 }}><span className={`status ${item.status}`}>{item.status}</span><small>{formatInTimeZone(item.startsAt, tenant.timezone, "dd/MM/yyyy HH:mm")}</small>{canCancel && <form action={cancelCustomerBookingAction}><input type="hidden" name="slug" value={slug} /><input type="hidden" name="bookingId" value={item.id} /><button className="button ghost" style={{ color: "#b42331", padding: "5px 8px", fontSize: 11 }}>Cancelar</button></form>}</div>
            </article>;
          })}</div> : <div className="empty">Todavía no tenés reservas.</div>}
          <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>La cancelación online respeta la política específica del servicio. Pagos o señas ya cobrados no se reembolsan automáticamente: el negocio define el tratamiento correspondiente.</p>
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
