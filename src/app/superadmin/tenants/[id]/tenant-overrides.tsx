import { SlidersHorizontal } from "lucide-react";
import { updateTenantFeatureOverridesAction } from "@/app/actions/tenant-feature-overrides";
import { platformDb } from "@/lib/db";

type Features = {
  maxLocations?: number;
  maxStaff?: number;
  maxResources?: number;
  maxBookings?: number;
  deposits?: boolean;
  whatsappNotifications?: boolean;
  advancedReports?: boolean;
  waitlist?: boolean;
  recurringBookings?: boolean;
  customDomain?: boolean;
};

const booleanFeatures: Array<{ key: keyof Features; label: string }> = [
  { key: "deposits", label: "Señas / pagos online" },
  { key: "whatsappNotifications", label: "WhatsApp" },
  { key: "advancedReports", label: "Reportes avanzados" },
  { key: "waitlist", label: "Lista de espera" },
  { key: "recurringBookings", label: "Turnos recurrentes" },
  { key: "customDomain", label: "Dominio personalizado" },
];

const limits: Array<{ key: keyof Features; label: string }> = [
  { key: "maxLocations", label: "Sedes" },
  { key: "maxStaff", label: "Profesionales" },
  { key: "maxResources", label: "Recursos" },
  { key: "maxBookings", label: "Turnos / mes" },
];

export async function TenantOverrides({ tenantId, planFeatures }: { tenantId: string; planFeatures: Features }) {
  const overrides = await platformDb.tenantFeatureOverride.findMany({ where: { tenantId } });
  const byKey = new Map(overrides.map((override) => [override.key, override]));

  return (
    <section className="sa-panel">
      <div className="sa-panel-head">
        <div>
          <h2>Overrides del tenant</h2>
          <p>Excepciones específicas que pisan el plan sólo para este cliente.</p>
        </div>
        <SlidersHorizontal size={19} />
      </div>

      <form action={updateTenantFeatureOverridesAction}>
        <input type="hidden" name="tenantId" value={tenantId} />

        <h3 className="sa-form-section-title">Límites</h3>
        <div className="sa-limits-grid">
          {limits.map(({ key, label }) => {
            const override = byKey.get(key);
            const inherited = planFeatures[key] as number | undefined;
            return (
              <div key={key}>
                <label className="sa-label">{label} <span className="sa-muted">(plan: {inherited ?? "—"})</span></label>
                <input className="sa-input" name={`limit_${key}`} type="number" min="1" placeholder="Heredar plan" defaultValue={override?.limit ?? ""} />
              </div>
            );
          })}
        </div>

        <div className="sa-form-section">
          <h3 className="sa-form-section-title">Capacidades</h3>
          <div className="sa-capabilities">
            {booleanFeatures.map(({ key, label }) => {
              const override = byKey.get(key);
              const inherited = Boolean(planFeatures[key]);
              const value = override?.enabled === true ? "ON" : override?.enabled === false ? "OFF" : "INHERIT";
              return (
                <label className="sa-capability" key={key} style={{ display: "grid", gap: 5 }}>
                  <span>{label}</span>
                  <select className="sa-select" name={`boolean_${key}`} defaultValue={value}>
                    <option value="INHERIT">Heredar ({inherited ? "Activo" : "Inactivo"})</option>
                    <option value="ON">Forzar activo</option>
                    <option value="OFF">Forzar inactivo</option>
                  </select>
                </label>
              );
            })}
          </div>
        </div>

        <div className="sa-form-actions"><button className="sa-primary-button">Guardar overrides</button></div>
      </form>
    </section>
  );
}
