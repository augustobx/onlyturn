"use client";

import { ArrowRight, Lock, Mail } from "lucide-react";
import { useActionState } from "react";
import { superAdminLoginAction } from "@/app/actions/auth";

export function SuperAdminLoginForm() {
  const [state, action, pending] = useActionState(superAdminLoginAction, undefined);

  return (
    <form action={action}>
      {state?.error && <div className="sa-form-error">{state.error}</div>}

      <div className="sa-login-field">
        <label className="sa-label">Email maestro</label>
        <div className="sa-login-input-wrap">
          <Mail size={17} />
          <input className="sa-input" name="email" type="email" autoComplete="email" required placeholder="superadmin@nanolabs.com.ar" />
        </div>
      </div>

      <div className="sa-login-field">
        <label className="sa-label">Contraseña</label>
        <div className="sa-login-input-wrap">
          <Lock size={17} />
          <input className="sa-input" name="password" type="password" autoComplete="current-password" required placeholder="••••••••••••" />
        </div>
      </div>

      <button className="sa-login-submit" disabled={pending}>
        {pending ? "Verificando..." : <>Ingresar a plataforma <ArrowRight size={15} /></>}
      </button>
    </form>
  );
}
