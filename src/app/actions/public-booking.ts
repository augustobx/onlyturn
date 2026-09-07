"use server";

import { createPublicBooking } from "@/lib/public-booking";
import { getPublicTenant } from "@/lib/booking-service";
import { assertPublicCustomerAccess } from "@/lib/public-customer-access";

export async function createPublicBookingAction(raw: unknown) {
  if (raw && typeof raw === "object" && "tenantSlug" in raw && typeof raw.tenantSlug === "string") {
    const tenant = await getPublicTenant(raw.tenantSlug);
    if (tenant) await assertPublicCustomerAccess(tenant);
  }
  return createPublicBooking(raw);
}
