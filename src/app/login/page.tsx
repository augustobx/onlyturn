import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.user.isSuperAdmin && !session.tenantId ? "/superadmin" : "/app");
  return <main className="login-page">
    <section className="login-visual">
      <div className="brand"><span className="brand-mark">O</span> OnlyTurn</div>
      <div><span className="eyebrow" style={{color:"#a9a8ff"}}>Tu tiempo, bien organizado</span><h1>Una agenda que sigue el ritmo de tu negocio.</h1><p>Turnos, clientes, equipo y recursos en una experiencia simple, rápida y flexible.</p></div>
      <small style={{color:"#9294b2"}}>Una plataforma de Nano Labs</small>
    </section>
    <section className="login-panel"><LoginForm /></section>
  </main>;
}
