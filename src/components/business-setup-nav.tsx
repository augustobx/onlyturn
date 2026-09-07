"use client";

import {
  Building2,
  Clock3,
  CreditCard,
  Home,
  Palette,
  Settings2,
  ShieldCheck,
  Store,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const steps = [
  { href: "/configuracion", label: "Negocio", icon: Settings2, path: "/configuracion", tabs: [null, "general", "media", "booking", "customers", "availability", "announcements"] },
  { href: "/estructura", label: "Sedes y equipo", icon: Building2, path: "/estructura" },
  { href: "/servicios", label: "Servicios", icon: Store, path: "/servicios" },
  { href: "/disponibilidad", label: "Horarios", icon: Clock3, path: "/disponibilidad" },
  { href: "/politicas", label: "Reglas", icon: ShieldCheck, path: "/politicas" },
  { href: "/apariencia", label: "Apariencia", icon: Palette, path: "/apariencia" },
  { href: "/configuracion?tab=payments", label: "Integraciones", icon: CreditCard, path: "/configuracion", tabs: ["payments", "domains"] },
] as const;

export const businessSetupPaths = ["/configurar", "/configuracion", "/estructura", "/servicios", "/catalogo", "/disponibilidad", "/politicas", "/apariencia"];

export function BusinessSetupNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  return <div className="business-setup-shell">
    <div className="business-setup-head">
      <div><span className="eyebrow">Configuración del negocio</span><strong>Todo lo necesario para empezar y mantener la agenda</strong></div>
      <Link href="/configurar" className={pathname === "/configurar" ? "setup-home-link active" : "setup-home-link"}><Home size={14} /> Estado general</Link>
    </div>
    <nav className="business-setup-nav" aria-label="Pasos de configuración">
      {steps.map(({ href, label, icon: Icon, path, tabs }, index) => {
        const pathActive = pathname === path || (path === "/servicios" && pathname === "/catalogo");
        const allowedTabs = tabs ? tabs as readonly (string | null)[] : null;
        const active = pathActive && (!allowedTabs || allowedTabs.includes(tab));
        return <Link href={href} className={active ? "active" : undefined} key={label}>
          <span className="setup-step-number">{index + 1}</span><Icon size={15} /><span>{label}</span>
        </Link>;
      })}
    </nav>
  </div>;
}
