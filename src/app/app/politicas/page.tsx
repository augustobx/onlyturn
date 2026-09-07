import { Clock3, RotateCcw, ShieldCheck } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { getServicePolicies, type ServiceBookingPolicy } from "@/lib/service-policies";
import { updateServicePolicyAction } from "@/app/actions/service-policies";

const bookingTypeLabels = {
  APPOINTMENT: "Turno",
  CLASS: "Clase",
  EVENT: "Evento",
  RESOURCE: "Recurso",
} as const;

export default async function ServicePoliciesPage() {
  const { membership, tenant } = await requireTenantSession();
  const services = await getServicePolicies(membership.tenantId);
  const settings = tenant.settings as {
    intervalMinutes?: number;
    minimumNoticeMinutes?: number;
    maximumAdvanceDays?: number;
    cancellationHours?: number;
  };

  return (
    <>
      <div className="page-title">
        <span className="eyebrow">Reglas comerciales</span>
        <h1>Políticas por servicio</h1>
        <p className="muted">
          Cada servicio puede heredar las reglas generales del negocio o tener sus propios intervalos, anticipación y ventanas de cancelación/reprogramación.
        </p>
      </div>

      <section className="grid stats" style={{ marginBottom: 18 }}>
        <div className="card stat"><span className="muted">Intervalo general</span><strong>{settings.intervalMinutes ?? 30} min</strong><small className="muted">si el servicio no lo reemplaza</small></div>
        <div className="card stat"><span className="muted">Anticipación general</span><strong>{settings.minimumNoticeMinutes ?? 120} min</strong><small className="muted">mínimo antes de reservar</small></div>
        <div className="card stat"><span className="muted">Ventana general</span><strong>{settings.maximumAdvanceDays ?? 60} días</strong><small className="muted">máximo hacia adelante</small></div>
        <div className="card stat"><span className="muted">Cancelación general</span><strong>{settings.cancellationHours ?? 0} h</strong><small className="muted">si no hay regla específica</small></div>
      </section>

      <div className="grid" style={{ gap: 14 }}>
        {services.map((service) => {
          const policy = (service.bookingPolicy ?? {}) as ServiceBookingPolicy;
          return (
            <details className="card" key={service.id}>
              <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <strong>{service.name}</strong>
                    <span className="pill">{bookingTypeLabels[service.bookingType]}</span>
                    {Object.keys(policy).length ? <span className="status ACTIVE">Personalizada</span> : <span className="muted" style={{ fontSize: 11 }}>Hereda reglas generales</span>}
                  </div>
                  <small className="muted">{service.category ?? "General"}</small>
                </div>
                <Clock3 size={18} />
              </summary>

              <form action={updateServicePolicyAction} style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
                <input type="hidden" name="serviceId" value={service.id} />
                <div className="grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
                  <PolicyField label="Intervalo entre inicios" name="intervalMinutes" value={policy.intervalMinutes} suffix="min" placeholder={settings.intervalMinutes ?? 30} />
                  <PolicyField label="Anticipación mínima" name="minimumNoticeMinutes" value={policy.minimumNoticeMinutes} suffix="min" placeholder={settings.minimumNoticeMinutes ?? 120} />
                  <PolicyField label="Reserva máxima a futuro" name="maximumAdvanceDays" value={policy.maximumAdvanceDays} suffix="días" placeholder={settings.maximumAdvanceDays ?? 60} />
                  <PolicyField label="Cancelar hasta" name="cancellationHours" value={policy.cancellationHours} suffix="h antes" placeholder={settings.cancellationHours ?? 0} />
                  <PolicyField label="Reprogramar hasta" name="rescheduleHours" value={policy.rescheduleHours} suffix="h antes" placeholder={settings.cancellationHours ?? 0} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
                  <span className="muted" style={{ fontSize: 11 }}><RotateCcw size={13} style={{ verticalAlign: "-2px" }} /> Dejá un campo vacío para heredar la configuración general.</span>
                  <button className="button"><ShieldCheck size={15} /> Guardar política</button>
                </div>
              </form>
            </details>
          );
        })}
        {!services.length && <div className="card empty">Creá al menos un servicio para configurar políticas específicas.</div>}
      </div>
    </>
  );
}

function PolicyField({ label, name, value, suffix, placeholder }: { label: string; name: string; value?: number; suffix: string; placeholder: number }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input className="input" name={name} type="number" min="0" defaultValue={value ?? ""} placeholder={String(placeholder)} />
        <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{suffix}</span>
      </div>
    </div>
  );
}
