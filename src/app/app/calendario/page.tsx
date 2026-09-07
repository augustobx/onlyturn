import { CalendarDays, Copy, ExternalLink } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { calendarFeedToken } from "@/lib/calendar-feed";
import { platformDb } from "@/lib/db";
import { tenantPublicUrl } from "@/lib/hostnames";

export default async function CalendarPage() {
  const { membership, tenant } = await requireTenantSession();
  const professionals = await platformDb.professional.findMany({ where: { tenantId: membership.tenantId, isActive: true }, orderBy: { name: "asc" } });
  const base = tenantPublicUrl(tenant.slug);
  const allFeed = `${base}/api/calendar/${tenant.id}/feed?token=${calendarFeedToken(tenant.id)}`;

  return (
    <>
      <div className="page-title"><span className="eyebrow">Integraciones de agenda</span><h1>Calendarios externos</h1><p className="muted">Suscribí la agenda de OnlyTurn en Google Calendar, Outlook o Apple Calendar mediante feeds iCal privados y actualizables.</p></div>
      <section className="card">
        <div className="section-head"><h2><CalendarDays size={18} /> Agenda completa</h2><span className="status ACTIVE">Privada</span></div>
        <p className="muted">Este enlace contiene citas y sesiones del negocio. Tratálo como una contraseña: quien tenga la URL puede leer el calendario.</p>
        <div className="field"><label>URL de suscripción</label><input className="input" readOnly value={allFeed} /></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><a className="button" href={allFeed}><ExternalLink size={14} /> Abrir feed</a><span className="button ghost" aria-hidden="true"><Copy size={14} /> Copiar desde el campo</span></div>
      </section>

      <div className="platform-toolbar"><h2>Calendarios por profesional</h2><span className="muted" style={{ fontSize: 12 }}>Feeds separados para compartir sólo la agenda de cada integrante</span></div>
      <div className="grid" style={{ gap: 10 }}>
        {professionals.map((professional) => {
          const token = calendarFeedToken(tenant.id, professional.id);
          const url = `${base}/api/calendar/${tenant.id}/feed?professionalId=${professional.id}&token=${token}`;
          return <div className="card" key={professional.id}><div className="section-head"><h2>{professional.name}</h2></div><input className="input" readOnly value={url} /><a className="button ghost" href={url} style={{ marginTop: 10 }}><ExternalLink size={14} /> Abrir feed</a></div>;
        })}
        {!professionals.length && <div className="card empty">No hay profesionales activos.</div>}
      </div>

      <section className="card" style={{ marginTop: 18 }}><h2>Cómo conectarlo</h2><p className="muted">En Google Calendar usá “Desde URL”; en Outlook, “Suscribirse desde web”; en Apple Calendar, “Nueva suscripción de calendario”. Pegá el feed correspondiente. Las actualizaciones dependen de la frecuencia de refresco del proveedor externo.</p></section>
    </>
  );
}
