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
        <span className="eyebrow">Paso 5 · Reglas de reserva</span>
        <h1>Políticas por servicio</h1>
        <p className="muted">
          Usá las reglas generales como base. Personalizá un servicio sólo cuando realmente necesite una condición diferente.
        </p>
      </div>

      <section className="grid stats policy-stats">
        <div className="card stat"><span className="muted">Intervalo general</span><strong>{settings.intervalMinutes ?? 30} min</strong><small className="muted">separación entre horarios ofrecidos</small></div>
        <div className="card stat"><span className="muted">Anticipación general</span><strong>{settings.minimumNoticeMinutes ?? 120} min</strong><small className="muted">mínimo antes de reservar</small></div>
        <div className="card stat"><span className="muted">Ventana general</span><strong>{settings.maximumAdvanceDays ?? 60} días</strong><small className="muted">máximo hacia adelante</small></div>
        <div className="card stat"><span className="muted">Cancelación general</span><strong>{settings.cancellationHours ?? 0} h</strong><small className="muted">anticipación para cancelar</small></div>
      </section>

      <div className="card policy-guidance">
        <ShieldCheck size={20} />
        <div><strong>La mayoría de los negocios no necesita tocar todo.</strong><p className="muted">Abrí únicamente el servicio que quieras diferenciar. Si un campo queda vacío, OnlyTurn conserva automáticamente la regla general.</p></div>
      </div>

      <div className="grid policy-service-list">
        {services.map((service) => {
          const policy = (service.bookingPolicy ?? {}) as ServiceBookingPolicy;
          const customized = Object.keys(policy).length > 0;
          return (
            <details className="card policy-service-card" key={service.id}>
              <summary className="policy-service-summary">
                <div>
                  <div className="policy-service-name">
                    <strong>{service.name}</strong>
                    <span className="pill">{bookingTypeLabels[service.bookingType]}</span>
                    {customized ? <span className="status ACTIVE">Reglas propias</span> : <span className="policy-inherited">Usa reglas generales</span>}
                  </div>
                  <small className="muted">{service.category ?? "General"}</small>
                </div>
                <span className="policy-edit-cue"><Clock3 size={17} /> Configurar</span>
              </summary>

              <form action={updateServicePolicyAction} className="policy-form">
                <input type="hidden" name="serviceId" value={service.id} />
                <div className="policy-fields-grid">
                  <PolicyField label="Intervalo entre inicios" help="Cada cuánto aparece una opción de horario." name="intervalMinutes" value={policy.intervalMinutes} suffix="min" placeholder={settings.intervalMinutes ?? 30} />
                  <PolicyField label="Anticipación mínima" help="Cuánto tiempo antes debe reservar el cliente." name="minimumNoticeMinutes" value={policy.minimumNoticeMinutes} suffix="min" placeholder={settings.minimumNoticeMinutes ?? 120} />
                  <PolicyField label="Reserva máxima a futuro" help="Hasta cuántos días hacia adelante se puede elegir." name="maximumAdvanceDays" value={policy.maximumAdvanceDays} suffix="días" placeholder={settings.maximumAdvanceDays ?? 60} />
                  <PolicyField label="Cancelar hasta" help="Límite para cancelar desde Mi cuenta." name="cancellationHours" value={policy.cancellationHours} suffix="h antes" placeholder={settings.cancellationHours ?? 0} />
                  <PolicyField label="Reprogramar hasta" help="Límite para mover una reserva existente." name="rescheduleHours" value={policy.rescheduleHours} suffix="h antes" placeholder={settings.cancellationHours ?? 0} />
                </div>
                <div className="policy-form-footer">
                  <span className="muted"><RotateCcw size={14} /> Campo vacío = hereda el valor general.</span>
                  <button className="button"><ShieldCheck size={15} /> Guardar reglas</button>
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

function PolicyField({ label, help, name, value, suffix, placeholder }: { label: string; help: string; name: string; value?: number; suffix: string; placeholder: number }) {
  return (
    <div className="policy-field">
      <div className="policy-field-copy"><label htmlFor={`${name}-${label}`}>{label}</label><small>{help}</small></div>
      <div className="policy-input-wrap">
        <input id={`${name}-${label}`} className="input" name={name} type="number" min="0" defaultValue={value ?? ""} placeholder={String(placeholder)} />
        <span>{suffix}</span>
      </div>
      <small className="policy-default">General: {placeholder} {suffix}</small>
    </div>
  );
}
