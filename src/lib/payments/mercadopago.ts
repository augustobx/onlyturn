import "server-only";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

export type MercadoPagoCredentials={accessToken:string;publicKey?:string};
const client=(accessToken:string)=>new MercadoPagoConfig({accessToken,options:{timeout:8000}});

export async function createMercadoPagoCheckout(input:{credentials:MercadoPagoCredentials;connectionId:string;externalReference:string;title:string;description:string;amountCents:number;currency:string;payer:{name:string;surname?:string;email?:string|null};tenantSlug:string;expiresAt:Date}){
 const base=(process.env.APP_BASE_URL??"http://localhost:3000").replace(/\/$/,"");const resultUrl=`${base}/r/${input.tenantSlug}/payment?reference=${encodeURIComponent(input.externalReference)}`;
 const result=await new Preference(client(input.credentials.accessToken)).create({body:{items:[{id:input.externalReference,title:input.title,description:input.description,quantity:1,currency_id:input.currency,unit_price:input.amountCents/100}],payer:{name:input.payer.name,surname:input.payer.surname,email:input.payer.email??undefined},external_reference:input.externalReference,notification_url:`${base}/api/webhooks/mercadopago/${input.connectionId}`,back_urls:{success:`${resultUrl}&result=success`,pending:`${resultUrl}&result=pending`,failure:`${resultUrl}&result=failure`},auto_return:"approved",expires:true,expiration_date_from:new Date().toISOString(),expiration_date_to:input.expiresAt.toISOString(),statement_descriptor:"ONLYTURN"},requestOptions:{idempotencyKey:input.externalReference}});
 const checkoutUrl=input.credentials.accessToken.startsWith("TEST-")?result.sandbox_init_point??result.init_point:result.init_point;
 if(!result.id||!checkoutUrl)throw new Error("Mercado Pago no devolvió una preferencia válida");return{preferenceId:result.id,checkoutUrl};
}

export async function getMercadoPagoPayment(accessToken:string,paymentId:string){return new Payment(client(accessToken)).get({id:paymentId})}
export function mapMercadoPagoStatus(status?:string){if(status==="approved")return"PAID" as const;if(status==="authorized")return"AUTHORIZED" as const;if(status==="refunded")return"REFUNDED" as const;if(status==="partially_refunded")return"PARTIALLY_REFUNDED" as const;if(status==="rejected"||status==="cancelled")return"FAILED" as const;return"PENDING" as const}
