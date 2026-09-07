import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { createPublicBooking } from "@/lib/public-booking";

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const result = await createPublicBooking({ ...(await request.json()), tenantSlug: slug });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof ZodError ? "Datos de reserva inválidos" : error instanceof Error ? error.message : "No se pudo crear la reserva";
    return NextResponse.json({ error: message }, { status: error instanceof ZodError ? 400 : 409 });
  }
}
