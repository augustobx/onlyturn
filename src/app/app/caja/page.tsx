import { addDays, format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { Banknote, CircleDollarSign, CreditCard, Landmark, ReceiptText, WalletCards } from "lucide-react";
import { registerBookingPaymentAction } from "@/app/actions/cash";
import { requireTenantSession } from "@/lib/auth";
import { platformDb } from "@/lib/db";
import { FeedbackForm } from "@/components/feedback-form";

type Query={bookingId?:string};
type PaymentMeta={amountCents?:number;method?:string;reference?:string|null;notes?:string|null;customer?:string;service?:string};
const methodLabels:Record<string,string>={CASH:"Efectivo",TRANSFER:"Transferencia",CARD:"Tarjeta",MERCADOPAGO:"Mercado Pago",OTHER:"Otro"};
const methodIcons:Record<string,React.ReactNode>={CASH:<Banknote size={15}/>,TRANSFER:<Landmark size={15}/>,CARD:<CreditCard size={15}/>,MERCADOPAGO:<WalletCards size={15}/>,OTHER:<ReceiptText size={15}/>};

export default async function CashPage({searchParams}:{searchParams:Promise<Query>}){
  const {membership,tenant}=await requireTenantSession();
  const query=await searchParams;
  const today=formatInTimeZone(new Date(),tenant.timezone,"yyyy-MM-dd");
  const tomorrow=format(addDays(new Date(`${today}T12:00:00Z`),1),"yyyy-MM-dd");
  const from=fromZonedTime(`${today}T00:00:00`,tenant.timezone);
  const to=fromZonedTime(`${tomorrow}T00:00:00`,tenant.timezone);

  const [bookings,manualLogs,onlinePayments]=await Promise.all([
    platformDb.booking.findMany({
      where:{tenantId:membership.tenantId,startsAt:{gte:from,lt:to},status:{not:"CANCELLED"}},
      include:{customer:true,service:true,location:true,professional:true,resource:true},
      orderBy:{startsAt:"asc"},take:200,
    }),
    platformDb.auditLog.findMany({where:{tenantId:membership.tenantId,action:"payment.manual_recorded",createdAt:{gte:from,lt:to}},orderBy:{createdAt:"desc"},take:100}),
    platformDb.paymentTransaction.findMany({where:{tenantId:membership.tenantId,status:"PAID",updatedAt:{gte:from,lt:to}},include:{booking:{include:{customer:true,service:true}}},orderBy:{updatedAt:"desc"},take:100}),
  ]);

  const manualTotal=manualLogs.reduce((sum,item)=>sum+(Number((item.metadata as PaymentMeta|null)?.amountCents)||0),0);
  const onlineTotal=onlinePayments.reduce((sum,item)=>sum+item.amountCents,0);
  const pendingBookings=bookings.filter((booking)=>(booking.priceCents??0)>booking.paymentAmountCents);
  const pendingTotal=pendingBookings.reduce((sum,booking)=>sum+Math.max(0,(booking.priceCents??0)-booking.paymentAmountCents),0);
  const paidBookings=bookings.filter((booking)=>booking.paymentStatus==="PAID").length;
  const money=new Intl.NumberFormat("es-AR",{style:"currency",currency:tenant.currency,maximumFractionDigits:0});
  const selectedBooking=query.bookingId?bookings.find((booking)=>booking.id===query.bookingId):undefined;
  const orderedBookings=selectedBooking?[selectedBooking,...pendingBookings.filter((item)=>item.id!==selectedBooking.id)]:pendingBookings;

  return <>
    <div className="page-title cash-page-title"><span className="eyebrow">Operación diaria</span><h1>Caja y cobros</h1><p className="muted">Una sola pantalla para entender qué cobraste, qué falta cobrar y a qué turno corresponde cada pago.</p></div>

    <section className="cash-kpis">
      <article className="cash-kpi primary"><span><CircleDollarSign size={19}/></span><div><small>Cobrado hoy</small><strong>{money.format((manualTotal+onlineTotal)/100)}</strong><em>Manual + Mercado Pago</em></div></article>
      <article className="cash-kpi"><span><Banknote size={19}/></span><div><small>Cobros manuales</small><strong>{money.format(manualTotal/100)}</strong><em>{manualLogs.length} movimiento{manualLogs.length===1?"":"s"}</em></div></article>
      <article className="cash-kpi"><span><WalletCards size={19}/></span><div><small>Mercado Pago</small><strong>{money.format(onlineTotal/100)}</strong><em>{onlinePayments.length} acreditado{onlinePayments.length===1?"":"s"}</em></div></article>
      <article className={`cash-kpi ${pendingTotal>0?"warning":""}`}><span><ReceiptText size={19}/></span><div><small>Pendiente hoy</small><strong>{money.format(pendingTotal/100)}</strong><em>{pendingBookings.length} turno{pendingBookings.length===1?"":"s"} · {paidBookings} pagos</em></div></article>
    </section>

    <div className="cash-layout">
      <section className="card cash-pending-card">
        <div className="section-head"><div><span className="eyebrow">Por cobrar</span><h2>Turnos con saldo pendiente</h2></div><span className="setup-count">{pendingBookings.length} pendientes</span></div>
        <p className="muted cash-intro">Registrá el medio de pago y el importe. OnlyTurn actualiza el estado del turno y conserva el movimiento en el historial.</p>
        {orderedBookings.length?<div className="cash-booking-list">{orderedBookings.map((booking)=>{
          const total=booking.priceCents??0;const remaining=Math.max(0,total-booking.paymentAmountCents);const highlighted=booking.id===query.bookingId;
          return <details className={`cash-booking ${highlighted?"highlighted":""}`} open={highlighted} key={booking.id}>
            <summary><div className="cash-booking-time"><strong>{formatInTimeZone(booking.startsAt,tenant.timezone,"HH:mm")}</strong><small>{booking.location.name}</small></div><div><strong>{booking.customer.firstName} {booking.customer.lastName}</strong><small>{booking.service.name}{booking.professional?` · ${booking.professional.name}`:booking.resource?` · ${booking.resource.name}`:""}</small></div><div className="cash-booking-amount"><span>Saldo</span><strong>{money.format(remaining/100)}</strong></div></summary>
            <div className="cash-payment-panel"><div className="cash-payment-summary"><span>Total <strong>{money.format(total/100)}</strong></span><span>Ya cobrado <strong>{money.format(booking.paymentAmountCents/100)}</strong></span><span>Falta <strong>{money.format(remaining/100)}</strong></span></div><FeedbackForm action={registerBookingPaymentAction} className="cash-payment-form" savedMessage="Cobro registrado"><input type="hidden" name="bookingId" value={booking.id}/><div className="field"><label>Importe</label><input className="input" name="amount" type="number" min="0.01" step="0.01" max={remaining?remaining/100:undefined} defaultValue={remaining?remaining/100:undefined} required/></div><div className="field"><label>Medio de pago</label><select className="select" name="method" defaultValue="CASH"><option value="CASH">Efectivo</option><option value="TRANSFER">Transferencia</option><option value="CARD">Tarjeta</option><option value="MERCADOPAGO">Mercado Pago manual</option><option value="OTHER">Otro</option></select></div><div className="field"><label>Referencia</label><input className="input" name="reference" placeholder="N° operación / comprobante" maxLength={120}/></div><div className="field cash-notes"><label>Nota</label><input className="input" name="notes" placeholder="Opcional" maxLength={300}/></div><button className="button"><CircleDollarSign size={15}/> Registrar cobro</button></FeedbackForm></div>
          </details>})}</div>:<div className="empty cash-empty"><CircleDollarSign size={24}/><strong>No hay cobros pendientes hoy</strong><span>Los turnos del día están saldados o no tienen precio configurado.</span></div>}
      </section>

      <aside className="card cash-activity-card"><div className="section-head"><div><span className="eyebrow">Actividad</span><h2>Cobros de hoy</h2></div></div><div className="cash-activity-list">
        {manualLogs.map((item)=>{const meta=(item.metadata??{}) as PaymentMeta;return <article key={item.id}><span className="cash-method-icon">{methodIcons[meta.method??"OTHER"]??methodIcons.OTHER}</span><div><strong>{meta.customer||"Cliente"}</strong><small>{meta.service||methodLabels[meta.method??"OTHER"]||"Cobro manual"}{meta.reference?` · ${meta.reference}`:""}</small></div><div><strong>{money.format((meta.amountCents??0)/100)}</strong><small>{formatInTimeZone(item.createdAt,tenant.timezone,"HH:mm")}</small></div></article>})}
        {onlinePayments.map((item)=><article key={item.id}><span className="cash-method-icon"><WalletCards size={15}/></span><div><strong>{item.booking.customer.firstName} {item.booking.customer.lastName}</strong><small>{item.booking.service.name} · Mercado Pago</small></div><div><strong>{money.format(item.amountCents/100)}</strong><small>{formatInTimeZone(item.updatedAt,tenant.timezone,"HH:mm")}</small></div></article>)}
        {!manualLogs.length&&!onlinePayments.length&&<div className="empty">Todavía no se registraron cobros hoy.</div>}
      </div></aside>
    </div>
  </>;
}
