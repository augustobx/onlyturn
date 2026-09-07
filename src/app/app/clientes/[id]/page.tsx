import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { addCustomerLedgerEntryAction, updateCustomerAccountStatusAction, updateCustomerCrmAction } from "@/app/actions/customers";
import { requireTenantSession } from "@/lib/auth";
import { createTenantDb } from "@/lib/tenant-db";

const accountLabels = { PENDING: "Pendiente de aprobación", ACTIVE: "Cuenta activa", REJECTED: "Cuenta rechazada", SUSPENDED: "Cuenta suspendida" } as const;
const ledgerLabels = { CHARGE: "Cargo", PAYMENT: "Pago", CREDIT: "Crédito", ADJUSTMENT: "Ajuste" } as const;

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership, tenant } = await requireTenantSession();
  const customer = await createTenantDb(membership.tenantId).customerDetail(id);
  if (!customer) notFound();
  const balance = customer.ledgerEntries.reduce((sum, item) => sum + item.amountCents, 0);
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: tenant.currency });
  const completed = customer.bookings.filter((item) => item.status === "COMPLETED").length;
  const noShows = customer.bookings.filter((item) => item.status === "NO_SHOW").length;
  const cancelled = customer.bookings.filter((item) => item.status === "CANCELLED").length;

  return <>
    <div className="page-title"><span className="eyebrow">CRM · Ficha del cliente</span><h1>{customer.firstName} {customer.lastName}</h1><p className="muted">{customer.phone} · {customer.email ?? "Sin email"}</p></div>
    <div className="settings-actions" style={{ marginBottom: 18 }}><Link className="button ghost" href="/clientes">← Volver a clientes</Link></div>

    <div className="customer-admin-summary">
      <section className="card"><span className="eyebrow">Cuenta registrada</span>{customer.account ? <><h2>{accountLabels[customer.account.status]}</h2><p className="muted">{customer.account.email}</p><div className="settings-actions">{customer.account.status !== "ACTIVE" && <StatusButton customerId={id} status="ACTIVE" label="Aprobar y activar" />}{customer.account.status !== "SUSPENDED" && customer.account.status !== "PENDING" && <StatusButton customerId={id} status="SUSPENDED" label="Suspender" secondary />}{customer.account.status === "PENDING" && <StatusButton customerId={id} status="REJECTED" label="Rechazar" secondary />}</div></> : <div className="empty">Este cliente todavía no creó una cuenta.</div>}</section>
      <section className="card"><span className="eyebrow">Saldo / créditos</span><strong className={balance > 0 ? "account-balance due" : "account-balance"}>{money.format(balance / 100)}</strong><p className="muted">{balance > 0 ? "Saldo pendiente" : balance < 0 ? "Crédito disponible a favor" : "Cuenta al día"}</p></section>
      <section className="card"><span className="eyebrow">Comportamiento</span><strong className="account-balance">{customer.bookings.length}</strong><p className="muted">{completed} completados · {cancelled} cancelados · {noShows} ausencias</p></section>
    </div>

    <div className="grid two-col customer-admin-columns">
      <section className="card">
        <h2>CRM</h2>
        <p className="muted">Etiquetas y notas internas para segmentar, recordar preferencias y mantener contexto operativo.</p>
        <form action={updateCustomerCrmAction}>
          <input type="hidden" name="customerId" value={id} />
          <div className="field"><label>Etiquetas</label><input className="input" name="tags" defaultValue={customer.tags.join(", ")} placeholder="VIP, mensual, preferencia mañana" /><small className="muted">Separadas por coma.</small></div>
          <div className="field"><label>Notas internas</label><textarea className="input" name="notes" rows={7} maxLength={5000} defaultValue={customer.notes ?? ""} placeholder="Preferencias, observaciones, contexto comercial…" /></div>
          <button className="button">Guardar CRM</button>
        </form>
      </section>

      <section className="card">
        <h2>Saldo y créditos</h2>
        <p className="muted">Los cargos aumentan deuda; pagos y créditos reducen el saldo. Un saldo negativo representa crédito disponible del cliente.</p>
        <form action={addCustomerLedgerEntryAction}>
          <input type="hidden" name="customerId" value={id} />
          <div className="field"><label>Tipo</label><select className="select" name="type"><option value="CHARGE">Cargo</option><option value="PAYMENT">Pago recibido</option><option value="CREDIT">Crédito / bono a favor</option><option value="ADJUSTMENT">Ajuste con signo</option></select></div>
          <div className="field"><label>Importe</label><input className="input" name="amount" type="number" step="0.01" required /></div>
          <div className="field"><label>Concepto</label><input className="input" name="description" maxLength={200} required placeholder="Ej. Bono 5 sesiones / crédito comercial" /></div>
          <div className="field"><label>Vincular a reserva (opcional)</label><select className="select" name="bookingId"><option value="">Sin reserva asociada</option>{customer.bookings.map((item) => <option value={item.id} key={item.id}>{formatInTimeZone(item.startsAt, tenant.timezone, "dd/MM/yy HH:mm")} · {item.service.name}</option>)}</select></div>
          <button className="button">Guardar movimiento</button>
        </form>
      </section>
    </div>

    <section className="card" style={{ marginTop: 18 }}><h2>Historial de reservas</h2>{customer.bookings.length ? <div className="account-history">{customer.bookings.map((item) => <article key={item.id}><div><strong>{item.service.name}</strong><small>{item.location.name}{item.professional ? ` · ${item.professional.name}` : ""}</small></div><div><span className={`status ${item.status}`}>{item.status}</span><small>{formatInTimeZone(item.startsAt, tenant.timezone, "dd/MM/yyyy HH:mm")}</small></div></article>)}</div> : <div className="empty">No hay reservas.</div>}</section>

    <section className="card account-ledger" style={{ marginTop: 18 }}><h2>Movimientos de cuenta</h2>{customer.ledgerEntries.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Importe</th></tr></thead><tbody>{customer.ledgerEntries.map((item) => <tr key={item.id}><td>{formatInTimeZone(item.createdAt, tenant.timezone, "dd/MM/yyyy HH:mm")}</td><td>{item.description}</td><td>{ledgerLabels[item.type]}</td><td className={item.amountCents > 0 ? "ledger-debit" : "ledger-credit"}>{money.format(item.amountCents / 100)}</td></tr>)}</tbody></table></div> : <div className="empty">No hay movimientos registrados.</div>}</section>
  </>;
}

function StatusButton({ customerId, status, label, secondary = false }: { customerId: string; status: "ACTIVE" | "REJECTED" | "SUSPENDED"; label: string; secondary?: boolean }) {
  return <form action={updateCustomerAccountStatusAction}><input type="hidden" name="customerId" value={customerId} /><input type="hidden" name="status" value={status} /><button className={`button${secondary ? " secondary" : ""}`}>{label}</button></form>;
}
