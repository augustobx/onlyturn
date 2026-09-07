import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAvailableSlots, getPublicTenant } from "@/lib/booking-service";

const query = z.object({
  locationId: z.string().min(1),
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  professionalId: z.string().optional(),
  resourceId: z.string().optional(),
  addons: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const tenant = await getPublicTenant(slug);
    if (!tenant) return NextResponse.json({ error: "Agenda no disponible" }, { status: 404 });
    const parsed = query.parse(Object.fromEntries(request.nextUrl.searchParams));
    const slots = await getAvailableSlots({
      tenantId: tenant.id,
      locationId: parsed.locationId,
      serviceId: parsed.serviceId,
      date: parsed.date,
      professionalId: parsed.professionalId,
      resourceId: parsed.resourceId,
      addonIds: parsed.addons ? parsed.addons.split(",").filter(Boolean) : [],
    });
    return NextResponse.json({ slots: slots.map((slot) => slot.startsAt.toISOString()) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Solicitud inválida" }, { status: 400 });
  }
}
