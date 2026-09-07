import "server-only";

import { platformDb } from "./db";

export async function expirePendingBookingPayments(tenantId: string) {
  const expired = await platformDb.paymentTransaction.findMany({
    where: {
      tenantId,
      expiresAt: { lt: new Date() },
      status: { in: ["PENDING", "FAILED"] },
      booking: { status: "PENDING" },
    },
    select: { id: true, bookingId: true },
  });
  if (!expired.length) return 0;

  await platformDb.$transaction([
    platformDb.booking.updateMany({
      where: { tenantId, id: { in: expired.map((item) => item.bookingId) }, status: "PENDING" },
      data: {
        status: "CANCELLED",
        consumesCapacity: false,
        paymentStatus: "FAILED",
        cancellationReason: "Tiempo de pago vencido",
        cancelledAt: new Date(),
      },
    }),
    platformDb.paymentTransaction.updateMany({
      where: { id: { in: expired.map((item) => item.id) } },
      data: { status: "FAILED", rawStatus: "expired" },
    }),
  ]);

  return expired.length;
}
