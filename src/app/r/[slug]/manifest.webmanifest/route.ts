import { NextResponse } from "next/server";
import { getPublicTenant } from "@/lib/booking-service";

export async function GET(_:Request,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const tenant=await getPublicTenant(slug);if(!tenant)return NextResponse.json({error:"Not found"},{status:404});
 const branding=tenant.branding as {primaryColor?:string;logoUrl?:string};
 return NextResponse.json({name:`${tenant.name} · Reservas`,short_name:tenant.name,start_url:`/r/${slug}`,scope:`/r/${slug}`,display:"standalone",background_color:"#f6f7fb",theme_color:branding.primaryColor??"#5b5cf0",icons:branding.logoUrl?[{src:branding.logoUrl,sizes:"512x512",purpose:"any maskable"}]:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any maskable"}]},{headers:{"Content-Type":"application/manifest+json","Cache-Control":"public, max-age=300"}});
}
