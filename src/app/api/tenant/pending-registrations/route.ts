import { NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/auth";
import { platformDb } from "@/lib/db";

export async function GET(){
  try{
    const {membership}=await requireTenantSession();
    const count=await platformDb.customerAccount.count({where:{tenantId:membership.tenantId,status:"PENDING"}});
    return NextResponse.json({count},{headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({count:0},{status:401,headers:{"Cache-Control":"no-store"}});
  }
}
