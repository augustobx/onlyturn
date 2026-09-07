"use client";

import {
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/actions/auth";

const tenantLinks = [
  { href: "/dashboard", internal: "/app", label: "Resumen", icon: LayoutDashboard },
  { href: "/agenda", internal: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", internal: "/app/clientes", label: "Clientes", icon: Users },
  { href: "/servicios", internal: "/app/catalogo", label: "Servicios y equipo", icon: BriefcaseBusiness },
  { href: "/disponibilidad", internal: "/app/disponibilidad", label: "Disponibilidad", icon: CalendarClock },
  { href: "/configuracion", internal: "/app/configuracion", label: "Configuración", icon: Settings },
];

const platformLinks = [
  { href: "/superadmin", internal: "/superadmin", label: "Resumen", icon: ShieldCheck },
  { href: "/superadmin/tenants", internal: "/superadmin/tenants", label: "Tenants", icon: Users },
  { href: "/superadmin/planes", internal: "/superadmin/planes", label: "Planes", icon: BriefcaseBusiness },
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
  const links = superAdmin ? platformLinks : tenantLinks;

  const isActive = (href: string, internal: string) => {
    if (superAdmin && href === "/superadmin") return pathname === "/superadmin";
    const publicMatch = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    const internalMatch = internal === "/app" ? pathname === internal : pathname === internal || pathname.startsWith(`${internal}/`);
    return publicMatch || internalMatch;
  };

  return (
    <div className={`shell nanolabs-shell ${superAdmin ? "platform-shell" : "tenant-shell"}`}>
      {open && <button className="sidebar-backdrop" aria-label="Cerrar menú" onClick={() => setOpen(false)} />}
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
          {links.map(({ href, internal, label, icon: Icon }) => (
            <Link className={isActive(href, internal) ? "active" : undefined} key={href} href={href} onClick={() => setOpen(false)}>
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
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
            <div><span>{superAdmin ? "NanoLabs" : "OnlyTurn"}</span><strong>{tenantName}</strong></div>
          </div>
          <span className="system-status"><i /> Operativo</span>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
