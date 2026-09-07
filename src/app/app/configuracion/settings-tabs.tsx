"use client";
import { useState, type ReactNode } from "react";
import { Bell, CalendarClock, CreditCard, Globe, Image as ImageIcon, Settings2, SlidersHorizontal, UserRoundCog } from "lucide-react";

type TabId="general"|"media"|"booking"|"customers"|"availability"|"payments"|"announcements"|"domains";
const tabs:[TabId,string,React.ComponentType<{size?:number}>][]=[
  ["general","General",Settings2],["media","Imágenes",ImageIcon],["booking","Reservas",SlidersHorizontal],["customers","Clientes",UserRoundCog],
  ["availability","Disponibilidad",CalendarClock],["payments","Pagos",CreditCard],["announcements","Anuncios",Bell],["domains","Dominios",Globe]
];

export function SettingsTabs({general,media,booking,customers,availability,payments,announcements,domains}:{general:ReactNode;media:ReactNode;booking:ReactNode;customers:ReactNode;availability:ReactNode;payments:ReactNode;announcements:ReactNode;domains:ReactNode}){
 const [active,setActive]=useState<TabId>("general");const content={general,media,booking,customers,availability,payments,announcements,domains};
 return <div className="settings-workspace">
  <nav className="settings-tabs" role="tablist" aria-label="Secciones de configuración">{tabs.map(([id,label,Icon])=><button type="button" role="tab" className={active===id?"active":""} aria-selected={active===id} onClick={()=>setActive(id)} key={id}><Icon size={17}/><span>{label}</span></button>)}</nav>
  <section className="settings-panel" role="tabpanel" key={active}>{content[active]}</section>
 </div>
}
