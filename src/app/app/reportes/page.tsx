import { BarChart3, CalendarCheck2, CircleDollarSign, UserRoundCheck } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { getTenantReport } from "@/lib/reports";

export default async function ReportsPage() {
  const { membership, tenant } = await requireTenantSession();
  const report = await getTenantReport(membership.tenantId, 30);
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: tenant.currency, maximumFractionDigits: 0 });
  const pct = (value: number) => `${value.toFixed(1)}%`;

  return (
    <>
      <div className="page-title"><span className="eyebrow">Inteligencia operativa</span><h1>Reportes</h1><p className="muted">Visión comercial y operativa de los últimos 30 días, calculada sobre datos reales del tenant.</p></div>
      <section className="grid stats" style={{ marginBottom: 18 }}>
        <div className="card stat"><span className="muted">Reservas</span><strong>{report.bookings}</strong><small className="muted">{report.bookingGrowthPercent >= 0 ? "+" : ""}{pct(report.bookingGrowthPercent)} vs. período anterior</small></div>
        <div className="card stat"><span className="muted">Cobrado online</span><strong>{money.format(report.paidCents / 100)}</strong><small className="muted">{report.paidTransactions} pagos aprobados</small></div>
        <div className="card stat"><span className="muted">Cancelaciones</span><strong>{pct(report.cancellationRate)}</strong><small className="muted">{report.cancelled} reservas</small></div>
        <div className="card stat"><span className="muted">Ausencias</span><strong>{pct(report.noShowRate)}</strong><small className="muted">{report.noShow} no-show</small></div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginBottom: 18 }}>
        <div className="card"><div className="section-head"><h2><UserRoundCheck size={17} /> Clientes</h2></div><strong className="account-balance">{report.totalCustomers}</strong><p className="muted">{report.newCustomers} nuevos · {report.returningCustomers} recurrentes en el período</p></div>
        <div className="card"><div className="section-head"><h2><CalendarCheck2 size={17} /> Completados</h2></div><strong className="account-balance">{report.completed}</strong><p className="muted">reservas marcadas como completadas</p></div>
        <div className="card"><div className="section-head"><h2><BarChart3 size={17} /> Ocupación grupal</h2></div><strong className="account-balance">{pct(report.sessionOccupancy)}</strong><p className="muted">cupos ocupados en clases y eventos del período</p></div>
      </section>

      <section className="grid two-col" style={{ alignItems: "start" }}>
        <div className="card"><div className="section-head"><h2>Servicios más demandados</h2><CircleDollarSign size={17} /></div>{report.services.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Servicio</th><th>Reservas</th><th>Personas</th><th>Valor reservado</th></tr></thead><tbody>{report.services.slice(0, 15).map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{item.bookings}</td><td>{item.people}</td><td>{money.format(item.valueCents / 100)}</td></tr>)}</tbody></table></div> : <div className="empty">Todavía no hay actividad para analizar.</div>}</div>
        <div className="card"><div className="section-head"><h2>Equipo</h2></div>{report.professionals.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Profesional</th><th>Reservas</th></tr></thead><tbody>{report.professionals.slice(0, 15).map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{item.bookings}</td></tr>)}</tbody></table></div> : <div className="empty">No hay asignaciones de profesionales en el período.</div>}</div>
      </section>

      <div className="platform-toolbar"><h2>Segmentación CRM</h2><span className="muted" style={{ fontSize: 12 }}>Etiquetas cargadas en las fichas de clientes</span></div>
      <div className="card">{report.tags.length ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{report.tags.map((item) => <span className="pill" key={item.tag}>{item.tag} · {item.count}</span>)}</div> : <div className="empty">Agregá etiquetas desde Clientes para empezar a segmentar la base.</div>}</div>
    </>
  );
}
