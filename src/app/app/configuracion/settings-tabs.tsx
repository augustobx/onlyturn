"use client";

import { type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, CalendarClock, CreditCard, Globe, Image as ImageIcon, Settings2, SlidersHorizontal, UserRoundCog } from "lucide-react";

type TabId = "general" | "media" | "booking" | "customers" | "availability" | "payments" | "announcements" | "domains";
const tabs: [TabId, string, React.ComponentType<{ size?: number }>, string][] = [
  ["general", "General", Settings2, "Datos y reglas base"],
  ["media", "Imágenes", ImageIcon, "Logo, portada y galería"],
  ["booking", "Formularios", SlidersHorizontal, "Campos de reserva"],
  ["customers", "Clientes", UserRoundCog, "Registro y aprobación"],
  ["availability", "Bloqueos", CalendarClock, "Feriados y excepciones"],
  ["payments", "Pagos", CreditCard, "Mercado Pago y cobros"],
  ["announcements", "Anuncios", Bell, "Mensajes en la PWA"],
  ["domains", "Dominios", Globe, "Dominio propio"],
];
const validTabs = new Set<TabId>(tabs.map(([id]) => id));

export function SettingsTabs({ general, media, booking, customers, availability, payments, announcements, domains }: { general: ReactNode; media: ReactNode; booking: ReactNode; customers: ReactNode; availability: ReactNode; payments: ReactNode; announcements: ReactNode; domains: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab") as TabId | null;
  const active: TabId = requested && validTabs.has(requested) ? requested : "general";
  const content = { general, media, booking, customers, availability, payments, announcements, domains };

  const selectTab = (id: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "general") params.delete("tab"); else params.set("tab", id);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return <div className="settings-workspace">
    <nav className="settings-tabs settings-tabs-v2" role="tablist" aria-label="Secciones de configuración">
      {tabs.map(([id, label, Icon, description]) => <button type="button" role="tab" className={active === id ? "active" : ""} aria-selected={active === id} onClick={() => selectTab(id)} key={id}><Icon size={17} /><span><strong>{label}</strong><small>{description}</small></span></button>)}
    </nav>
    <section className="settings-panel" role="tabpanel" key={active}>{content[active]}</section>
  </div>;
}
