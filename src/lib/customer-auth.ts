import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { platformDb } from "./db";
import { randomToken, sha256 } from "./security";

const COOKIE_NAME="ot_customer_session";const SESSION_DAYS=30;

export async function createCustomerSession(accountId:string,tenantId:string){
 const token=randomToken();await platformDb.customerSession.create({data:{id:randomToken(18),accountId,tenantId,tokenHash:sha256(token),expiresAt:new Date(Date.now()+SESSION_DAYS*86_400_000)}});
 (await cookies()).set(COOKIE_NAME,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production"||process.env.COOKIE_SECURE==="true",path:"/",maxAge:SESSION_DAYS*86_400});
}

export async function getCustomerSession(tenantId?:string){
 const token=(await cookies()).get(COOKIE_NAME)?.value;if(!token)return null;
 return platformDb.customerSession.findFirst({where:{tokenHash:sha256(token),expiresAt:{gt:new Date()},...(tenantId?{tenantId}:{}),account:{status:"ACTIVE"}},include:{account:{include:{customer:true,tenant:true}}}});
}

export async function requireCustomerSession(tenantId:string,_slug:string){const session=await getCustomerSession(tenantId);if(!session)redirect("/cuenta");return session}

export async function destroyCustomerSession(){const jar=await cookies();const token=jar.get(COOKIE_NAME)?.value;if(token)await platformDb.customerSession.deleteMany({where:{tokenHash:sha256(token)}});jar.delete(COOKIE_NAME)}
