import "server-only";

import { platformDb } from "./db";
import { restorePackageUsageForBooking } from "./packages";

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

  await platformDb.$transaction(async (tx) => {
    await tx.booking.updateMany({
      where: { tenantId, id: { in: expired.map((item) => item.bookingId) }, status: "PENDING" },
      data: {
        status: "CANCELLED",
        consumesCapacity: false,
        paymentStatus: "FAILED",
        cancellationReason: "Tiempo de pago vencido",
        cancelledAt: new Date(),
      },
    });
    await tx.paymentTransaction.updateMany({
      where: { id: { in: expired.map((item) => item.id) } },
      data: { status: "FAILED", rawStatus: "expired" },
    });
    for (const item of expired) await restorePackageUsageForBooking(tx, tenantId, item.bookingId);
  });

  return expired.length;
}
