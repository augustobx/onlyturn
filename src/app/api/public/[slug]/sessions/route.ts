import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPublicTenant } from "@/lib/booking-service";
import { getPublicSessions } from "@/lib/public-sessions";

const query = z.object({
  locationId: z.string().min(1),
  serviceId: z.string().min(1),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const tenant = await getPublicTenant(slug);
    if (!tenant) return NextResponse.json({ error: "Agenda no disponible" }, { status: 404 });
    const parsed = query.parse(Object.fromEntries(request.nextUrl.searchParams));
    const sessions = await getPublicSessions({ tenantId: tenant.id, ...parsed });
    return NextResponse.json({
      sessions: sessions.map((session) => ({
        ...session,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Solicitud inválida" }, { status: 400 });
  }
}
