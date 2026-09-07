"use client";

import {
  BadgeCheck,
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  CalendarSync,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Repeat2,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/actions/auth";

type ModuleHelp = { title: string; purpose: string; steps: string[]; tip?: string };
type NavItem = { href: string; internal: string; label: string; icon: React.ComponentType<{ size?: number }>; help: ModuleHelp };

const item = (href: string, internal: string, label: string, icon: NavItem["icon"], purpose: string, steps: string[], tip?: string): NavItem => ({ href, internal, label, icon, help: { title: label, purpose, steps, tip } });

const tenantItems = {
  dashboard: item("/dashboard", "/app", "Resumen", LayoutDashboard, "Tablero ejecutivo del negocio.", ["Revisá actividad y reservas.", "Detectá cancelaciones y no-shows.", "Entrá al módulo que necesite atención."]),
  agenda: item("/agenda", "/app/agenda", "Agenda", CalendarDays, "Centraliza los turnos y reservas operativas.", ["Filtrá por fecha o asignación.", "Creá turnos manuales.", "Confirmá, reprogramá o cerrá reservas."]),
  clientes: item("/clientes", "/app/clientes", "Clientes / CRM", Users, "Ficha, historial, saldo y comportamiento de clientes.", ["Buscá al cliente.", "Abrí su ficha.", "Gestioná historial, saldo y datos."]),
  setup: item("/configurar", "/app/configurar", "Configurar negocio", Settings2, "Centro único para dejar lista la agenda sin saltar entre módulos.", ["Completá el checklist inicial.", "Configurá sedes, equipo, servicios y horarios.", "Después afiná reglas, apariencia e integraciones."], "Usá este módulo para toda la puesta a punto. Las herramientas avanzadas quedan separadas de la configuración."),
  sesiones: item("/sesiones", "/app/sesiones", "Clases y eventos", CalendarRange, "Gestiona sesiones con cupos y varios asistentes.", ["Creá la sesión.", "Definí cupo y asignaciones.", "Controlá inscriptos."]),
  recurrencias: item("/recurrencias", "/app/recurrencias", "Recurrencias", Repeat2, "Automatiza series repetitivas de turnos o sesiones.", ["Elegí el servicio.", "Definí frecuencia.", "Revisá y gestioná la serie."]),
  waitlist: item("/lista-espera", "/app/lista-espera", "Lista de espera", ListChecks, "Captura demanda cuando no hay lugar disponible.", ["Revisá solicitudes.", "Gestioná huecos liberados.", "Marcá el resultado de cada solicitud."]),
  extras: item("/extras", "/app/extras", "Extras", Sparkles, "Adicionales que suman precio o tiempo a un servicio.", ["Elegí servicio base.", "Creá el adicional.", "Publicalo para reserva online."]),
  paquetes: item("/paquetes", "/app/paquetes", "Paquetes y membresías", BadgeCheck, "Bonos y pases con usos y vencimiento.", ["Creá el paquete.", "Asignalo a clientes.", "Controlá consumos y vigencia."]),
  automatizaciones: item("/automatizaciones", "/app/automatizaciones", "Automatizaciones", BellRing, "Mensajes automáticos por eventos de agenda.", ["Elegí el disparador.", "Configurá canal y mensaje.", "Activá la regla."]),
  calendario: item("/calendario", "/app/calendario", "Calendarios", CalendarSync, "Feeds privados para Google, Outlook o Apple Calendar.", ["Copiá el feed.", "Suscribilo en el calendario externo.", "Mantené privado el enlace."]),
  reportes: item("/reportes", "/app/reportes", "Reportes", BarChart3, "Métricas de reservas, clientes, ocupación e ingresos.", ["Elegí período.", "Compará indicadores.", "Usá tendencias para tomar decisiones."]),
  estructura: item("/estructura", "/app/estructura", "Sedes y equipo", Users, "Centraliza ubicaciones, profesionales y recursos del negocio.", ["Creá las sedes necesarias.", "Agregá profesionales si el rubro los usa.", "Cargá recursos reservables como salas, canchas o equipos."], "Después vinculá estos elementos a cada servicio desde el paso Servicios."),
  servicios: item("/servicios", "/app/catalogo", "Servicios", BriefcaseBusiness, "Catálogo y asignaciones del motor de reservas.", ["Definí qué se reserva.", "Asigná sede, profesional o recurso.", "Publicá el servicio."]),
  disponibilidad: item("/disponibilidad", "/app/disponibilidad", "Horarios", CalendarDays, "Disponibilidad semanal por negocio, sede, profesional o recurso.", ["Definí jornada general.", "Agregá reglas específicas.", "Revisá intersecciones."]),
  politicas: item("/politicas", "/app/politicas", "Reglas", ShieldCheck, "Políticas específicas por servicio.", ["Elegí servicio.", "Definí anticipación y cancelación.", "Guardá la política."]),
  apariencia: item("/apariencia", "/app/apariencia", "Apariencia PWA", Sparkles, "Tema y colores de la experiencia pública.", ["Elegí tema.", "Ajustá colores.", "Guardá y revisá la PWA."]),
  configuracion: item("/configuracion", "/app/configuracion", "Configuración", Settings2, "Datos generales, formularios, pagos, dominios y opciones avanzadas.", ["Elegí la sección.", "Modificá sólo lo necesario.", "Guardá y verificá el resultado."]),
};

const primaryTenantLinks = [tenantItems.dashboard, tenantItems.agenda, tenantItems.clientes, tenantItems.setup];
const advancedTenantLinks = [tenantItems.sesiones, tenantItems.recurrencias, tenantItems.waitlist, tenantItems.extras, tenantItems.paquetes, tenantItems.automatizaciones, tenantItems.calendario, tenantItems.reportes];
const hiddenSetupItems = [tenantItems.estructura, tenantItems.servicios, tenantItems.disponibilidad, tenantItems.politicas, tenantItems.apariencia, tenantItems.configuracion];

const platformLinks: NavItem[] = [
  item("/superadmin", "/superadmin", "Resumen", ShieldCheck, "Vista global de OnlyTurn para NanoLabs.", ["Revisá tenants.", "Controlá membresías.", "Entrá al detalle necesario."]),
  item("/superadmin/tenants", "/superadmin/tenants", "Tenants", Users, "Administra los negocios que usan OnlyTurn.", ["Buscá o creá un tenant.", "Revisá estado y plan.", "Renová o suspendé cuando corresponda."]),
  item("/superadmin/planes", "/superadmin/planes", "Planes", BriefcaseBusiness, "Define planes, límites y capacidades SaaS.", ["Revisá oferta vigente.", "Ajustá límites.", "Guardá cambios comerciales."]),
];

export function AppShell({ children, tenantName, userName, superAdmin = false }: { children: React.ReactNode; tenantName: string; userName: string; superAdmin?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const isActive = (href: string, internal: string) => {
    if (superAdmin && href === "/superadmin") return pathname === "/superadmin";
    const publicMatch = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    const internalMatch = internal === "/app" ? pathname === internal : pathname === internal || pathname.startsWith(`${internal}/`);
    return publicMatch || internalMatch;
  };

  const allItems = superAdmin ? platformLinks : [...primaryTenantLinks, ...advancedTenantLinks, ...hiddenSetupItems];
  const currentItem = allItems.find((navItem) => isActive(navItem.href, navItem.internal)) ?? allItems[0];
  const renderLink = ({ href, internal, label, icon: Icon }: NavItem) => <Link className={isActive(href, internal) ? "active" : undefined} key={href} href={href} onClick={() => setOpen(false)}><Icon size={17} /><span>{label}</span></Link>;

  return <div className={`shell nanolabs-shell ${superAdmin ? "platform-shell" : "tenant-shell"}`}>
    {open && <button className="sidebar-backdrop" aria-label="Cerrar menú" onClick={() => setOpen(false)} />}
    {helpOpen && <button className="module-help-backdrop" aria-label="Cerrar ayuda" onClick={() => setHelpOpen(false)} />}

    <aside className={`sidebar ${open ? "is-open" : ""}`}>
      <div className="brand brand-onlyturn"><span className="brand-mark" aria-hidden="true"><CalendarCheck2 size={18} /></span><span className="brand-copy"><strong>OnlyTurn</strong><small>by NanoLabs</small></span><button className="mobile-close" aria-label="Cerrar menú" onClick={() => setOpen(false)}><X size={19} /></button></div>
      <div className="sidebar-context"><span>{superAdmin ? "Administración de plataforma" : "Espacio de trabajo"}</span><strong>{tenantName}</strong></div>

      <nav className="nav" aria-label="Navegación principal">
        {superAdmin ? <div className="nav-primary">{platformLinks.map(renderLink)}</div> : <>
          <div className="nav-primary">{primaryTenantLinks.map(renderLink)}</div>
          <div className="nav-divider" />
          <details className="nav-group" open={advancedTenantLinks.some((navItem) => isActive(navItem.href, navItem.internal)) || undefined}>
            <summary><span><strong>Más herramientas</strong><small>Funciones avanzadas y análisis</small></span><ChevronDown size={15} /></summary>
            <div className="nav-group-links">{advancedTenantLinks.map(renderLink)}</div>
          </details>
        </>}
      </nav>

      <div className="sidebar-foot"><div className="user-card"><span className="avatar">{userName.trim().charAt(0).toUpperCase() || "N"}</span><div><strong>{userName}</strong><span>{superAdmin ? "SuperAdmin NanoLabs" : tenantName}</span></div></div><form action={logoutAction}><button className="button ghost logout-button" type="submit"><LogOut size={16} /> Salir</button></form></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="topbar-title"><button className="mobile-menu" aria-label="Abrir menú" onClick={() => setOpen(true)}><Menu size={20} /></button><div><span>{superAdmin ? "NanoLabs" : currentItem?.label ?? "OnlyTurn"}</span><strong>{tenantName}</strong></div></div><div className="topbar-actions">{currentItem && <button className="module-help-trigger" type="button" onClick={() => setHelpOpen(true)} aria-label={`Ayuda de ${currentItem.label}`}><CircleHelp size={17} /><span>Ayuda</span></button>}<span className="system-status"><i /> Operativo</span></div></header>
      <div className="content">{children}</div>
    </main>

    {currentItem && <aside className={`module-help-panel ${helpOpen ? "is-open" : ""}`} aria-hidden={!helpOpen}><div className="module-help-head"><div className="module-help-icon"><CircleHelp size={19} /></div><div><span>Ayuda del módulo</span><h2>{currentItem.help.title}</h2></div><button type="button" aria-label="Cerrar ayuda" onClick={() => setHelpOpen(false)}><X size={18} /></button></div><div className="module-help-body"><section><span className="help-kicker">¿Para qué sirve?</span><p>{currentItem.help.purpose}</p></section><section><span className="help-kicker">Cómo usarlo</span><ol>{currentItem.help.steps.map((step) => <li key={step}>{step}</li>)}</ol></section>{currentItem.help.tip && <div className="help-tip"><strong>Consejo</strong><p>{currentItem.help.tip}</p></div>}</div></aside>}
  </div>;
}
