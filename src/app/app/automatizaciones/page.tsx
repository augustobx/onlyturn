import { BellRing, Mail, MessageCircle, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { getAutomationData, type AutomationTemplate } from "@/lib/automation";
import { createAutomationRuleAction, deleteAutomationRuleAction, toggleAutomationRuleAction, updateAutomationRuleAction } from "@/app/actions/automations";

const eventLabels = {
  BOOKING_CREATED: "Reserva creada",
  BOOKING_REMINDER: "Recordatorio antes del turno",
  BOOKING_CANCELLED: "Reserva cancelada",
} as const;

export default async function AutomationsPage() {
  const { membership } = await requireTenantSession();
  const [rules, logs] = await getAutomationData(membership.tenantId);
  const sent = logs.filter((log) => log.status === "SENT").length;
  const failed = logs.filter((log) => log.status === "FAILED").length;

  return <>
    <div className="page-title"><span className="eyebrow">Comunicación automática</span><h1>Automatizaciones</h1><p className="muted">Creá, editá, pausá o eliminá reglas de comunicación sin tocar el historial de envíos ya realizados.</p></div>

    <section className="grid stats" style={{ marginBottom: 18 }}>
      <div className="card stat"><span className="muted">Reglas activas</span><strong>{rules.filter((rule) => rule.isActive).length}</strong><small className="muted">de {rules.length} configuradas</small></div>
      <div className="card stat"><span className="muted">Enviados recientes</span><strong>{sent}</strong><small className="muted">últimos {logs.length} registros</small></div>
      <div className="card stat"><span className="muted">Fallidos</span><strong>{failed}</strong><small className="muted">requieren revisar provider</small></div>
      <div className="card stat"><span className="muted">Worker</span><strong>60 s</strong><small className="muted">ciclo interno</small></div>
    </section>

    <section className="grid two-col" style={{ alignItems: "start" }}>
      <form action={createAutomationRuleAction} className="card">
        <div className="section-head"><h2><BellRing size={17} /> Nueva automatización</h2></div>
        <AutomationFields />
        <button className="button" style={{ width: "100%", marginTop: 14 }}>Crear automatización</button>
      </form>
      <aside className="card"><h2>Configuración de canales</h2><div className="option-grid"><div className="option"><Mail size={17} /><span><strong>Email</strong><br /><small className="muted">Provider Resend mediante variables de entorno.</small></span></div><div className="option"><MessageCircle size={17} /><span><strong>WhatsApp</strong><br /><small className="muted">Webhook propio o Meta Graph según el provider conectado.</small></span></div></div></aside>
    </section>

    <div className="platform-toolbar"><h2>Reglas</h2><span className="muted">Abrí una regla para editarla.</span></div>
    <div className="settings-manage-list">
      {rules.map((rule) => {
        const template = rule.template as AutomationTemplate;
        return <details className={`card settings-manage-item ${rule.isActive ? "" : "is-archived"}`} key={rule.id}>
          <summary><div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><strong>{rule.name}</strong><span className="pill">{rule.channel}</span></div><small>{eventLabels[rule.event as keyof typeof eventLabels] ?? rule.event} · {rule.offsetMinutes} min · {template.text}</small></div><span className={`status ${rule.isActive ? "ACTIVE" : "SUSPENDED"}`}>{rule.isActive ? "Activa" : "Pausada"}</span></summary>
          <div className="settings-manage-panel">
            <form action={updateAutomationRuleAction} className="automation-edit-form">
              <input type="hidden" name="id" value={rule.id} />
              <AutomationFields defaults={{ name: rule.name, event: rule.event as keyof typeof eventLabels, channel: rule.channel as "EMAIL" | "WHATSAPP", offsetMinutes: rule.offsetMinutes, subject: template.subject ?? "", text: template.text }} />
              <button className="button secondary"><Pencil size={14} /> Guardar cambios</button>
            </form>
            <div className="setup-lifecycle-action">
              <form action={toggleAutomationRuleAction}><input type="hidden" name="id" value={rule.id} /><input type="hidden" name="enabled" value={rule.isActive ? "false" : "true"} /><button className="button secondary">{rule.isActive ? <><Pause size={14} /> Pausar</> : <><Play size={14} /> Activar</>}</button></form>
              <form action={deleteAutomationRuleAction}><input type="hidden" name="id" value={rule.id} /><button className="button ghost danger-action"><Trash2 size={14} /> Eliminar regla</button></form>
            </div>
          </div>
        </details>;
      })}
      {!rules.length && <div className="card empty">Todavía no hay automatizaciones.</div>}
    </div>

    <div className="platform-toolbar"><h2>Últimos envíos</h2></div>
    <div className="card table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>Evento</th><th>Canal</th><th>Estado</th><th>Error</th></tr></thead><tbody>{logs.length ? logs.map((log) => <tr key={log.id}><td>{new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(log.createdAt)}</td><td>{log.event}</td><td>{log.channel}</td><td><span className={`status ${log.status}`}>{log.status}</span></td><td className="muted" style={{ maxWidth: 360 }}>{log.lastError ?? "—"}</td></tr>) : <tr><td colSpan={5}><div className="empty">Aún no hay ejecuciones registradas.</div></td></tr>}</tbody></table></div>
  </>;
}

function AutomationFields({ defaults }: { defaults?: { name: string; event: keyof typeof eventLabels; channel: "EMAIL" | "WHATSAPP"; offsetMinutes: number; subject: string; text: string } }) {
  return <>
    <div className="field"><label>Nombre *</label><input className="input" name="name" defaultValue={defaults?.name} placeholder="Ej. Recordatorio 24 horas antes" required /></div>
    <div className="setup-edit-form"><div className="field"><label>Evento</label><select className="select" name="event" defaultValue={defaults?.event ?? "BOOKING_REMINDER"}><option value="BOOKING_CREATED">Reserva creada</option><option value="BOOKING_REMINDER">Recordatorio antes del turno</option><option value="BOOKING_CANCELLED">Reserva cancelada</option></select></div><div className="field"><label>Canal</label><select className="select" name="channel" defaultValue={defaults?.channel ?? "EMAIL"}><option value="EMAIL">Email</option><option value="WHATSAPP">WhatsApp</option></select></div></div>
    <div className="field"><label>Desplazamiento en minutos</label><input className="input" type="number" name="offsetMinutes" min="0" max="43200" defaultValue={defaults?.offsetMinutes ?? 1440} required /><small className="muted">En recordatorios significa minutos antes; en creación/cancelación, minutos después.</small></div>
    <div className="field"><label>Asunto de email</label><input className="input" name="subject" defaultValue={defaults?.subject ?? "Recordatorio de {{servicio}}"} /></div>
    <div className="field"><label>Mensaje *</label><textarea className="input" name="text" rows={5} defaultValue={defaults?.text ?? "Hola {{cliente}}. Te recordamos tu reserva de {{servicio}} en {{negocio}} para el {{fecha}} a las {{hora}} en {{sede}}."} required /></div>
    <small className="muted">Variables: {"{{cliente}} {{servicio}} {{negocio}} {{fecha}} {{hora}} {{sede}} {{profesional}}"}</small>
  </>;
}
