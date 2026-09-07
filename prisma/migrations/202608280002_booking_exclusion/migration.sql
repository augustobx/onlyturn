-- Active capacity-one assignments cannot overlap. Cancelled/no-show bookings remain
-- in history but no longer consume availability.
ALTER TABLE "Booking" ADD COLUMN "consumesCapacity" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_professional_no_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "professionalId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("professionalId" IS NOT NULL AND "consumesCapacity" = true);

ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_resource_no_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "resourceId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("resourceId" IS NOT NULL AND "consumesCapacity" = true);
