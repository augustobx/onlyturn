import { Layers3, Save } from "lucide-react";
import { updatePlanAction } from "@/app/actions/platform-management";
import { requireSuperAdmin } from "@/lib/auth";
import { platformDb } from "@/lib/db";

type Features = {
  maxLocations?: number;
  maxStaff?: number;
  maxResources?: number;
  maxBookings?: number;
  whatsappNotifications?: boolean;
  advancedReports?: boolean;
  customDomain?: boolean;
  waitlist?: boolean;
  deposits?: boolean;
  recurringBookings?: boolean;
};

const capabilities: Array<{ key: keyof Features; label: string }> = [
  { key: "deposits", label: "Señas / pagos online" },
  { key: "whatsappNotifications", label: "Notificaciones WhatsApp" },
  { key: "advancedReports", label: "Reportes avanzados" },
  { key: "waitlist", label: "Lista de espera" },
  { key: "recurringBookings", label: "Turnos recurrentes" },
  { key: "customDomain", label: "Dominio personalizado" },
];

export default async function SuperAdminPlansPage() {
  await requireSuperAdmin();
  const plans = await platformDb.plan.findMany({
    orderBy: [{ priceCents: "asc" }, { code: "asc" }],
    include: { _count: { select: { subscriptions: true } } },
  });

  return (
    <div className="sa-stack">
      <div className="sa-page-head">
        <div>
          <h1><Layers3 size={23} /> Planes SaaS</h1>
          <p>Configuración comercial, límites y capacidades incluidas en cada plan de OnlyTurn.</p>
        </div>
      </div>

      <section className="sa-plans-grid">
        {plans.map((plan) => {
          const features = (plan.features ?? {}) as Features;
          return (
            <form action={updatePlanAction} className="sa-plan-editor" key={plan.id}>
              <input type="hidden" name="planId" value={plan.id} />

              <div className="sa-plan-editor-head">
                <div>
                  <span className="sa-code-badge">{plan.code}</span>
                  <small>{plan._count.subscriptions} suscripción(es) asociadas</small>
                </div>
                <label className="sa-check"><input name="isActive" type="checkbox" defaultChecked={plan.isActive} /> Activo</label>
              </div>

              <div className="sa-field"><label className="sa-label">Nombre</label><input className="sa-input" name="name" defaultValue={plan.name} required /></div>
              <div className="sa-field"><label className="sa-label">Descripción</label><textarea className="sa-textarea" name="description" rows={3} defaultValue={plan.description ?? ""} /></div>
              <div className="sa-field"><label className="sa-label">Precio mensual (ARS)</label><input className="sa-input" name="pricePesos" type="number" min="0" step="1" defaultValue={plan.priceCents / 100} required /></div>

              <div className="sa-limits-grid">
                <div><label className="sa-label">Sedes</label><input className="sa-input" name="maxLocations" type="number" min="1" defaultValue={features.maxLocations ?? 1} required /></div>
                <div><label className="sa-label">Profesionales</label><input className="sa-input" name="maxStaff" type="number" min="1" defaultValue={features.maxStaff ?? 1} required /></div>
                <div><label className="sa-label">Recursos</label><input className="sa-input" name="maxResources" type="number" min="1" defaultValue={features.maxResources ?? 1} required /></div>
                <div><label className="sa-label">Turnos / mes</label><input className="sa-input" name="maxBookings" type="number" min="1" defaultValue={features.maxBookings ?? 100} required /></div>
              </div>

              <div className="sa-capabilities">
                {capabilities.map(({ key, label }) => (
                  <label className="sa-capability" key={key}>
                    <input name={key} type="checkbox" defaultChecked={Boolean(features[key])} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <button className="sa-save-button"><Save size={14} /> Guardar plan</button>
            </form>
          );
        })}
      </section>
    </div>
  );
}
