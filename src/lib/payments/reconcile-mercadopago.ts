import "server-only";
import { platformDb } from "@/lib/db";
import { decryptPaymentCredentials } from "@/lib/payment-crypto";
import { getMercadoPagoPayment, mapMercadoPagoStatus, type MercadoPagoCredentials } from "./mercadopago";

export class MercadoPagoReconciliationError extends Error {
  constructor(message:string,public readonly status:number){super(message);this.name="MercadoPagoReconciliationError"}
}

export async function reconcileMercadoPagoPayment(input:{paymentId:string;connectionId?:string;tenantId?:string;expectedExternalReference?:string}){
  if(!/^\d{1,32}$/.test(input.paymentId))throw new MercadoPagoReconciliationError("Invalid payment id",400);
  const connection=input.connectionId
    ?await platformDb.paymentProviderConnection.findFirst({where:{id:input.connectionId,provider:"MERCADOPAGO",status:"ACTIVE"}})
    :input.tenantId?await platformDb.paymentProviderConnection.findUnique({where:{tenantId_provider:{tenantId:input.tenantId,provider:"MERCADOPAGO"}}}):null;
  if(!connection||connection.status!=="ACTIVE")throw new MercadoPagoReconciliationError("Unknown connection",404);
  const credentials=decryptPaymentCredentials<MercadoPagoCredentials>(connection.encryptedCredentials);
  const payment=await getMercadoPagoPayment(credentials.accessToken,input.paymentId);
  const externalReference=payment.external_reference;if(!externalReference)return null;
  if(input.expectedExternalReference&&externalReference!==input.expectedExternalReference)throw new MercadoPagoReconciliationError("Payment reference mismatch",422);
  const transaction=await platformDb.paymentTransaction.findFirst({where:{externalReference,tenantId:connection.tenantId,provider:"MERCADOPAGO"},include:{booking:true}});if(!transaction)return null;
  const amountMatches=Math.round((payment.transaction_amount??0)*100)===transaction.amountCents&&payment.currency_id===transaction.currency;if(!amountMatches)throw new MercadoPagoReconciliationError("Payment amount mismatch",422);
  const status=mapMercadoPagoStatus(payment.status);const paymentId=payment.id?String(payment.id):input.paymentId;
  await platformDb.$transaction(async tx=>{
    await tx.paymentTransaction.update({where:{id:transaction.id},data:{status,paymentId,rawStatus:payment.status}});
    if(status==="PAID"&&transaction.booking.paymentStatus!=="PAID"){
      await tx.booking.update({where:{id:transaction.bookingId},data:{paymentStatus:"PAID",status:"CONFIRMED",consumesCapacity:true}});
      await tx.bookingHistory.create({data:{tenantId:connection.tenantId,bookingId:transaction.bookingId,action:"PAYMENT_APPROVED",fromState:{paymentStatus:transaction.booking.paymentStatus},toState:{paymentStatus:"PAID",paymentId}}});
    }else if(["REFUNDED","PARTIALLY_REFUNDED"].includes(status))await tx.booking.update({where:{id:transaction.bookingId},data:{paymentStatus:status}});
  });
  return{transactionId:transaction.id,externalReference,status};
}
