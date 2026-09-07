import { CalendarCheck2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.user.isSuperAdmin && !session.tenantId ? "/superadmin" : "/app");

  return <main className="login-page">
    <section className="login-visual">
      <div className="brand brand-onlyturn"><span className="brand-mark"><CalendarCheck2 size={18} /></span><span className="brand-copy"><strong>OnlyTurn</strong><small style={{color:"#bfdbfe"}}>by NanoLabs</small></span></div>
      <div>
        <span className="eyebrow">Agenda inteligente para tu negocio</span>
        <h1>Tu tiempo, tus clientes y tu equipo en un solo lugar.</h1>
        <p>Administrá turnos, disponibilidad, profesionales, recursos y reservas online desde una plataforma preparada para crecer con tu operación.</p>
      </div>
      <small style={{color:"#a9bfdd"}}>OnlyTurn es una plataforma desarrollada por NanoLabs.</small>
    </section>
    <section className="login-panel"><LoginForm /></section>
  </main>;
}
