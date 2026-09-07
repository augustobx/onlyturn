"use client";

import {
  BadgeCheck,
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CalendarSync,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Palette,
  Repeat2,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/actions/auth";

type ModuleHelp = {
  title: string;
  purpose: string;
  steps: string[];
  tip?: string;
};

type NavItem = {
  href: string;
  internal: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  help: ModuleHelp;
};

type NavGroup = {
  label: string;
  description: string;
  items: NavItem[];
};

const tenantItems: Record<string, NavItem> = {
  dashboard: {
    href: "/dashboard", internal: "/app", label: "Resumen", icon: LayoutDashboard,
    help: { title: "Resumen", purpose: "Es el tablero ejecutivo del negocio. Te muestra cómo está funcionando la agenda sin tener que recorrer cada módulo.", steps: ["Revisá reservas y actividad del período.", "Detectá cancelaciones, no-shows y carga de trabajo.", "Usalo como punto de partida antes de entrar al detalle de Agenda, Clientes o Reportes."], tip: "Si un indicador llama la atención, abrí el módulo relacionado para investigar el detalle." },
  },
  agenda: {
    href: "/agenda", internal: "/app/agenda", label: "Agenda", icon: CalendarDays,
    help: { title: "Agenda", purpose: "Centraliza los turnos y reservas operativas del negocio por fecha, sede, servicio, profesional y recurso.", steps: ["Filtrá la agenda para encontrar rápidamente una reserva.", "Creá turnos manuales cuando la reserva no llega desde la web pública.", "Confirmá, reprogramá, completá, cancelá o marcá no-show según corresponda."], tip: "Las clases y eventos con cupos se administran desde su módulo específico para no romper la capacidad de la sesión." },
  },
  clientes: {
    href: "/clientes", internal: "/app/clientes", label: "Clientes / CRM", icon: Users,
    help: { title: "Clientes / CRM", purpose: "Reúne la ficha de cada cliente, historial de reservas, cuenta corriente, datos de contacto y comportamiento.", steps: ["Buscá al cliente por nombre o teléfono.", "Entrá a su ficha para ver historial, saldo y actividad.", "Registrá cargos, pagos, créditos o ajustes cuando corresponda."], tip: "La información permanece aislada dentro de este negocio; ningún tenant puede ver clientes de otro tenant." },
  },
  sesiones: {
    href: "/sesiones", internal: "/app/sesiones", label: "Clases y eventos", icon: CalendarRange,
    help: { title: "Clases y eventos", purpose: "Gestiona actividades con una sesión programada y varios asistentes: clases, cursos, talleres, eventos o grupos.", steps: ["Creá una sesión indicando servicio, sede, horario y cupo.", "Asigná profesional o recurso si la actividad lo requiere.", "Controlá inscriptos y disponibilidad sin sobre-vender lugares."], tip: "Para repetir una clase semanalmente, creá una recurrencia en lugar de cargar cada fecha a mano." },
  },
  recurrencias: {
    href: "/recurrencias", internal: "/app/recurrencias", label: "Recurrencias", icon: Repeat2,
    help: { title: "Recurrencias", purpose: "Automatiza series de turnos, clases o eventos que se repiten con una frecuencia definida.", steps: ["Elegí qué servicio se repite y desde qué fecha.", "Definí frecuencia y cantidad de ocurrencias.", "Revisá la serie generada y cancelá el futuro de la serie si deja de aplicar."], tip: "Usá recurrencias para clientes fijos, cursos, entrenamientos y cualquier agenda periódica." },
  },
  waitlist: {
    href: "/lista-espera", internal: "/app/lista-espera", label: "Lista de espera", icon: ListChecks,
    help: { title: "Lista de espera", purpose: "Captura demanda cuando no quedan horarios o cupos y evita perder clientes por falta de disponibilidad inmediata.", steps: ["Revisá quién espera por servicio, fecha o sesión.", "Priorizá y gestioná los pedidos cuando aparece un hueco.", "Marcá la entrada como reservada, vencida o cancelada según el resultado."], tip: "Activala sólo en los servicios donde realmente quieras captar demanda excedente." },
  },
  servicios: {
    href: "/servicios", internal: "/app/catalogo", label: "Servicios y equipo", icon: BriefcaseBusiness,
    help: { title: "Servicios y equipo", purpose: "Define qué puede reservarse y qué personas, sedes o recursos participan en cada servicio.", steps: ["Creá el tipo de reserva con duración, precio, categoría y sede.", "Indicá si requiere profesional, recurso o ninguno.", "Asigná los profesionales y recursos habilitados y publicalo online cuando esté listo."], tip: "Pensá cada elemento como un tipo de reserva universal: consulta, corte, cancha, sala, entrevista, clase o cualquier servicio con horario." },
  },
  extras: {
    href: "/extras", internal: "/app/extras", label: "Extras", icon: Sparkles,
    help: { title: "Extras", purpose: "Permite ofrecer adicionales sobre un servicio, sumando precio, duración o preparación cuando corresponde.", steps: ["Elegí el servicio base.", "Creá el extra con nombre, precio y tiempo adicional.", "El cliente podrá seleccionarlo durante la reserva y OnlyTurn recalculará horario y precio."], tip: "No uses un extra para crear otro servicio completo; usalo sólo cuando sea una ampliación opcional del servicio base." },
  },
  paquetes: {
    href: "/paquetes", internal: "/app/paquetes", label: "Paquetes y membresías", icon: BadgeCheck,
    help: { title: "Paquetes y membresías", purpose: "Gestiona bonos, packs y pases con una cantidad de usos y vencimiento opcional.", steps: ["Creá un paquete y definí qué servicios incluye.", "Asignalo al cliente después de una venta, promoción o cortesía.", "Cada reserva puede consumir usos automáticamente y el cliente ve el saldo de su pase."], tip: "Los usos se devuelven automáticamente cuando una reserva cubierta por el paquete se cancela correctamente." },
  },
  apariencia: {
    href: "/apariencia", internal: "/app/apariencia", label: "Apariencia PWA", icon: Palette,
    help: { title: "Apariencia PWA", purpose: "Personaliza la aplicación pública de reservas de este negocio sin modificar el panel administrativo.", steps: ["Elegí uno de los temas profesionales disponibles.", "Ajustá color principal y secundario si necesitás acercarlo a la marca.", "Revisá la vista previa y guardá; el cambio se aplica sólo a este tenant."], tip: "Logo, portada, splash y galería se gestionan en Configuración → Imágenes y se combinan con el tema seleccionado." },
  },
  disponibilidad: {
    href: "/disponibilidad", internal: "/app/disponibilidad", label: "Disponibilidad", icon: CalendarClock,
    help: { title: "Disponibilidad", purpose: "Define cuándo puede reservarse el negocio, una sede, un profesional o un recurso.", steps: ["Creá la jornada general del negocio.", "Agregá reglas específicas para sedes, profesionales o recursos cuando difieran.", "Usá varios bloques en un mismo día para jornadas partidas."], tip: "OnlyTurn intersecta las reglas: sólo ofrece horarios donde coinciden todas las disponibilidades necesarias." },
  },
  politicas: {
    href: "/politicas", internal: "/app/politicas", label: "Políticas", icon: SlidersHorizontal,
    help: { title: "Políticas", purpose: "Configura reglas comerciales específicas de cada servicio, como anticipación, cancelación, aprobación y límites.", steps: ["Elegí el servicio a configurar.", "Definí ventanas de reserva, cancelación y reprogramación.", "Guardá reglas diferentes cuando un servicio tenga condiciones especiales."], tip: "Las políticas específicas del servicio tienen prioridad sobre las reglas generales del negocio." },
  },
  automatizaciones: {
    href: "/automatizaciones", internal: "/app/automatizaciones", label: "Automatizaciones", icon: BellRing,
    help: { title: "Automatizaciones", purpose: "Envía comunicaciones automáticas disparadas por eventos de la agenda, como confirmaciones, recordatorios o seguimientos.", steps: ["Elegí el evento que dispara la regla.", "Seleccioná canal y momento del envío.", "Configurá el mensaje y activá la regla cuando el proveedor esté conectado."], tip: "Email y WhatsApp dependen de las credenciales productivas configuradas por NanoLabs; una regla sin provider no debe activarse." },
  },
  calendario: {
    href: "/calendario", internal: "/app/calendario", label: "Calendarios", icon: CalendarSync,
    help: { title: "Calendarios", purpose: "Publica feeds privados iCal para visualizar las reservas de OnlyTurn en Google Calendar, Outlook o Apple Calendar.", steps: ["Copiá el feed general o el de un profesional.", "Agregalo como calendario por suscripción en la aplicación externa.", "No compartas públicamente el enlace porque contiene un token privado."], tip: "La suscripción es ideal para visualización externa; la agenda operativa y los cambios siguen administrándose en OnlyTurn." },
  },
  reportes: {
    href: "/reportes", internal: "/app/reportes", label: "Reportes", icon: BarChart3,
    help: { title: "Reportes", purpose: "Convierte la actividad de reservas en métricas para tomar decisiones sobre ocupación, clientes y rendimiento.", steps: ["Elegí el período que querés analizar.", "Compará reservas, cancelaciones, no-shows, ingresos y recurrencia.", "Usá los rankings para detectar servicios, horarios y recursos que merecen atención."], tip: "Mirar tendencias mensuales suele ser más útil que reaccionar a un único día atípico." },
  },
  configuracion: {
    href: "/configuracion", internal: "/app/configuracion", label: "Configuración", icon: Settings,
    help: { title: "Configuración", purpose: "Contiene los ajustes generales del negocio, branding, formularios, bloqueos especiales e integraciones disponibles.", steps: ["Revisá primero los datos generales y la experiencia pública.", "Configurá campos personalizados y excepciones cuando sean necesarias.", "Conectá pagos o recursos externos sólo cuando el negocio los vaya a utilizar."], tip: "Las configuraciones avanzadas deben tocarse con intención: disponibilidad, servicios y políticas cubren la mayoría de los cambios cotidianos." },
  },
};

const primaryTenantLinks = [tenantItems.dashboard, tenantItems.agenda, tenantItems.clientes];

const tenantGroups: NavGroup[] = [
  { label: "Reservas avanzadas", description: "Cupos, series y demanda", items: [tenantItems.sesiones, tenantItems.recurrencias, tenantItems.waitlist] },
  { label: "Oferta y experiencia", description: "Catálogo, marca y monetización", items: [tenantItems.servicios, tenantItems.apariencia, tenantItems.extras, tenantItems.paquetes] },
  { label: "Reglas y operación", description: "Disponibilidad y automatización", items: [tenantItems.disponibilidad, tenantItems.politicas, tenantItems.automatizaciones, tenantItems.calendario] },
  { label: "Control del negocio", description: "Análisis y ajustes", items: [tenantItems.reportes, tenantItems.configuracion] },
];

const platformLinks: NavItem[] = [
  { href: "/superadmin", internal: "/superadmin", label: "Resumen", icon: ShieldCheck, help: { title: "SuperAdmin", purpose: "Vista global de OnlyTurn para NanoLabs.", steps: ["Revisá tenants y estado general.", "Accedé a la gestión de clientes SaaS.", "Controlá planes y membresías."], tip: "Esta consola es de plataforma y no pertenece a ningún tenant." } },
  { href: "/superadmin/tenants", internal: "/superadmin/tenants", label: "Tenants", icon: Users, help: { title: "Tenants", purpose: "Administra los negocios que utilizan OnlyTurn.", steps: ["Creá o buscá un tenant.", "Revisá su plan y estado.", "Suspendé o reactivá sólo cuando corresponda." ] } },
  { href: "/superadmin/planes", internal: "/superadmin/planes", label: "Planes", icon: BriefcaseBusiness, help: { title: "Planes", purpose: "Define la oferta comercial SaaS y sus límites.", steps: ["Revisá los planes vigentes.", "Ajustá límites o capacidades habilitadas.", "Evitá habilitar funciones que no estén completas end-to-end." ] } },
];

export function AppShell({
  children,
  tenantName,
  userName,
  superAdmin = false,
}: {
  children: React.ReactNode;
  tenantName: string;
  userName: string;
  superAdmin?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const isActive = (href: string, internal: string) => {
    if (superAdmin && href === "/superadmin") return pathname === "/superadmin";
    const publicMatch = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    const internalMatch = internal === "/app" ? pathname === internal : pathname === internal || pathname.startsWith(`${internal}/`);
    return publicMatch || internalMatch;
  };

  const allItems = superAdmin ? platformLinks : [...primaryTenantLinks, ...tenantGroups.flatMap((group) => group.items)];
  const currentItem = allItems.find((item) => isActive(item.href, item.internal)) ?? allItems[0];

  const renderLink = ({ href, internal, label, icon: Icon }: NavItem) => (
    <Link className={isActive(href, internal) ? "active" : undefined} key={href} href={href} onClick={() => setOpen(false)}>
      <Icon size={17} />
      <span>{label}</span>
    </Link>
  );

  return (
    <div className={`shell nanolabs-shell ${superAdmin ? "platform-shell" : "tenant-shell"}`}>
      {open && <button className="sidebar-backdrop" aria-label="Cerrar menú" onClick={() => setOpen(false)} />}
      {helpOpen && <button className="module-help-backdrop" aria-label="Cerrar ayuda" onClick={() => setHelpOpen(false)} />}

      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="brand brand-onlyturn">
          <span className="brand-mark" aria-hidden="true"><CalendarCheck2 size={18} /></span>
          <span className="brand-copy"><strong>OnlyTurn</strong><small>by NanoLabs</small></span>
          <button className="mobile-close" aria-label="Cerrar menú" onClick={() => setOpen(false)}><X size={19} /></button>
        </div>

        <div className="sidebar-context">
          <span>{superAdmin ? "Administración de plataforma" : "Espacio de trabajo"}</span>
          <strong>{tenantName}</strong>
        </div>

        <nav className="nav" aria-label="Navegación principal">
          {superAdmin ? (
            <div className="nav-primary">{platformLinks.map(renderLink)}</div>
          ) : (
            <>
              <div className="nav-primary">{primaryTenantLinks.map(renderLink)}</div>
              <div className="nav-divider" />
              <div className="nav-groups">
                {tenantGroups.map((group) => {
                  const activeGroup = group.items.some((item) => isActive(item.href, item.internal));
                  return (
                    <details className="nav-group" key={`${group.label}-${pathname}`} open={activeGroup || undefined}>
                      <summary>
                        <span><strong>{group.label}</strong><small>{group.description}</small></span>
                        <ChevronDown size={15} />
                      </summary>
                      <div className="nav-group-links">{group.items.map(renderLink)}</div>
                    </details>
                  );
                })}
              </div>
            </>
          )}
        </nav>

        <div className="sidebar-foot">
          <div className="user-card">
            <span className="avatar">{userName.trim().charAt(0).toUpperCase() || "N"}</span>
            <div><strong>{userName}</strong><span>{superAdmin ? "SuperAdmin NanoLabs" : tenantName}</span></div>
          </div>
          <form action={logoutAction}><button className="button ghost logout-button" type="submit"><LogOut size={16} /> Salir</button></form>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            <button className="mobile-menu" aria-label="Abrir menú" onClick={() => setOpen(true)}><Menu size={20} /></button>
            <div><span>{superAdmin ? "NanoLabs" : currentItem?.label ?? "OnlyTurn"}</span><strong>{tenantName}</strong></div>
          </div>
          <div className="topbar-actions">
            {currentItem && (
              <button className="module-help-trigger" type="button" onClick={() => setHelpOpen(true)} aria-label={`Ayuda de ${currentItem.label}`}>
                <CircleHelp size={17} /><span>Ayuda</span>
              </button>
            )}
            <span className="system-status"><i /> Operativo</span>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>

      {currentItem && (
        <aside className={`module-help-panel ${helpOpen ? "is-open" : ""}`} aria-hidden={!helpOpen}>
          <div className="module-help-head">
            <div className="module-help-icon"><CircleHelp size={19} /></div>
            <div><span>Ayuda del módulo</span><h2>{currentItem.help.title}</h2></div>
            <button type="button" aria-label="Cerrar ayuda" onClick={() => setHelpOpen(false)}><X size={18} /></button>
          </div>
          <div className="module-help-body">
            <section><span className="help-kicker">¿Para qué sirve?</span><p>{currentItem.help.purpose}</p></section>
            <section><span className="help-kicker">Cómo usarlo</span><ol>{currentItem.help.steps.map((step) => <li key={step}>{step}</li>)}</ol></section>
            {currentItem.help.tip && <div className="help-tip"><strong>Consejo</strong><p>{currentItem.help.tip}</p></div>}
          </div>
        </aside>
      )}
    </div>
  );
}
