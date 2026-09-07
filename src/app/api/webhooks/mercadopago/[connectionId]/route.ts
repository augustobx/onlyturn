import { NextResponse } from "next/server";
import { MercadoPagoReconciliationError, reconcileMercadoPagoPayment } from "@/lib/payments/reconcile-mercadopago";

export async function POST(request:Request,{params}:{params:Promise<{connectionId:string}>}){
 try{
  const contentLength=Number(request.headers.get("content-length")||0);if(contentLength>64*1024)return NextResponse.json({error:"Payload too large"},{status:413});
  const rawBody=await request.text();if(rawBody.length>64*1024)return NextResponse.json({error:"Payload too large"},{status:413});
  const body=JSON.parse(rawBody||"{}") as {type?:string;topic?:string;data?:{id?:string|number}};const url=new URL(request.url);const topic=body.type||body.topic||url.searchParams.get("type")||url.searchParams.get("topic");if(topic&&topic!=="payment")return NextResponse.json({ok:true});
  const bodyId=body.data?.id===undefined?null:String(body.data.id);const queryId=url.searchParams.get("data.id")||url.searchParams.get("id");if(queryId&&bodyId&&queryId!==bodyId)return NextResponse.json({error:"Payment id mismatch"},{status:400});
  const paymentId=queryId||bodyId;if(!paymentId||!/^\d{1,32}$/.test(paymentId))return NextResponse.json({error:"Invalid payment notification"},{status:400});
  const {connectionId}=await params;await reconcileMercadoPagoPayment({connectionId,paymentId});return NextResponse.json({ok:true});
 }catch(error){
  if(error instanceof MercadoPagoReconciliationError)return NextResponse.json({error:error.message},{status:error.status});
  console.error("Mercado Pago webhook processing failed",error);return NextResponse.json({error:"Webhook processing failed"},{status:500});
 }
}
