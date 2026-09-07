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

export default async function SuperAdminPlansPage() {
  await requireSuperAdmin();
  const plans = await platformDb.plan.findMany({ orderBy: [{ priceCents: "asc" }, { code: "asc" }] });

  return <>
    <div className="page-title">
      <span className="eyebrow">NanoLabs · Comercial</span>
      <h1>Planes SaaS</h1>
      <p className="muted">Editá precios, límites y capacidades. El código técnico de cada plan permanece estable.</p>
    </div>

    <div className="grid" style={{gap:18}}>
      {plans.map(plan=>{
        const features=(plan.features ?? {}) as Features;
        return <form action={updatePlanAction} className="card" key={plan.id}>
          <input type="hidden" name="planId" value={plan.id}/>
          <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"start",marginBottom:14}}>
            <div><span className="eyebrow">{plan.code}</span><h2 style={{margin:"4px 0 0"}}>{plan.name}</h2></div>
            <label style={{display:"flex",gap:8,alignItems:"center"}}><input name="isActive" type="checkbox" defaultChecked={plan.isActive}/> Activo</label>
          </div>

          <div className="grid" style={{gridTemplateColumns:"2fr 1fr",gap:12}}>
            <div className="field"><label>Nombre</label><input className="input" name="name" defaultValue={plan.name} required/></div>
            <div className="field"><label>Precio mensual (ARS)</label><input className="input" name="pricePesos" type="number" min="0" step="1" defaultValue={plan.priceCents/100} required/></div>
          </div>
          <div className="field"><label>Descripción</label><textarea className="input" name="description" rows={2} defaultValue={plan.description ?? ""}/></div>

          <div className="grid" style={{gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12}}>
            <div className="field"><label>Sedes</label><input className="input" name="maxLocations" type="number" min="1" defaultValue={features.maxLocations ?? 1} required/></div>
            <div className="field"><label>Profesionales</label><input className="input" name="maxStaff" type="number" min="1" defaultValue={features.maxStaff ?? 1} required/></div>
            <div className="field"><label>Recursos</label><input className="input" name="maxResources" type="number" min="1" defaultValue={features.maxResources ?? 1} required/></div>
            <div className="field"><label>Turnos / mes</label><input className="input" name="maxBookings" type="number" min="1" defaultValue={features.maxBookings ?? 100} required/></div>
          </div>

          <div className="grid" style={{gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10,margin:"8px 0 18px"}}>
            <label><input name="deposits" type="checkbox" defaultChecked={Boolean(features.deposits)}/> Señas / pagos online</label>
            <label><input name="whatsappNotifications" type="checkbox" defaultChecked={Boolean(features.whatsappNotifications)}/> WhatsApp</label>
            <label><input name="advancedReports" type="checkbox" defaultChecked={Boolean(features.advancedReports)}/> Reportes avanzados</label>
            <label><input name="waitlist" type="checkbox" defaultChecked={Boolean(features.waitlist)}/> Lista de espera</label>
            <label><input name="recurringBookings" type="checkbox" defaultChecked={Boolean(features.recurringBookings)}/> Turnos recurrentes</label>
            <label><input name="customDomain" type="checkbox" defaultChecked={Boolean(features.customDomain)}/> Dominio personalizado</label>
          </div>

          <button className="button">Guardar plan</button>
        </form>;
      })}
    </div>
  </>;
}
