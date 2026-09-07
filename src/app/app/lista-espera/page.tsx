import { Clock3, ListChecks, Users, XCircle } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { requireTenantSession } from "@/lib/auth";
import { getWaitlistManagementData } from "@/lib/waitlist";
import { cancelWaitlistEntryAction } from "@/app/actions/waitlist";

export default async function WaitlistPage() {
  const { membership, tenant } = await requireTenantSession();
  const entries = await getWaitlistManagementData(membership.tenantId);

  const sessionEntries = entries.filter((entry) => entry.sessionId);
  const flexibleEntries = entries.filter((entry) => !entry.sessionId);

  return (
    <>
      <div className="page-title">
        <span className="eyebrow">Demanda sin disponibilidad</span>
        <h1>Lista de espera</h1>
        <p className="muted">Centralizá clientes que quieren reservar cuando no hay lugar y recuperá huecos liberados por cancelaciones.</p>
      </div>

      <section className="grid stats" style={{ marginBottom: 18 }}>
        <div className="card stat"><span className="muted">Pendientes</span><strong>{entries.filter((entry) => entry.status === "WAITING").length}</strong><small className="muted">esperando lugar</small></div>
        <div className="card stat"><span className="muted">Ofertas activas</span><strong>{entries.filter((entry) => entry.status === "OFFERED").length}</strong><small className="muted">contactadas</small></div>
        <div className="card stat"><span className="muted">Sesiones</span><strong>{sessionEntries.length}</strong><small className="muted">esperan cupo puntual</small></div>
        <div className="card stat"><span className="muted">Flexibles</span><strong>{flexibleEntries.length}</strong><small className="muted">esperan fecha/horario</small></div>
      </section>

      <div className="platform-toolbar"><h2>Solicitudes activas</h2><span className="muted" style={{ fontSize: 12 }}>{entries.length} entrada{entries.length === 1 ? "" : "s"}</span></div>

      {entries.length ? (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Cliente</th><th>Busca</th><th>Preferencia</th><th>Ingreso</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {entries.map((entry) => {
                const preferences = entry.preferences as { preferredDate?: string | null };
                return (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.customer.firstName} {entry.customer.lastName}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>{entry.customer.phone}{entry.partySize > 1 ? ` · ${entry.partySize} personas` : ""}</div>
                    </td>
                    <td>
                      <strong>{entry.service.name}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>{entry.location.name}{entry.professional?.name ? ` · ${entry.professional.name}` : ""}{entry.resource?.name ? ` · ${entry.resource.name}` : ""}</div>
                    </td>
                    <td>
                      {entry.session ? (
                        <span><Clock3 size={13} style={{ verticalAlign: "-2px" }} /> {formatInTimeZone(entry.session.startsAt, tenant.timezone, "dd/MM HH:mm")}</span>
                      ) : preferences.preferredDate ? preferences.preferredDate.split("-").reverse().join("/") : "Cualquier horario"}
                    </td>
                    <td>{formatInTimeZone(entry.createdAt, tenant.timezone, "dd/MM HH:mm")}</td>
                    <td><span className={`status ${entry.status}`}>{entry.status === "WAITING" ? "Esperando" : "Oferta enviada"}</span></td>
                    <td style={{ textAlign: "right" }}>
                      <form action={cancelWaitlistEntryAction}>
                        <input type="hidden" name="entryId" value={entry.id} />
                        <button className="button ghost" aria-label="Quitar de lista" style={{ color: "#b42331", padding: 7 }}><XCircle size={14} /></button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card empty"><ListChecks size={28} /><strong>La lista está vacía</strong><span className="muted">Cuando un cliente se anote por falta de disponibilidad, aparecerá acá.</span></div>
      )}

      <section className="grid two-col" style={{ marginTop: 18 }}>
        <div className="card"><div className="section-head"><h2><Users size={16} /> Cómo usarla hoy</h2></div><p className="muted">La gestión inicial es manual: cuando aparece un hueco, contactás al cliente y generás el turno desde Agenda. El modelo ya registra prioridad por orden de ingreso y la sesión deseada.</p></div>
        <div className="card"><div className="section-head"><h2>Próxima automatización</h2></div><p className="muted">La siguiente capa puede ofrecer el hueco automáticamente por WhatsApp/email con vencimiento, política “primero en reservar”, prioridad o envío a todos.</p></div>
      </section>
    </>
  );
}
