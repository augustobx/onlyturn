import { CalendarDays, LayoutDashboard, Users, BriefcaseBusiness, Settings, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";

export function AppShell({ children, tenantName, userName, superAdmin = false }: { children: React.ReactNode; tenantName: string; userName: string; superAdmin?: boolean }) {
  const links = superAdmin ? [{href:"/superadmin",label:"Plataforma",icon:ShieldCheck}] : [
    {href:"/app",label:"Resumen",icon:LayoutDashboard},{href:"/app/agenda",label:"Agenda",icon:CalendarDays},
    {href:"/app/clientes",label:"Clientes",icon:Users},{href:"/app/catalogo",label:"Servicios y equipo",icon:BriefcaseBusiness},
    {href:"/app/configuracion",label:"Configuración",icon:Settings}
  ];
  return <div className="shell"><aside className="sidebar">
    <div className="brand"><span className="brand-mark">O</span> OnlyTurn</div>
    <nav className="nav">{links.map(({href,label,icon:Icon})=><Link key={href} href={href}><Icon size={18}/>{label}</Link>)}</nav>
    <div className="sidebar-foot"><div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}><span className="avatar">{userName[0]}</span><div><strong style={{fontSize:13}}>{userName}</strong><div className="muted" style={{fontSize:11}}>{tenantName}</div></div></div><form action={logoutAction}><button className="button ghost" type="submit"><LogOut size={16}/> Salir</button></form></div>
  </aside><main className="main"><header className="topbar"><div><strong>{tenantName}</strong></div><span className="pill">● Sistema operativo</span></header><div className="content">{children}</div></main></div>;
}
