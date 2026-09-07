import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicTenant } from "@/lib/booking-service";
import { platformDb } from "@/lib/db";
import { reconcileMercadoPagoPayment } from "@/lib/payments/reconcile-mercadopago";

const copy={PAID:["Pago acreditado","Tu reserva está confirmada."],PENDING:["Estamos verificando el pago","La reserva permanece pendiente hasta recibir la confirmación."],FAILED:["El pago no se completó","Podés volver a Mercado Pago mientras el enlace siga vigente."],AUTHORIZED:["Pago autorizado","Estamos completando la acreditación."],REFUNDED:["Pago reintegrado","El importe fue devuelto."],PARTIALLY_REFUNDED:["Reintegro parcial","Una parte del pago fue devuelta."],NOT_REQUIRED:["Reserva confirmada","Este turno no requiere pago."]} as const;

export default async function PaymentResultPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{reference?:string;payment_id?:string;collection_id?:string}>}){
 const [{slug},query]=await Promise.all([params,searchParams]);const tenant=await getPublicTenant(slug);if(!tenant||!query.reference)notFound();
 const initial=await platformDb.paymentTransaction.findFirst({where:{tenantId:tenant.id,externalReference:query.reference}});if(!initial)notFound();
 const paymentId=query.payment_id||query.collection_id;
 if(paymentId&&/^\d{1,32}$/.test(paymentId))try{await reconcileMercadoPagoPayment({tenantId:tenant.id,paymentId,expectedExternalReference:query.reference})}catch(error){console.error("Mercado Pago return reconciliation failed",error)}
 const transaction=await platformDb.paymentTransaction.findFirst({where:{id:initial.id},include:{booking:{include:{service:true}}}});if(!transaction)notFound();
 const [title,description]=copy[transaction.status];const canRetry=transaction.checkoutUrl&&transaction.expiresAt&&transaction.expiresAt>new Date()&&transaction.status!=="PAID";
 return <main className="booking-page"><div className="booking-wrap"><div className="wizard success"><div className="success-icon">{transaction.status==="PAID"?"✓":"$"}</div><span className="eyebrow">Mercado Pago</span><h1>{title}</h1><p className="muted">{description}</p><div className="card payment-summary"><strong>{transaction.booking.service.name}</strong><span>{new Intl.NumberFormat("es-AR",{style:"currency",currency:transaction.currency}).format(transaction.amountCents/100)}</span></div>{canRetry&&<a className="button" href={transaction.checkoutUrl!}>Volver a Mercado Pago</a>}<Link className="button ghost" href="/">Volver a la agenda</Link></div></div></main>
}
