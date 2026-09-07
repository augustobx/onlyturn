import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  Circle,
  Palette,
  Settings2,
  Store,
  Users,
  Wrench,
} from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { getUniversalServiceCatalog } from "@/lib/service-catalog";
import { getAvailabilityManagementData } from "@/lib/availability-management";
import { resolvePublicTheme, type PublicBranding } from "@/lib/public-themes";
import { createLocationAction, createProfessionalAction, createResourceAction } from "@/app/actions/catalog";
import { createWeeklyAvailabilityAction } from "@/app/actions/availability-management";

export default async function SetupCenterPage() {
  const { membership, tenant } = await requireTenantSession();
  const [[locations, services, professionals, resources], [rules]] = await Promise.all([
    getUniversalServiceCatalog(membership.tenantId),
    getAvailabilityManagementData(membership.tenantId),
  ]);

  const branding = tenant.branding as PublicBranding;
  const settings = tenant.settings as { intervalMinutes?: number; minimumNoticeMinutes?: number; maximumAdvanceDays?: number; cancellationHours?: number };
  const theme = resolvePublicTheme(branding);
  const hasBusinessHours = rules.some((rule) => rule.ownerType === "TENANT");
  const readySteps = [Boolean(locations.length), Boolean(services.length), hasBusinessHours, Boolean(branding.themeId || branding.primaryColor)];
  const completion = Math.round((readySteps.filter(Boolean).length / readySteps.length) * 100);

  return <>
    <div className="page-title setup-center-title">
      <span className="eyebrow">Configuración guiada</span>
      <h1>Configurá tu negocio desde un solo lugar</h1>
      <p className="muted">La operación avanzada sigue disponible, pero las decisiones de configuración están agrupadas acá en el orden correcto.</p>
    </div>

    <section className="setup-overview card">
      <div><span className="eyebrow">Estado de puesta a punto</span><strong>{completion}% listo</strong><p className="muted">{completion === 100 ? "La base de la agenda está configurada. Podés seguir afinando reglas e integraciones." : "Completá los puntos pendientes para dejar la reserva pública operativa."}</p></div>
      <div className="setup-progress"><i style={{ width: `${completion}%` }} /></div>
      <div className="setup-checks">
        <SetupCheck done={locations.length > 0} label="Sede o punto de atención" />
        <SetupCheck done={services.length > 0} label="Al menos un servicio" />
        <SetupCheck done={hasBusinessHours} label="Horario general" />
        <SetupCheck done={Boolean(branding.themeId || branding.primaryColor)} label="Apariencia PWA" />
      </div>
    </section>

    <section className="setup-path-grid">
      <SetupCard number="1" icon={Settings2} title="Negocio" description="Datos generales, reglas base, clientes, formularios y bloqueos." status={`${settings.intervalMinutes ?? 30} min por intervalo`} href="/configuracion" />
      <SetupCard number="2" icon={Building2} title="Sedes y equipo" description="Dónde atendés, quién atiende y qué recursos se pueden reservar." status={`${locations.length} sedes · ${professionals.length} profesionales · ${resources.length} recursos`} href="/estructura" />
      <SetupCard number="3" icon={Store} title="Servicios" description="Qué puede reservar el cliente, duración, precio, capacidad y asignaciones." status={`${services.length} tipos de reserva`} href="/servicios" />
      <SetupCard number="4" icon={CalendarClock} title="Horarios" description="Jornada general y reglas por sede, profesional o recurso." status={`${rules.length} bloques activos`} href="/disponibilidad" />
      <SetupCard number="5" icon={BadgeCheck} title="Reglas" description="Anticipación, cancelación, reprogramación y políticas específicas por servicio." status={`${settings.cancellationHours ?? 0} h cancelación general`} href="/politicas" />
      <SetupCard number="6" icon={Palette} title="Apariencia" description="Tema, colores y experiencia visual de la PWA pública." status={theme.name} href="/apariencia" />
      <SetupCard number="7" icon={Wrench} title="Integraciones" description="Mercado Pago, dominio, calendarios y automatizaciones." status="Conexiones externas" href="/configuracion?tab=payments" />
    </section>

    <div className="platform-toolbar setup-toolbar"><div><h2>Acciones rápidas</h2><span className="muted">Las tareas más comunes de alta sin salir del configurador.</span></div></div>

    <section className="setup-quick-grid">
      <form action={createLocationAction} className="card setup-quick-card">
        <div className="setup-quick-head"><Building2 size={18} /><div><strong>Nueva sede</strong><small>Local, consultorio, cancha o punto de atención.</small></div></div>
        <input className="input" name="name" placeholder="Nombre de la sede" required />
        <input className="input" name="address" placeholder="Dirección (opcional)" />
        <button className="button secondary">Agregar sede</button>
      </form>

      <form action={createProfessionalAction} className="card setup-quick-card">
        <div className="setup-quick-head"><Users size={18} /><div><strong>Nuevo profesional</strong><small>Persona que puede ser asignada a reservas.</small></div></div>
        <input className="input" name="name" placeholder="Nombre del profesional" required />
        <select className="select" name="locationId" defaultValue=""><option value="">Sin sede fija</option>{locations.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select>
        <input name="color" type="hidden" value="#2563eb" />
        <button className="button secondary">Agregar profesional</button>
      </form>

      <form action={createResourceAction} className="card setup-quick-card">
        <div className="setup-quick-head"><Wrench size={18} /><div><strong>Nuevo recurso</strong><small>Sala, box, cancha, equipo, vehículo o activo.</small></div></div>
        <input className="input" name="name" placeholder="Nombre del recurso" required />
        <div className="grid" style={{ gridTemplateColumns: "1fr 100px", gap: 8 }}><input className="input" name="type" placeholder="Tipo" /><input className="input" name="capacity" type="number" min="1" defaultValue="1" aria-label="Capacidad" /></div>
        <select className="select" name="locationId" defaultValue=""><option value="">Sin sede fija</option>{locations.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select>
        <input name="color" type="hidden" value="#10b981" />
        <button className="button secondary">Agregar recurso</button>
      </form>

      <form action={createWeeklyAvailabilityAction} className="card setup-quick-card setup-hours-card">
        <div className="setup-quick-head"><CalendarClock size={18} /><div><strong>Horario general</strong><small>Base semanal del negocio. Después podés afinar por persona o recurso.</small></div></div>
        <input type="hidden" name="target" value="TENANT:" />
        {[1, 2, 3, 4, 5].map((day) => <input type="hidden" name="weekdays" value={day} key={day} />)}
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}><div className="field"><label>Desde</label><input className="input" name="startTime" type="time" defaultValue="09:00" required /></div><div className="field"><label>Hasta</label><input className="input" name="endTime" type="time" defaultValue="18:00" required /></div></div>
        <button className="button secondary">Agregar lunes a viernes</button>
        <Link href="/disponibilidad" className="setup-inline-link">Necesito días u horarios distintos <ArrowRight size={13} /></Link>
      </form>
    </section>

    <section className="card setup-advanced-card">
      <div><span className="eyebrow">Después de la puesta a punto</span><h2>Funciones avanzadas siguen intactas</h2><p className="muted">Clases, recurrencias, lista de espera, extras, paquetes, automatizaciones, calendarios y reportes quedan en “Más herramientas” porque son operación o expansión, no configuración inicial.</p></div>
      <Link className="button secondary" href="/agenda">Ir a la agenda <ArrowRight size={15} /></Link>
    </section>
  </>;
}

function SetupCheck({ done, label }: { done: boolean; label: string }) {
  return <span className={done ? "done" : undefined}>{done ? <CheckCircle2 size={15} /> : <Circle size={15} />}{label}</span>;
}

function SetupCard({ number, icon: Icon, title, description, status, href }: { number: string; icon: React.ComponentType<{ size?: number }>; title: string; description: string; status: string; href: string }) {
  return <Link href={href} className="setup-path-card card"><span className="setup-path-number">{number}</span><span className="setup-path-icon"><Icon size={18} /></span><div><strong>{title}</strong><p>{description}</p><small>{status}</small></div><ArrowRight className="setup-path-arrow" size={16} /></Link>;
}
