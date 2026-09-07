"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { platformDb } from "@/lib/db";

const paymentInput = z.object({
  bookingId: z.string().min(1),
  amount: z.coerce.number().positive().max(100_000_000),
  method: z.enum(["CASH", "TRANSFER", "CARD", "MERCADOPAGO", "OTHER"]),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(300).optional(),
});

export async function registerBookingPaymentAction(formData: FormData) {
  const { session, membership } = await requireTenantSession();
  if (!can(membership.role, membership.permissions, "bookings:manage")) throw new Error("No tenés permisos para registrar cobros.");
  const input = paymentInput.parse(Object.fromEntries(formData));
  const amountCents = Math.round(input.amount * 100);

  await platformDb.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({
      where: { id: input.bookingId, tenantId: membership.tenantId },
      include: { customer: { select: { firstName: true, lastName: true } }, service: { select: { name: true } } },
    });
    if (!booking) throw new Error("Turno inexistente.");
    if (booking.status === "CANCELLED") throw new Error("No se puede cobrar un turno cancelado.");
    const totalCents = booking.priceCents ?? 0;
    const remainingCents = Math.max(0, totalCents - booking.paymentAmountCents);
    if (totalCents > 0 && amountCents > remainingCents) throw new Error(`El cobro supera el saldo pendiente de ${(remainingCents / 100).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}.`);
    const newPaid = booking.paymentAmountCents + amountCents;
    const paymentStatus = totalCents > 0 && newPaid >= totalCents ? "PAID" : "AUTHORIZED";

    await tx.booking.update({ where: { id: booking.id }, data: { paymentAmountCents: newPaid, paymentStatus } });
    await tx.bookingHistory.create({
      data: {
        tenantId: membership.tenantId,
        bookingId: booking.id,
        actorId: session.userId,
        action: "PAYMENT_RECORDED",
        fromState: { paymentAmountCents: booking.paymentAmountCents, paymentStatus: booking.paymentStatus },
        toState: { paymentAmountCents: newPaid, paymentStatus, amountCents, method: input.method },
      },
    });
    await tx.auditLog.create({
      data: {
        scope: "TENANT",
        tenantId: membership.tenantId,
        actorId: session.userId,
        action: "payment.manual_recorded",
        entityType: "Booking",
        entityId: booking.id,
        metadata: {
          amountCents,
          method: input.method,
          reference: input.reference || null,
          notes: input.notes || null,
          customer: `${booking.customer.firstName} ${booking.customer.lastName ?? ""}`.trim(),
          service: booking.service.name,
        },
      },
    });
  });

  revalidatePath("/app/caja");
  revalidatePath("/caja");
  revalidatePath("/app/agenda");
  revalidatePath("/agenda");
}
