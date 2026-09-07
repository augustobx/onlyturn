import { CalendarClock, Clock3, Pencil, Plus, RotateCcw, XCircle } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { getAvailabilityManagementData } from "@/lib/availability-management";
import { FeedbackForm } from "@/components/feedback-form";
import { createWeeklyAvailabilityAction, setAvailabilityRuleActiveAction, updateAvailabilityRuleAction } from "@/app/actions/availability-management";

const weekdayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const minuteToTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
const dateInput = (value: Date | null) => value ? value.toISOString().slice(0, 10) : "";

export default async function AvailabilityPage() {
  const { membership, tenant } = await requireTenantSession();
  const [rules, locations, professionals, resources] = await getAvailabilityManagementData(membership.tenantId);
  const activeRules = rules.filter((rule) => rule.isActive);

  const ownerLabel = (rule: (typeof rules)[number]) => {
    if (rule.ownerType === "TENANT") return tenant.name;
    if (rule.ownerType === "LOCATION") return `Sede · ${rule.location?.name ?? "—"}`;
    if (rule.ownerType === "PROFESSIONAL") return `Profesional · ${rule.professional?.name ?? "—"}`;
    return `Recurso · ${rule.resource?.name ?? "—"}`;
  };

  const ownerValue = (rule: (typeof rules)[number]) => {
    if (rule.ownerType === "TENANT") return "TENANT:";
    if (rule.ownerType === "LOCATION") return `LOCATION:${rule.locationId ?? ""}`;
    if (rule.ownerType === "PROFESSIONAL") return `PROFESSIONAL:${rule.professionalId ?? ""}`;
    return `RESOURCE:${rule.resourceId ?? ""}`;
  };

  const ownerOptions = <>
    <option value="TENANT:">Todo el negocio · {tenant.name}</option>
    <optgroup label="Sucursales">{locations.map((item) => <option value={`LOCATION:${item.id}`} key={`l-${item.id}`}>{item.name}</option>)}</optgroup>
    <optgroup label="Profesionales">{professionals.map((item) => <option value={`PROFESSIONAL:${item.id}`} key={`p-${item.id}`}>{item.name}</option>)}</optgroup>
    <optgroup label="Recursos">{resources.map((item) => <option value={`RESOURCE:${item.id}`} key={`r-${item.id}`}>{item.name}</option>)}</optgroup>
  </>;

  return <>
    <div className="page-title">
      <span className="eyebrow">Paso 4 · Disponibilidad</span>
      <h1>Horarios semanales</h1>
      <p className="muted">Definí la jornada general y editá, desactivá o recuperá cualquier bloque. Cada cambio confirma cuando quedó guardado.</p>
    </div>

    <section className="availability-layout">
      <FeedbackForm action={createWeeklyAvailabilityAction} className="card availability-form" savedMessage="Horario agregado">
        <div className="section-head"><div><span className="eyebrow">Nuevo bloque</span><h2 style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}><Plus size={17} /> Agregar disponibilidad</h2></div><CalendarClock size={20} /></div>
        <div className="field"><label>¿A quién aplica este horario?</label><select className="select" name="target" defaultValue="TENANT:">{ownerOptions}</select><small className="muted">Empezá por “Todo el negocio”. Usá reglas específicas únicamente cuando haga falta.</small></div>
        <div className="field"><label>Días de la semana</label><div className="weekday-grid">{weekdayNames.map((name, index) => <label className="weekday-choice" key={name}><input type="checkbox" name="weekdays" value={index} defaultChecked={index >= 1 && index <= 5} /><span>{name}</span></label>)}</div></div>
        <div className="availability-time-grid"><div className="field"><label>Hora de inicio</label><input className="input" name="startTime" type="time" defaultValue="09:00" required /></div><div className="field"><label>Hora de fin</label><input className="input" name="endTime" type="time" defaultValue="18:00" required /></div></div>
        <details className="availability-validity"><summary>Limitar vigencia por fechas</summary><p className="muted">Dejalo vacío si este horario se repite todas las semanas sin fecha de finalización.</p><div className="availability-validity-grid"><div className="field"><label>Válido desde</label><input className="input" name="validFrom" type="date" /></div><div className="field"><label>Válido hasta</label><input className="input" name="validUntil" type="date" /></div></div></details>
        <button className="button" type="submit" style={{ width: "100%" }}><Clock3 size={15} /> Guardar bloque horario</button>
      </FeedbackForm>

      <aside className="card availability-explainer">
        <div className="section-head"><div><span className="eyebrow">Lógica de agenda</span><h2 style={{ marginTop: 5 }}>Cómo se combinan</h2></div></div>
        <div className="option-grid"><div className="option"><span><strong>1. Negocio</strong><br /><small className="muted">Es la base general de atención.</small></span></div><div className="option"><span><strong>2. Sede</strong><br /><small className="muted">Puede acotar el horario de una ubicación.</small></span></div><div className="option"><span><strong>3. Profesional</strong><br /><small className="muted">Define jornadas individuales cuando son distintas.</small></span></div><div className="option"><span><strong>4. Recurso</strong><br /><small className="muted">Limita salas, canchas, boxes o equipos.</small></span></div></div>
        <p className="muted" style={{ margin: "18px 0 0", lineHeight: 1.65 }}>Ejemplo: negocio 09–20, sede Centro 10–19 y profesional Ana 14–18. OnlyTurn ofrecerá únicamente horarios donde las reglas necesarias coinciden.</p>
      </aside>
    </section>

    <div className="platform-toolbar"><div><h2>Bloques configurados</h2><span className="muted">{activeRules.length} activos · {rules.length - activeRules.length} inactivos</span></div><span className="muted">Abrí uno para editarlo.</span></div>

    <div className="availability-rule-list">
      {rules.length ? rules.map((rule) => <details className={`card availability-rule-card ${rule.isActive ? "" : "is-archived"}`} key={rule.id}>
        <summary>
          <div><strong>{ownerLabel(rule)}</strong><small>{weekdayNames[rule.weekday]} · {minuteToTime(rule.startMinute)} — {minuteToTime(rule.endMinute)}</small></div>
          <div className="availability-rule-meta"><span className={`status ${rule.isActive ? "ACTIVE" : "SUSPENDED"}`}>{rule.isActive ? "Activo" : "Inactivo"}</span><span className="muted">{rule.validFrom ? new Intl.DateTimeFormat("es-AR").format(rule.validFrom) : "Siempre"}{rule.validUntil ? ` → ${new Intl.DateTimeFormat("es-AR").format(rule.validUntil)}` : ""}</span></div>
        </summary>
        <div className="availability-rule-editor">
          <FeedbackForm action={updateAvailabilityRuleAction} className="setup-edit-form" savedMessage="Horario actualizado">
            <input type="hidden" name="ruleId" value={rule.id} />
            <div className="field"><label>Alcance</label><select className="select" name="target" defaultValue={ownerValue(rule)}>{ownerOptions}</select></div>
            <div className="field"><label>Día</label><select className="select" name="weekday" defaultValue={rule.weekday}>{weekdayNames.map((name, index) => <option value={index} key={name}>{name}</option>)}</select></div>
            <div className="field"><label>Desde</label><input className="input" name="startTime" type="time" defaultValue={minuteToTime(rule.startMinute)} required /></div>
            <div className="field"><label>Hasta</label><input className="input" name="endTime" type="time" defaultValue={minuteToTime(rule.endMinute)} required /></div>
            <div className="field"><label>Válido desde</label><input className="input" name="validFrom" type="date" defaultValue={dateInput(rule.validFrom)} /></div>
            <div className="field"><label>Válido hasta</label><input className="input" name="validUntil" type="date" defaultValue={dateInput(rule.validUntil)} /></div>
            <button className="button secondary" type="submit"><Pencil size={14} /> Guardar cambios</button>
          </FeedbackForm>
          <FeedbackForm action={setAvailabilityRuleActiveAction} className="setup-lifecycle-action" savedMessage={rule.isActive ? "Horario desactivado" : "Horario reactivado"}><input type="hidden" name="ruleId" value={rule.id} /><input type="hidden" name="active" value={rule.isActive ? "false" : "true"} /><button type="submit" className={`button ${rule.isActive ? "ghost danger-action" : "secondary"}`}>{rule.isActive ? <><XCircle size={14} /> Desactivar bloque</> : <><RotateCcw size={14} /> Reactivar bloque</>}</button><small className="muted">La baja conserva la regla y permite recuperarla.</small></FeedbackForm>
        </div>
      </details>) : <div className="card empty">No hay reglas semanales. Agregá la primera para habilitar horarios de reserva.</div>}
    </div>
  </>;
}
