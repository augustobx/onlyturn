import Link from "next/link";
import { MessageSquareText, ShieldCheck, UserRoundCheck } from "lucide-react";
import { updateCustomerAccessSettingsAction } from "@/app/actions/settings";
import { requireTenantSession } from "@/lib/auth";

const defaults = {
  accessTitle: "Para acceder a nuestros servicios necesitás una cuenta",
  accessMessage: "Registrate una sola vez. Después vas a poder ver los servicios disponibles, reservar horarios y administrar tus turnos desde tu cuenta.",
  pendingTitle: "Tu cuenta está en verificación",
  pendingMessage: "Recibimos tu registro correctamente. Nuestro equipo va a revisar tus datos y, en breve, tu cuenta quedará habilitada para acceder a los servicios y gestionar tus reservas.",
};

export default async function CustomerRegistrationSettingsPage(){
  const {tenant}=await requireTenantSession();
  const settings=tenant.settings as {
    customerRegistrationEnabled?:boolean;
    customerApprovalRequired?:boolean;
    customerAccessTitle?:string;
    customerAccessMessage?:string;
    customerPendingTitle?:string;
    customerPendingMessage?:string;
  };
  return <>
    <div className="page-title"><span className="eyebrow">Clientes · Acceso público</span><h1>Registro y mensajes</h1><p className="muted">Definí qué ve una persona antes de registrarse y qué mensaje recibe mientras espera la aprobación de su cuenta.</p></div>
    <div className="settings-actions" style={{marginBottom:18}}><Link className="button ghost" href="/clientes">← Volver a clientes</Link><Link className="button secondary" href="/">Ver PWA pública</Link></div>
    <form action={updateCustomerAccessSettingsAction} className="customer-registration-settings">
      <section className="card registration-settings-section">
        <div className="registration-settings-head"><div className="registration-settings-icon"><UserRoundCheck size={20}/></div><div><span className="eyebrow">Acceso</span><h2>Cómo funciona el registro</h2><p className="muted">Elegí si el cliente necesita una cuenta y si el equipo debe aprobarla antes de darle acceso.</p></div></div>
        <div className="account-setting-options"><label className="account-setting"><input type="checkbox" name="customerRegistrationEnabled" defaultChecked={Boolean(settings.customerRegistrationEnabled)}/><span><strong>Requerir registro para acceder a los servicios</strong><small>La PWA muestra una bienvenida y solicita crear una cuenta antes de mostrar servicios y horarios.</small></span></label><label className="account-setting"><input type="checkbox" name="customerApprovalRequired" defaultChecked={Boolean(settings.customerApprovalRequired)}/><span><strong>Requerir aprobación administrativa</strong><small>Las cuentas nuevas quedan en verificación hasta que alguien del equipo las apruebe.</small></span></label></div>
      </section>

      <section className="card registration-settings-section">
        <div className="registration-settings-head"><div className="registration-settings-icon"><MessageSquareText size={20}/></div><div><span className="eyebrow">Antes del registro</span><h2>Mensaje de acceso a los servicios</h2><p className="muted">Este contenido aparece en la pantalla principal cuando una persona todavía no inició sesión.</p></div></div>
        <div className="field"><label>Título</label><input className="input" name="customerAccessTitle" maxLength={120} defaultValue={settings.customerAccessTitle||defaults.accessTitle} required/></div>
        <div className="field"><label>Explicación</label><textarea className="input" name="customerAccessMessage" rows={5} maxLength={700} defaultValue={settings.customerAccessMessage||defaults.accessMessage} required/><small className="muted">Explicá brevemente por qué necesita registrarse y qué podrá hacer después.</small></div>
        <div className="registration-message-preview"><span>Vista previa</span><strong>{settings.customerAccessTitle||defaults.accessTitle}</strong><p>{settings.customerAccessMessage||defaults.accessMessage}</p></div>
      </section>

      <section className="card registration-settings-section">
        <div className="registration-settings-head"><div className="registration-settings-icon"><ShieldCheck size={20}/></div><div><span className="eyebrow">Después del registro</span><h2>Mensaje de cuenta en verificación</h2><p className="muted">Se muestra inmediatamente después de registrarse cuando la aprobación administrativa está activada.</p></div></div>
        <div className="field"><label>Título</label><input className="input" name="customerPendingTitle" maxLength={120} defaultValue={settings.customerPendingTitle||defaults.pendingTitle} required/></div>
        <div className="field"><label>Explicación</label><textarea className="input" name="customerPendingMessage" rows={5} maxLength={700} defaultValue={settings.customerPendingMessage||defaults.pendingMessage} required/><small className="muted">Recomendamos dejar claro que el registro ya fue recibido y que no necesita volver a crear la cuenta.</small></div>
        <div className="registration-message-preview verification"><span>Vista previa</span><strong>{settings.customerPendingTitle||defaults.pendingTitle}</strong><p>{settings.customerPendingMessage||defaults.pendingMessage}</p></div>
      </section>

      <div className="registration-settings-save"><button className="button">Guardar configuración de registro</button></div>
    </form>
  </>;
}
