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
        <span className="eyebrow">Paso 4 · Disponibilidad</span>
        <h1>Horarios semanales</h1>
        <p className="muted">
          Definí la jornada general y, sólo cuando haga falta, agregá horarios específicos para una sede, profesional o recurso.
        </p>
      </div>

      <section className="availability-layout">
        <form action={createWeeklyAvailabilityAction} className="card availability-form">
          <div className="section-head">
            <div>
              <span className="eyebrow">Nuevo bloque</span>
              <h2 style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}><Plus size={17} /> Agregar disponibilidad</h2>
            </div>
            <CalendarClock size={20} />
          </div>

          <div className="field">
            <label>¿A quién aplica este horario?</label>
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
            <small className="muted">Empezá por “Todo el negocio”. Usá reglas específicas únicamente para excepciones de jornada.</small>
          </div>

          <div className="field">
            <label>Días de la semana</label>
            <div className="weekday-grid">
              {weekdayNames.map((name, index) => (
                <label className="weekday-choice" key={name}>
                  <input type="checkbox" name="weekdays" value={index} defaultChecked={index >= 1 && index <= 5} />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="availability-time-grid">
            <div className="field"><label>Hora de inicio</label><input className="input" name="startTime" type="time" defaultValue="09:00" required /></div>
            <div className="field"><label>Hora de fin</label><input className="input" name="endTime" type="time" defaultValue="18:00" required /></div>
          </div>

          <details className="availability-validity">
            <summary>Limitar vigencia por fechas</summary>
            <p className="muted">Dejalo vacío si este horario se repite todas las semanas sin fecha de finalización.</p>
            <div className="availability-validity-grid">
              <div className="field"><label>Válido desde</label><input className="input" name="validFrom" type="date" /></div>
              <div className="field"><label>Válido hasta</label><input className="input" name="validUntil" type="date" /></div>
            </div>
          </details>

          <button className="button" style={{ width: "100%" }}><Clock3 size={15} /> Guardar bloque horario</button>
        </form>

        <aside className="card availability-explainer">
          <div className="section-head"><div><span className="eyebrow">Lógica de agenda</span><h2 style={{ marginTop: 5 }}>Cómo se combinan</h2></div></div>
          <div className="option-grid">
            <div className="option"><span><strong>1. Negocio</strong><br /><small className="muted">Es la base general de atención.</small></span></div>
            <div className="option"><span><strong>2. Sede</strong><br /><small className="muted">Puede acotar el horario de una ubicación.</small></span></div>
            <div className="option"><span><strong>3. Profesional</strong><br /><small className="muted">Define jornadas individuales cuando son distintas.</small></span></div>
            <div className="option"><span><strong>4. Recurso</strong><br /><small className="muted">Limita salas, canchas, boxes o equipos.</small></span></div>
          </div>
          <p className="muted" style={{ margin: "18px 0 0", lineHeight: 1.65 }}>
            Ejemplo: negocio 09–20, sede Centro 10–19 y profesional Ana 14–18. OnlyTurn ofrecerá únicamente horarios donde las reglas necesarias coinciden.
          </p>
        </aside>
      </section>

      <div className="platform-toolbar">
        <div><h2>Reglas activas</h2><span className="muted">Revisá la configuración vigente antes de sumar excepciones nuevas.</span></div>
        <span className="pill">{rules.length} bloque{rules.length === 1 ? "" : "s"}</span>
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Alcance</th><th>Día</th><th>Horario</th><th>Vigencia</th><th></th></tr></thead>
          <tbody>
            {rules.length ? rules.map((rule) => (
              <tr key={rule.id}>
                <td><strong>{ownerLabel(rule)}</strong><div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{rule.ownerType}</div></td>
                <td>{weekdayNames[rule.weekday] ?? rule.weekday}</td>
                <td><strong>{minuteToTime(rule.startMinute)} — {minuteToTime(rule.endMinute)}</strong></td>
                <td className="muted">{rule.validFrom ? new Intl.DateTimeFormat("es-AR").format(rule.validFrom) : "Siempre"}{rule.validUntil ? ` → ${new Intl.DateTimeFormat("es-AR").format(rule.validUntil)}` : ""}</td>
                <td style={{ textAlign: "right" }}>
                  <form action={deleteAvailabilityRuleAction}>
                    <input type="hidden" name="ruleId" value={rule.id} />
                    <button className="button ghost" aria-label="Eliminar regla" style={{ color: "#b42331", padding: 8 }}><Trash2 size={15} /></button>
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
