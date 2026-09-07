import { NextRequest, NextResponse } from "next/server";
import { findTenantOwnership, normalizeHostname } from "@/lib/tenant-context";

export async function GET(request: NextRequest) {
  const domain = normalizeHostname(request.nextUrl.searchParams.get("domain") || "");

  if (!domain) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const tenant = await findTenantOwnership(domain);
    if (!tenant) {
      return new NextResponse(null, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[OnlyTurn Ask Error]", error);
    return new NextResponse(null, { status: 500 });
  }
}
