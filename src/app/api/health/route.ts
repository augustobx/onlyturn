import { NextResponse } from "next/server";
import { platformDb } from "@/lib/db";
export async function GET(){try{await platformDb.$queryRaw`SELECT 1`;return NextResponse.json({status:"ok",database:"ok",timestamp:new Date().toISOString()})}catch{return NextResponse.json({status:"error",database:"unavailable"},{status:503})}}
