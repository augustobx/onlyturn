-- A scheduled class/event session reserves its assigned professional/resource once,
-- independently from the attendee bookings linked to that session.
ALTER TABLE "BookingSession"
  ADD CONSTRAINT "booking_session_professional_no_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "professionalId" WITH =,
    tsrange("capacityStartsAt", "capacityEndsAt", '[)') WITH &&
  ) WHERE ("professionalId" IS NOT NULL AND "status" = 'SCHEDULED');

ALTER TABLE "BookingSession"
  ADD CONSTRAINT "booking_session_resource_no_overlap"
  EXCLUDE USING gist (
    "tenantId" WITH =,
    "resourceId" WITH =,
    tsrange("capacityStartsAt", "capacityEndsAt", '[)') WITH &&
  ) WHERE ("resourceId" IS NOT NULL AND "status" = 'SCHEDULED');
