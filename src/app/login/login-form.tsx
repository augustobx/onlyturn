"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return <form action={action} className="form-card">
    <span className="eyebrow">Bienvenido</span>
    <h2>Entrá a tu agenda</h2>
    <p className="muted">Gestioná tu operación desde un solo lugar.</p>
    {state?.error && <div className="error">{state.error}</div>}
    <div className="field"><label>Email</label><input className="input" name="email" type="email" autoComplete="email" required placeholder="tu@negocio.com" /></div>
    <div className="field"><label>Contraseña</label><input className="input" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" /></div>
    <button className="button" style={{width:"100%",marginTop:8}} disabled={pending}>{pending ? "Ingresando…" : "Ingresar"}</button>
    <p className="muted" style={{fontSize:12,textAlign:"center",marginTop:20}}>Tus datos están aislados y protegidos por organización.</p>
  </form>;
}
