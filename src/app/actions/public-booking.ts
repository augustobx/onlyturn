"use server";

import { createPublicBooking } from "@/lib/public-booking";
import { getPublicTenant } from "@/lib/booking-service";
import { getCustomerSession } from "@/lib/customer-auth";

export async function createPublicBookingAction(raw: unknown) {
  if (raw && typeof raw === "object" && "tenantSlug" in raw && typeof raw.tenantSlug === "string") {
    const tenant = await getPublicTenant(raw.tenantSlug);
    if (tenant) {
      const settings = tenant.settings as { customerRegistrationEnabled?: boolean };
      if (settings.customerRegistrationEnabled && !await getCustomerSession(tenant.id)) {
        throw new Error("Necesitás registrarte e ingresar a tu cuenta antes de reservar.");
      }
    }
  }
  return createPublicBooking(raw);
}
