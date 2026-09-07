import "server-only";

import { subDays } from "date-fns";
import { platformDb } from "./db";

export async function getTenantReport(tenantId: string, days = 30) {
  const from = subDays(new Date(), days);
  const previousFrom = subDays(from, days);
  const [bookings, previousBookings, paidTransactions, customers, sessions] = await Promise.all([
    platformDb.booking.findMany({
      where: { tenantId, startsAt: { gte: from } },
      select: { id: true, customerId: true, serviceId: true, professionalId: true, status: true, partySize: true, priceCents: true, service: { select: { name: true } }, professional: { select: { name: true } } },
    }),
    platformDb.booking.count({ where: { tenantId, startsAt: { gte: previousFrom, lt: from } } }),
    platformDb.paymentTransaction.aggregate({ where: { tenantId, status: "PAID", updatedAt: { gte: from } }, _sum: { amountCents: true }, _count: true }),
    platformDb.customer.findMany({
      where: { tenantId, archivedAt: null },
      select: { id: true, createdAt: true, tags: true, bookings: { select: { startsAt: true, status: true }, orderBy: { startsAt: "asc" }, take: 2 } },
    }),
    platformDb.bookingSession.findMany({
      where: { tenantId, startsAt: { gte: from } },
      select: { capacity: true, bookings: { where: { status: { notIn: ["CANCELLED", "NO_SHOW"] } }, select: { partySize: true } } },
    }),
  ]);

  const completed = bookings.filter((item) => item.status === "COMPLETED").length;
  const cancelled = bookings.filter((item) => item.status === "CANCELLED").length;
  const noShow = bookings.filter((item) => item.status === "NO_SHOW").length;
  const activeBase = Math.max(1, bookings.filter((item) => item.status !== "CANCELLED").length);
  const serviceMap = new Map<string, { name: string; bookings: number; people: number; valueCents: number }>();
  const professionalMap = new Map<string, { name: string; bookings: number }>();
  for (const booking of bookings) {
    const service = serviceMap.get(booking.serviceId) ?? { name: booking.service.name, bookings: 0, people: 0, valueCents: 0 };
    service.bookings += 1;
    service.people += booking.partySize;
    service.valueCents += booking.priceCents ?? 0;
    serviceMap.set(booking.serviceId, service);
    if (booking.professionalId && booking.professional) {
      const professional = professionalMap.get(booking.professionalId) ?? { name: booking.professional.name, bookings: 0 };
      professional.bookings += 1;
      professionalMap.set(booking.professionalId, professional);
    }
  }

  const newCustomers = customers.filter((customer) => customer.createdAt >= from).length;
  const returningCustomers = customers.filter((customer) => customer.bookings.length >= 2 && customer.bookings[1].startsAt >= from).length;
  const tagMap = new Map<string, number>();
  for (const customer of customers) for (const tag of customer.tags) tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
  const totalSessionCapacity = sessions.reduce((sum, session) => sum + session.capacity, 0);
  const totalSessionOccupied = sessions.reduce((sum, session) => sum + session.bookings.reduce((inner, booking) => inner + booking.partySize, 0), 0);

  return {
    days,
    bookings: bookings.length,
    bookingGrowthPercent: previousBookings ? ((bookings.length - previousBookings) / previousBookings) * 100 : bookings.length ? 100 : 0,
    completed,
    cancelled,
    cancellationRate: bookings.length ? (cancelled / bookings.length) * 100 : 0,
    noShow,
    noShowRate: (noShow / activeBase) * 100,
    paidCents: paidTransactions._sum.amountCents ?? 0,
    paidTransactions: paidTransactions._count,
    newCustomers,
    returningCustomers,
    totalCustomers: customers.length,
    sessionOccupancy: totalSessionCapacity ? (totalSessionOccupied / totalSessionCapacity) * 100 : 0,
    services: [...serviceMap.values()].sort((a, b) => b.bookings - a.bookings),
    professionals: [...professionalMap.values()].sort((a, b) => b.bookings - a.bookings),
    tags: [...tagMap.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
  };
}
