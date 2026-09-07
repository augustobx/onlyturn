import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAvailableSlots, getPublicTenant } from "@/lib/booking-service";
import { assertPublicCustomerAccess } from "@/lib/public-customer-access";

const query = z.object({
  locationId: z.string().min(1),
  serviceId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  professionalId: z.string().optional(),
  resourceId: z.string().optional(),
  addons: z.string().optional(),
});

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const tenant = await getPublicTenant(slug);
    if (!tenant) return NextResponse.json({ error: "Agenda no disponible" }, { status: 404 });
    await assertPublicCustomerAccess(tenant);
    const parsed = query.parse(Object.fromEntries(request.nextUrl.searchParams));
    const addonIds = parsed.addons ? parsed.addons.split(",").filter(Boolean) : [];
    const days: Array<{ date: string; slots: string[] }> = [];

    for (let offset = 1; offset <= 21 && days.length < 4; offset += 1) {
      const date = addDays(parsed.startDate, offset);
      const slots = await getAvailableSlots({
        tenantId: tenant.id,
        locationId: parsed.locationId,
        serviceId: parsed.serviceId,
        date,
        professionalId: parsed.professionalId,
        resourceId: parsed.resourceId,
        addonIds,
      });
      const uniqueSlots = [...new Set(slots.map((slot) => slot.startsAt.toISOString()))];
      if (uniqueSlots.length) days.push({ date, slots: uniqueSlots.slice(0, 5) });
    }

    return NextResponse.json({ days }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Solicitud inválida";
    return NextResponse.json({ error: message }, { status: message.startsWith("Necesitás registrarte") ? 401 : 400 });
  }
}
