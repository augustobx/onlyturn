"use client";

import {
  Building2,
  Clock3,
  CreditCard,
  Palette,
  Settings2,
  ShieldCheck,
  Store,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const steps = [
  { href: "/configurar", label: "Inicio", icon: Store, matches: ["/configurar"] },
  { href: "/configuracion", label: "Negocio", icon: Settings2, matches: ["/configuracion"] },
  { href: "/servicios#infraestructura", label: "Sedes y equipo", icon: Building2, matches: [] },
  { href: "/servicios", label: "Servicios", icon: Store, matches: ["/servicios", "/catalogo"] },
  { href: "/disponibilidad", label: "Horarios", icon: Clock3, matches: ["/disponibilidad"] },
  { href: "/politicas", label: "Reglas", icon: ShieldCheck, matches: ["/politicas"] },
  { href: "/apariencia", label: "Apariencia", icon: Palette, matches: ["/apariencia"] },
  { href: "/configuracion", label: "Integraciones", icon: CreditCard, matches: [] },
];

export const businessSetupPaths = ["/configurar", "/configuracion", "/servicios", "/catalogo", "/disponibilidad", "/politicas", "/apariencia"];

export function BusinessSetupNav() {
  const pathname = usePathname();

  return <div className="business-setup-shell">
    <div className="business-setup-head">
      <div><span className="eyebrow">Configuración del negocio</span><strong>Todo lo necesario para empezar y mantener la agenda</strong></div>
      <Link href="/configurar" className="setup-home-link">Ver estado</Link>
    </div>
    <nav className="business-setup-nav" aria-label="Pasos de configuración">
      {steps.map(({ href, label, icon: Icon, matches }, index) => {
        const active = matches.some((path) => pathname === path || pathname.startsWith(`${path}/`));
        return <Link href={href} className={active ? "active" : undefined} key={`${label}-${index}`}>
          <span className="setup-step-number">{index + 1}</span><Icon size={15} /><span>{label}</span>
        </Link>;
      })}
    </nav>
  </div>;
}
