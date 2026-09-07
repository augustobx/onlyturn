import { CalendarClock, Clock3, Plus, Trash2 } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { getAvailabilityManagementData } from "@/lib/availability-management";
import { createWeeklyAvailabilityAction, deleteAvailabilityRuleAction } from "@/app/actions/availability-management";

const weekdayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const minuteToTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

export default async function AvailabilityPage() {
  const { membership, tenant } = await requireTenantSession();
  const [rules, locations, professionals, resources] = await getAvailabilityManagementData(membership.tenantId);

  const ownerLabel = (rule: (typeof rules)[number]) => {
    if (rule.ownerType === "TENANT") return tenant.name;
    if (rule.ownerType === "LOCATION") return `Sede · ${rule.location?.name ?? "—"}`;
    if (rule.ownerType === "PROFESSIONAL") return `Profesional · ${rule.professional?.name ?? "—"}`;
    return `Recurso · ${rule.resource?.name ?? "—"}`;
  };

  return (
    <>
      <div className="page-title">
        <span className="eyebrow">Motor de disponibilidad</span>
        <h1>Horarios semanales</h1>
        <p className="muted">
          Definí jornadas por negocio, sede, profesional o recurso. Podés crear varios bloques en el mismo día para horarios partidos.
        </p>
      </div>

      <section className="grid two-col" style={{ alignItems: "start" }}>
        <form action={createWeeklyAvailabilityAction} className="card">
          <div className="section-head">
            <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}><Plus size={17} /> Nueva disponibilidad</h2>
            <CalendarClock size={19} />
          </div>

          <div className="field">
            <label>Aplicar horario a</label>
            <select className="select" name="target" defaultValue="TENANT:">
              <option value="TENANT:">Todo el negocio · {tenant.name}</option>
              <optgroup label="Sucursales">
                {locations.map((item) => <option value={`LOCATION:${item.id}`} key={`l-${item.id}`}>{item.name}</option>)}
              </optgroup>
              <optgroup label="Profesionales">
                {professionals.map((item) => <option value={`PROFESSIONAL:${item.id}`} key={`p-${item.id}`}>{item.name}</option>)}
              </optgroup>
              <optgroup label="Recursos">
                {resources.map((item) => <option value={`RESOURCE:${item.id}`} key={`r-${item.id}`}>{item.name}</option>)}
              </optgroup>
            </select>
            <small className="muted">Las reglas más específicas se intersectan con las generales al calcular un turno.</small>
          </div>

          <div className="field">
            <label>Días</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
              {weekdayNames.map((name, index) => (
                <label key={name} style={{ display: "flex", gap: 7, alignItems: "center", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 10px", fontSize: 12 }}>
                  <input type="checkbox" name="weekdays" value={index} defaultChecked={index >= 1 && index <= 5} /> {name}
                </label>
              ))}
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field"><label>Desde</label><input className="input" name="startTime" type="time" defaultValue="09:00" required /></div>
            <div className="field"><label>Hasta</label><input className="input" name="endTime" type="time" defaultValue="18:00" required /></div>
          </div>

          <details style={{ margin: "10px 0 16px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Vigencia opcional</summary>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
              <div className="field"><label>Válido desde</label><input className="input" name="validFrom" type="date" /></div>
              <div className="field"><label>Válido hasta</label><input className="input" name="validUntil" type="date" /></div>
            </div>
          </details>

          <button className="button" style={{ width: "100%" }}><Clock3 size={15} /> Agregar bloque horario</button>
        </form>

        <aside className="card">
          <div className="section-head"><h2>Cómo funciona</h2></div>
          <div className="option-grid">
            <div className="option"><span><strong>Negocio</strong><br /><small className="muted">Base general de atención.</small></span></div>
            <div className="option"><span><strong>Sede</strong><br /><small className="muted">Limita la disponibilidad de una ubicación concreta.</small></span></div>
            <div className="option"><span><strong>Profesional</strong><br /><small className="muted">Turnos y jornadas individuales.</small></span></div>
            <div className="option"><span><strong>Recurso</strong><br /><small className="muted">Disponibilidad de salas, canchas, boxes o equipos.</small></span></div>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
            Ejemplo: negocio 09–20, sede Centro 10–19 y profesional Ana 14–18. OnlyTurn ofrecerá únicamente la intersección válida.
          </p>
        </aside>
      </section>

      <div className="platform-toolbar">
        <h2>Reglas activas</h2>
        <span className="muted" style={{ fontSize: 12 }}>{rules.length} bloque{rules.length === 1 ? "" : "s"} semanal{rules.length === 1 ? "" : "es"}</span>
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Alcance</th><th>Día</th><th>Horario</th><th>Vigencia</th><th></th></tr></thead>
          <tbody>
            {rules.length ? rules.map((rule) => (
              <tr key={rule.id}>
                <td><strong>{ownerLabel(rule)}</strong><div className="muted" style={{ fontSize: 11 }}>{rule.ownerType}</div></td>
                <td>{weekdayNames[rule.weekday] ?? rule.weekday}</td>
                <td><strong>{minuteToTime(rule.startMinute)} — {minuteToTime(rule.endMinute)}</strong></td>
                <td className="muted">{rule.validFrom ? new Intl.DateTimeFormat("es-AR").format(rule.validFrom) : "Siempre"}{rule.validUntil ? ` → ${new Intl.DateTimeFormat("es-AR").format(rule.validUntil)}` : ""}</td>
                <td style={{ textAlign: "right" }}>
                  <form action={deleteAvailabilityRuleAction}>
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <button className="button ghost" aria-label="Eliminar regla" style={{ color: "#b42331", padding: 7 }}><Trash2 size={14} /></button>
                  </form>
                </td>
              </tr>
            )) : <tr><td colSpan={5}><div className="empty">No hay reglas semanales. Agregá la primera para habilitar horarios de reserva.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
