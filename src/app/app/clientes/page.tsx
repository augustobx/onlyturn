import Link from "next/link";
import { BellRing, Settings2 } from "lucide-react";
import { requireTenantSession } from "@/lib/auth";
import { createTenantDb } from "@/lib/tenant-db";

const accountLabels={PENDING:"Pendiente",ACTIVE:"Activa",REJECTED:"Rechazada",SUSPENDED:"Suspendida"} as const;
export default async function CustomersPage(){
  const {membership,tenant}=await requireTenantSession();
  const rows=await createTenantDb(membership.tenantId).customers();
  const money=new Intl.NumberFormat("es-AR",{style:"currency",currency:tenant.currency});
  const pending=rows.filter(item=>item.account?.status==="PENDING").length;
  const ordered=[...rows].sort((a,b)=>Number(b.account?.status==="PENDING")-Number(a.account?.status==="PENDING"));
  return <>
    <div className="page-title"><span className="eyebrow">Relaciones</span><h1>Clientes</h1><p className="muted">Perfiles, cuentas registradas, historial y saldos dentro de esta organización.</p></div>
    <div className="settings-actions" style={{marginBottom:18}}><Link className="button secondary" href="/configuracion/clientes"><Settings2 size={15}/> Configurar registro y mensajes</Link></div>
    {pending>0&&<div className="pending-customers-banner"><div className="pending-customers-icon"><BellRing size={20}/></div><div><strong>{pending} registro{pending===1?" nuevo":"s nuevos"} esperando aprobación</strong><span>Revisá los datos y aprobá o rechazá cada solicitud. Mientras tanto, el cliente verá que su cuenta está en verificación.</span></div></div>}
    <div className="card table-wrap"><table className="table"><thead><tr><th>Cliente</th><th>Contacto</th><th>Cuenta</th><th>Turnos</th><th>Saldo</th><th></th></tr></thead><tbody>{ordered.map(customer=>{const balance=customer.ledgerEntries.reduce((sum,item)=>sum+item.amountCents,0);const isPending=customer.account?.status==="PENDING";return <tr key={customer.id} className={isPending?"pending-customer-row":undefined}><td><strong>{customer.firstName} {customer.lastName}</strong>{isPending&&<span className="new-registration-pill">Nuevo registro</span>}<br/><small className="muted">Actualizado {new Intl.DateTimeFormat("es-AR").format(customer.updatedAt)}</small></td><td>{customer.phone}<br/><small>{customer.email??"Sin email"}</small></td><td>{customer.account?<span className={`status account-${customer.account.status.toLowerCase()}`}>{accountLabels[customer.account.status]}</span>:<span className="muted">Sin registro</span>}</td><td>{customer._count.bookings}</td><td className={balance>0?"ledger-debit":"ledger-credit"}>{money.format(balance/100)}</td><td><Link className={`button ${isPending?"":"secondary"}`} href={`/app/clientes/${customer.id}`}>{isPending?"Revisar solicitud":"Ver ficha"}</Link></td></tr>})}</tbody></table></div>
  </>
}
