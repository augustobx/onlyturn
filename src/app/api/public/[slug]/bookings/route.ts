import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createPublicBooking } from "@/lib/public-booking";
import { getPublicTenant } from "@/lib/booking-service";
import { assertPublicCustomerAccess } from "@/lib/public-customer-access";

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const tenant = await getPublicTenant(slug);
    if (!tenant) return NextResponse.json({ error: "Agenda no disponible" }, { status: 404 });
    await assertPublicCustomerAccess(tenant);
    const result = await createPublicBooking({ ...(await request.json()), tenantSlug: slug });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof ZodError ? "Datos de reserva inválidos" : error instanceof Error ? error.message : "No se pudo crear la reserva";
    const status = error instanceof ZodError ? 400 : message.startsWith("Necesitás registrarte") ? 401 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
