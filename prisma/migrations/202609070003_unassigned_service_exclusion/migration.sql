-- If a booking does not use a professional or resource, the service/location pair
-- becomes the capacity owner. This keeps generic agendas from being overbooked.
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_unassigned_service_no_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "locationId" WITH =,
    "serviceId" WITH =,
    tsrange("capacityStartsAt", "capacityEndsAt", '[)') WITH &&
  ) WHERE (
    "professionalId" IS NULL
    AND "resourceId" IS NULL
    AND "consumesCapacity" = true
  );
