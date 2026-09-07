"use client";

import { useActionState } from "react";
import { superAdminLoginAction } from "@/app/actions/auth";

export function SuperAdminLoginForm() {
  const [state, action, pending] = useActionState(superAdminLoginAction, undefined);

  return <form action={action} className="form-card">
    <span className="eyebrow">NanoLabs · Plataforma</span>
    <h2>SuperAdmin OnlyTurn</h2>
    <p className="muted">Acceso exclusivo para administrar tenants, planes y estado de la plataforma.</p>
    {state?.error && <div className="error">{state.error}</div>}
    <div className="field"><label>Email</label><input className="input" name="email" type="email" autoComplete="email" required placeholder="admin@nanolabs.com.ar" /></div>
    <div className="field"><label>Contraseña</label><input className="input" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" /></div>
    <button className="button" style={{width:"100%",marginTop:8}} disabled={pending}>{pending ? "Ingresando…" : "Ingresar a plataforma"}</button>
  </form>;
}
