import { NextRequest, NextResponse } from "next/server";
import { buildCalendarFeed, verifyCalendarFeedToken } from "@/lib/calendar-feed";

export async function GET(request: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const token = request.nextUrl.searchParams.get("token") || "";
    const professionalId = request.nextUrl.searchParams.get("professionalId") || undefined;
    if (!verifyCalendarFeedToken(tenantId, token, professionalId)) return new NextResponse("Unauthorized", { status: 401 });
    const ics = await buildCalendarFeed(tenantId, professionalId);
    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "inline; filename=onlyturn.ics",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new NextResponse("Calendar unavailable", { status: 404 });
  }
}
