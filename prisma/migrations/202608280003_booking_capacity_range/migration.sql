ALTER TABLE "Booking" ADD COLUMN "capacityStartsAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "capacityEndsAt" TIMESTAMP(3);

UPDATE "Booking" SET "capacityStartsAt" = "startsAt", "capacityEndsAt" = "endsAt";

ALTER TABLE "Booking" ALTER COLUMN "capacityStartsAt" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "capacityEndsAt" SET NOT NULL;

ALTER TABLE "Booking" DROP CONSTRAINT "booking_professional_no_overlap";
ALTER TABLE "Booking" DROP CONSTRAINT "booking_resource_no_overlap";

ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_professional_no_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "professionalId" WITH =,
    tsrange("capacityStartsAt", "capacityEndsAt", '[)') WITH &&
  ) WHERE ("professionalId" IS NOT NULL AND "consumesCapacity" = true);

ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_resource_no_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "resourceId" WITH =,
    tsrange("capacityStartsAt", "capacityEndsAt", '[)') WITH &&
  ) WHERE ("resourceId" IS NOT NULL AND "consumesCapacity" = true);

CREATE INDEX "Booking_tenantId_capacityStartsAt_capacityEndsAt_idx"
  ON "Booking"("tenantId", "capacityStartsAt", "capacityEndsAt");
