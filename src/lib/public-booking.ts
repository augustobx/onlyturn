import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { platformDb } from "./db";
import { getAvailableSlots, getPublicTenant } from "./booking-service";
import { normalizeEmail, normalizePhone, randomToken, sha256 } from "./security";
import { assertPlanCapacity } from "./plans";
import { decryptPaymentCredentials } from "./payment-crypto";
import { createMercadoPagoCheckout, type MercadoPagoCredentials } from "./payments/mercadopago";
import { resolveServiceAddons } from "./service-addons";

export const publicBookingSchema = z.object({
  tenantSlug: z.string(),
  locationId: z.string(),
  serviceId: z.string(),
  professionalId: z.string().optional(),
  resourceId: z.string().optional(),
  sessionId: z.string().optional(),
  addonIds: z.array(z.string()).default([]),
  startsAt: z.iso.datetime().optional(),
  partySize: z.coerce.number().int().min(1).max(1000).default(1),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().max(80).optional(),
  phone: z.string().min(6).max(30),
  email: z.union([z.email(), z.literal("")]).optional(),
  customValues: z.record(z.string(), z.unknown()).default({}),
});

type PaymentPolicy = {
  enabled?: boolean;
  mode?: "DEPOSIT" | "FULL";
  percent?: number;
  holdMinutes?: number;
  provider?: string;
};

type AddonSnapshot = {
  addonId: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
  preparationMinutes: number;
};

function customFieldValueIsEmpty(value: unknown) {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

export async function createPublicBooking(raw: unknown) {
  const input = publicBookingSchema.parse(raw);
  const tenant = await getPublicTenant(input.tenantSlug);
  if (!tenant) throw new Error("Agenda no disponible");
  await assertPlanCapacity(tenant.id, "bookings");

  const service = await platformDb.service.findFirstOrThrow({
    where: { id: input.serviceId, tenantId: tenant.id, isActive: true, onlineEnabled: true },
    include: {
      locations: { select: { locationId: true } },
      professionals: { select: { professionalId: true } },
      resources: { select: { resourceId: true } },
    },
  });
  if (!service.locations.some((item) => item.locationId === input.locationId)) throw new Error("Este servicio no está disponible en la sede seleccionada");
  if (input.partySize < service.minPartySize || input.partySize > service.maxPartySize) throw new Error(`La reserva admite entre ${service.minPartySize} y ${service.maxPartySize} asistente(s)`);

  const addons = await resolveServiceAddons(tenant.id, service.id, input.addonIds);
  if ((service.bookingType === "CLASS" || service.bookingType === "EVENT") && addons.some((addon) => addon.durationMinutes || addon.preparationMinutes)) {
    throw new Error("Uno de los extras seleccionados modifica duración y no es compatible con una sesión programada");
  }
  const addonSnapshots: AddonSnapshot[] = addons.map((addon) => ({
    addonId: addon.id,
    name: addon.name,
    priceCents: addon.priceCents,
    durationMinutes: addon.durationMinutes,
    preparationMinutes: addon.preparationMinutes,
  }));
  const addonPriceCents = addonSnapshots.reduce((sum, addon) => sum + addon.priceCents, 0);
  const finalPriceCents = service.priceCents == null && addonPriceCents === 0
    ? null
    : (service.priceCents ?? 0) * input.partySize + addonPriceCents;

  const customFields = await platformDb.customField.findMany({
    where: { tenantId: tenant.id, isActive: true, OR: [{ serviceId: null }, { serviceId: service.id }] },
  });
  for (const field of customFields) {
    if (field.required && customFieldValueIsEmpty(input.customValues[field.id])) throw new Error(`Falta completar: ${field.label}`);
  }
  const customValues = customFields
    .filter((field) => input.customValues[field.id] !== undefined)
    .map((field) => ({ customFieldId: field.id, value: input.customValues[field.id] as Prisma.InputJsonValue }));

  const normalizedPhone = normalizePhone(input.phone);
  const customer = await platformDb.customer.upsert({
    where: { tenantId_normalizedPhone: { tenantId: tenant.id, normalizedPhone } },
    create: {
      tenantId: tenant.id,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      normalizedPhone,
      email: input.email || null,
      normalizedEmail: normalizeEmail(input.email),
    },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email || null,
      normalizedEmail: normalizeEmail(input.email),
    },
  });

  const paymentPolicy = (service.depositPolicy ?? {}) as PaymentPolicy;
  const payableAmountCents = finalPriceCents ?? 0;
  const paymentRequired = Boolean(paymentPolicy.enabled && payableAmountCents > 0 && paymentPolicy.provider === "MERCADOPAGO");
  const paymentAmountCents = paymentRequired
    ? Math.max(1, Math.round(payableAmountCents * (paymentPolicy.mode === "FULL" ? 1 : (paymentPolicy.percent ?? 30) / 100)))
    : 0;
  const paymentConnection = paymentRequired
    ? await platformDb.paymentProviderConnection.findUnique({ where: { tenantId_provider: { tenantId: tenant.id, provider: "MERCADOPAGO" } } })
    : null;
  if (paymentRequired && (!paymentConnection || paymentConnection.status !== "ACTIVE")) throw new Error("El cobro online no está disponible temporalmente");

  const publicToken = randomToken();

  try {
    const booking = service.bookingType === "CLASS" || service.bookingType === "EVENT"
      ? await createPublicSessionBooking({
          tenantId: tenant.id,
          customerId: customer.id,
          serviceId: service.id,
          locationId: input.locationId,
          sessionId: input.sessionId,
          partySize: input.partySize,
          publicTokenHash: sha256(publicToken),
          priceCents: finalPriceCents,
          paymentRequired,
          paymentAmountCents,
          customValues,
          addons: addonSnapshots,
        })
      : await createPublicTimedBooking({
          tenantId: tenant.id,
          customerId: customer.id,
          service,
          input,
          publicTokenHash: sha256(publicToken),
          priceCents: finalPriceCents,
          paymentRequired,
          paymentAmountCents,
          customValues,
          addons: addonSnapshots,
          timezone: tenant.timezone,
        });

    if (!paymentRequired) return { bookingId: booking.id, token: publicToken, paymentRequired: false };

    const externalReference = `ot_${randomToken(18)}`;
    const expiresAt = new Date(Date.now() + (paymentPolicy.holdMinutes ?? 15) * 60_000);
    const transaction = await platformDb.paymentTransaction.create({
      data: {
        tenantId: tenant.id,
        bookingId: booking.id,
        provider: "MERCADOPAGO",
        kind: paymentPolicy.mode ?? "DEPOSIT",
        externalReference,
        amountCents: paymentAmountCents,
        currency: tenant.currency,
        status: "PENDING",
        expiresAt,
      },
    });

    try {
      const credentials = decryptPaymentCredentials<MercadoPagoCredentials>(paymentConnection!.encryptedCredentials);
      const checkout = await createMercadoPagoCheckout({
        credentials,
        connectionId: paymentConnection!.id,
        externalReference,
        title: `${paymentPolicy.mode === "FULL" ? "Pago" : "Seña"} · ${service.name}`,
        description: `Reserva en ${tenant.name}`,
        amountCents: paymentAmountCents,
        currency: tenant.currency,
        payer: { name: input.firstName, surname: input.lastName, email: input.email || null },
        tenantSlug: tenant.slug,
        expiresAt,
      });
      await platformDb.paymentTransaction.update({ where: { id: transaction.id }, data: { preferenceId: checkout.preferenceId, checkoutUrl: checkout.checkoutUrl } });
      return { bookingId: booking.id, token: publicToken, paymentRequired: true, checkoutUrl: checkout.checkoutUrl, amountCents: paymentAmountCents };
    } catch (error) {
      await platformDb.$transaction([
        platformDb.paymentTransaction.update({ where: { id: transaction.id }, data: { status: "FAILED", rawStatus: "preference_error" } }),
        platformDb.booking.update({
          where: { id: booking.id },
          data: { status: "CANCELLED", consumesCapacity: false, paymentStatus: "FAILED", cancellationReason: "No se pudo iniciar el pago", cancelledAt: new Date() },
        }),
      ]);
      throw error;
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2004", "P2034"].includes(error.code)) throw new Error("La disponibilidad cambió mientras reservabas. Elegí otra opción.");
    throw error;
  }
}

async function createPublicTimedBooking({
  tenantId,
  customerId,
  service,
  input,
  publicTokenHash,
  priceCents,
  paymentRequired,
  paymentAmountCents,
  customValues,
  addons,
  timezone,
}: {
  tenantId: string;
  customerId: string;
  service: {
    id: string;
    durationMinutes: number;
    preparationMinutes: number;
    bufferMinutes: number;
    professionalMode: "NONE" | "OPTIONAL" | "REQUIRED";
    resourceMode: "NONE" | "OPTIONAL" | "REQUIRED";
    professionals: { professionalId: string }[];
    resources: { resourceId: string }[];
  };
  input: z.infer<typeof publicBookingSchema>;
  publicTokenHash: string;
  priceCents: number | null;
  paymentRequired: boolean;
  paymentAmountCents: number;
  customValues: Array<{ customFieldId: string; value: Prisma.InputJsonValue }>;
  addons: AddonSnapshot[];
  timezone: string;
}) {
  if (!input.startsAt) throw new Error("Elegí un horario");
  if (input.professionalId && !service.professionals.some((item) => item.professionalId === input.professionalId)) throw new Error("Profesional no habilitado para este servicio");
  if (input.resourceId && !service.resources.some((item) => item.resourceId === input.resourceId)) throw new Error("Recurso no habilitado para este servicio");
  if (service.professionalMode === "REQUIRED" && !input.professionalId) throw new Error("Seleccioná un profesional");
  if (service.resourceMode === "REQUIRED" && !input.resourceId) throw new Error("Seleccioná un recurso");

  const addonDuration = addons.reduce((sum, addon) => sum + addon.durationMinutes, 0);
  const addonPreparation = addons.reduce((sum, addon) => sum + addon.preparationMinutes, 0);
  const effectiveDurationMinutes = service.durationMinutes + addonDuration;
  const effectivePreparationMinutes = service.preparationMinutes + addonPreparation;
  const startsAt = new Date(input.startsAt);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(startsAt);
  const slots = await getAvailableSlots({
    tenantId,
    locationId: input.locationId,
    serviceId: input.serviceId,
    professionalId: input.professionalId,
    resourceId: input.resourceId,
    addonIds: input.addonIds,
    date,
  });
  if (!slots.some((slot) => slot.startsAt.getTime() === startsAt.getTime())) throw new Error("Ese horario ya no está disponible");

  const endsAt = new Date(startsAt.getTime() + effectiveDurationMinutes * 60_000);
  return platformDb.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        tenantId,
        locationId: input.locationId,
        serviceId: service.id,
        customerId,
        professionalId: input.professionalId || null,
        resourceId: input.resourceId || null,
        partySize: input.partySize,
        startsAt,
        endsAt,
        capacityStartsAt: new Date(startsAt.getTime() - effectivePreparationMinutes * 60_000),
        capacityEndsAt: new Date(endsAt.getTime() + service.bufferMinutes * 60_000),
        durationMinutes: effectiveDurationMinutes,
        priceCents,
        status: paymentRequired ? "PENDING" : "CONFIRMED",
        paymentStatus: paymentRequired ? "PENDING" : "NOT_REQUIRED",
        paymentAmountCents,
        origin: "PUBLIC",
        publicTokenHash,
      },
    });
    await tx.bookingHistory.create({
      data: {
        tenantId,
        bookingId: booking.id,
        action: "CREATED",
        toState: { status: booking.status, origin: "PUBLIC", paymentRequired, partySize: input.partySize, addonIds: input.addonIds },
      },
    });
    if (customValues.length) {
      await tx.customFieldValue.createMany({ data: customValues.map((entry) => ({ tenantId, bookingId: booking.id, customFieldId: entry.customFieldId, value: entry.value })) });
    }
    if (addons.length) {
      await tx.bookingAddon.createMany({
        data: addons.map((addon) => ({
          tenantId,
          bookingId: booking.id,
          addonId: addon.addonId,
          name: addon.name,
          quantity: 1,
          priceCents: addon.priceCents,
          durationMinutes: addon.durationMinutes,
        })),
      });
    }
    return booking;
  }, { isolationLevel: "Serializable" });
}

async function createPublicSessionBooking({
  tenantId,
  customerId,
  serviceId,
  locationId,
  sessionId,
  partySize,
  publicTokenHash,
  priceCents,
  paymentRequired,
  paymentAmountCents,
  customValues,
  addons,
}: {
  tenantId: string;
  customerId: string;
  serviceId: string;
  locationId: string;
  sessionId?: string;
  partySize: number;
  publicTokenHash: string;
  priceCents: number | null;
  paymentRequired: boolean;
  paymentAmountCents: number;
  customValues: Array<{ customFieldId: string; value: Prisma.InputJsonValue }>;
  addons: AddonSnapshot[];
}) {
  if (!sessionId) throw new Error("Elegí una sesión");

  return platformDb.$transaction(async (tx) => {
    const session = await tx.bookingSession.findFirst({
      where: {
        id: sessionId,
        tenantId,
        serviceId,
        locationId,
        status: "SCHEDULED",
        onlineEnabled: true,
        startsAt: { gt: new Date() },
      },
    });
    if (!session) throw new Error("La sesión ya no está disponible");

    const aggregate = await tx.booking.aggregate({
      where: { tenantId, sessionId: session.id, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      _sum: { partySize: true },
    });
    const occupied = aggregate._sum.partySize ?? 0;
    if (occupied + partySize > session.capacity) throw new Error("No quedan suficientes cupos en esta sesión");

    const booking = await tx.booking.create({
      data: {
        tenantId,
        locationId,
        serviceId,
        customerId,
        sessionId: session.id,
        partySize,
        professionalId: null,
        resourceId: null,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        capacityStartsAt: session.startsAt,
        capacityEndsAt: session.endsAt,
        durationMinutes: Math.max(1, Math.round((session.endsAt.getTime() - session.startsAt.getTime()) / 60_000)),
        priceCents,
        status: paymentRequired ? "PENDING" : "CONFIRMED",
        consumesCapacity: false,
        paymentStatus: paymentRequired ? "PENDING" : "NOT_REQUIRED",
        paymentAmountCents,
        origin: "PUBLIC",
        publicTokenHash,
      },
    });
    await tx.bookingHistory.create({
      data: {
        tenantId,
        bookingId: booking.id,
        action: "CREATED",
        toState: { status: booking.status, origin: "PUBLIC", sessionId: session.id, partySize, paymentRequired, addonIds: addons.map((addon) => addon.addonId) },
      },
    });
    if (customValues.length) {
      await tx.customFieldValue.createMany({ data: customValues.map((entry) => ({ tenantId, bookingId: booking.id, customFieldId: entry.customFieldId, value: entry.value })) });
    }
    if (addons.length) {
      await tx.bookingAddon.createMany({
        data: addons.map((addon) => ({
          tenantId,
          bookingId: booking.id,
          addonId: addon.addonId,
          name: addon.name,
          quantity: 1,
          priceCents: addon.priceCents,
          durationMinutes: 0,
        })),
      });
    }
    return booking;
  }, { isolationLevel: "Serializable" });
}
