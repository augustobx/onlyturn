import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { platformDb } from "./db";
import { getAvailableSlots, getPublicTenant } from "./booking-service";
import { createTenantDb } from "./tenant-db";
import { normalizeEmail, normalizePhone, randomToken, sha256 } from "./security";
import { assertPlanCapacity } from "./plans";
import { decryptPaymentCredentials } from "./payment-crypto";
import { createMercadoPagoCheckout, type MercadoPagoCredentials } from "./payments/mercadopago";

export const publicBookingSchema = z.object({
  tenantSlug: z.string(), locationId: z.string(), serviceId: z.string(), professionalId: z.string().optional(), resourceId: z.string().optional(),
  startsAt: z.iso.datetime(), firstName: z.string().trim().min(2).max(80), lastName: z.string().trim().max(80).optional(),
  phone: z.string().min(6).max(30), email: z.union([z.email(), z.literal("")]).optional(),
  customValues: z.record(z.string(), z.unknown()).default({})
});

export async function createPublicBooking(raw: unknown) {
  const input = publicBookingSchema.parse(raw);
  const tenant = await getPublicTenant(input.tenantSlug);
  if (!tenant) throw new Error("Agenda no disponible");
  await assertPlanCapacity(tenant.id, "bookings");
  const service = await platformDb.service.findFirstOrThrow({ where: { id: input.serviceId, tenantId: tenant.id, isActive: true, onlineEnabled: true } });
  const paymentPolicy=(service.depositPolicy??{}) as {enabled?:boolean;mode?:"DEPOSIT"|"FULL";percent?:number;holdMinutes?:number;provider?:string};
  const paymentRequired=Boolean(paymentPolicy.enabled&&service.priceCents&&service.priceCents>0&&paymentPolicy.provider==="MERCADOPAGO");
  const paymentConnection=paymentRequired?await platformDb.paymentProviderConnection.findUnique({where:{tenantId_provider:{tenantId:tenant.id,provider:"MERCADOPAGO"}}}):null;
  if(paymentRequired&&(!paymentConnection||paymentConnection.status!=="ACTIVE"))throw new Error("El cobro online no está disponible temporalmente");
  const paymentAmountCents=paymentRequired?Math.max(1,Math.round((service.priceCents??0)*(paymentPolicy.mode==="FULL"?1:(paymentPolicy.percent??30)/100))):0;
  const customFields = await platformDb.customField.findMany({ where: {
    tenantId: tenant.id, isActive: true, OR: [{ serviceId: null }, { serviceId: service.id }]
  }});
  for (const field of customFields) {
    const value = input.customValues[field.id];
    if (field.required && (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0))) {
      throw new Error(`Falta completar: ${field.label}`);
    }
  }
  const startsAt = new Date(input.startsAt);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: tenant.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(startsAt);
  const slots = await getAvailableSlots({ tenantId: tenant.id, locationId: input.locationId, serviceId: input.serviceId, professionalId: input.professionalId, resourceId: input.resourceId, date });
  if (!slots.some((s) => s.startsAt.getTime() === startsAt.getTime())) throw new Error("Ese horario ya no está disponible");
  const normalizedPhone = normalizePhone(input.phone);
  const customer = await platformDb.customer.upsert({
    where: { tenantId_normalizedPhone: { tenantId: tenant.id, normalizedPhone } },
    create: { tenantId: tenant.id, firstName: input.firstName, lastName: input.lastName, phone: input.phone, normalizedPhone, email: input.email || null, normalizedEmail: normalizeEmail(input.email) },
    update: { firstName: input.firstName, lastName: input.lastName, email: input.email || null, normalizedEmail: normalizeEmail(input.email) }
  });
  const publicToken = randomToken();
  try {
    const booking = await createTenantDb(tenant.id).createBooking({
      tenantId: tenant.id, locationId: input.locationId, serviceId: service.id, customerId: customer.id,
      professionalId: input.professionalId || null, resourceId: input.resourceId || null,
      startsAt, endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000),
      capacityStartsAt: new Date(startsAt.getTime() - service.preparationMinutes * 60_000),
      capacityEndsAt: new Date(startsAt.getTime() + (service.durationMinutes + service.bufferMinutes) * 60_000), durationMinutes: service.durationMinutes,
      priceCents: service.priceCents, status: paymentRequired?"PENDING":"CONFIRMED", paymentStatus:paymentRequired?"PENDING":"NOT_REQUIRED",paymentAmountCents,
      origin: "PUBLIC", publicTokenHash: sha256(publicToken)
    }, { tenantId: tenant.id, bookingId: "pending", action: "CREATED", toState: { status: paymentRequired?"PENDING":"CONFIRMED", origin: "PUBLIC",paymentRequired } },
    customFields.filter((field) => input.customValues[field.id] !== undefined).map((field) => ({ customFieldId: field.id, value: input.customValues[field.id] as Prisma.InputJsonValue })));
    if(!paymentRequired)return { bookingId: booking.id, token: publicToken, paymentRequired:false };
    const externalReference=`ot_${randomToken(18)}`;const expiresAt=new Date(Date.now()+(paymentPolicy.holdMinutes??15)*60_000);
    const transaction=await platformDb.paymentTransaction.create({data:{tenantId:tenant.id,bookingId:booking.id,provider:"MERCADOPAGO",kind:paymentPolicy.mode??"DEPOSIT",externalReference,amountCents:paymentAmountCents,currency:tenant.currency,status:"PENDING",expiresAt}});
    try{
      const credentials=decryptPaymentCredentials<MercadoPagoCredentials>(paymentConnection!.encryptedCredentials);
      const checkout=await createMercadoPagoCheckout({credentials,connectionId:paymentConnection!.id,externalReference,title:`${paymentPolicy.mode==="FULL"?"Pago":"Seña"} · ${service.name}`,description:`Reserva en ${tenant.name}`,amountCents:paymentAmountCents,currency:tenant.currency,payer:{name:input.firstName,surname:input.lastName,email:input.email||null},tenantSlug:tenant.slug,expiresAt});
      await platformDb.paymentTransaction.update({where:{id:transaction.id},data:{preferenceId:checkout.preferenceId,checkoutUrl:checkout.checkoutUrl}});
      return {bookingId:booking.id,token:publicToken,paymentRequired:true,checkoutUrl:checkout.checkoutUrl,amountCents:paymentAmountCents};
    }catch(error){
      await platformDb.$transaction([platformDb.paymentTransaction.update({where:{id:transaction.id},data:{status:"FAILED",rawStatus:"preference_error"}}),platformDb.booking.update({where:{id:booking.id},data:{status:"CANCELLED",consumesCapacity:false,paymentStatus:"FAILED",cancellationReason:"No se pudo iniciar el pago",cancelledAt:new Date()}})]);throw error;
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2004", "P2034"].includes(error.code)) throw new Error("Ese horario acaba de ser reservado");
    throw error;
  }
}
