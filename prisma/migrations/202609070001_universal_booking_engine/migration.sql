-- Universal booking engine: additive migration. Existing appointment behavior remains the default.

CREATE TYPE "BookingType" AS ENUM ('APPOINTMENT', 'CLASS', 'EVENT', 'RESOURCE');
CREATE TYPE "AssignmentStrategy" AS ENUM ('CLIENT_CHOOSES', 'ANY_AVAILABLE', 'ROUND_ROBIN', 'MANUAL');
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'OFFERED', 'BOOKED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "RecurrenceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

ALTER TABLE "Service"
  ADD COLUMN "bookingType" "BookingType" NOT NULL DEFAULT 'APPOINTMENT',
  ADD COLUMN "assignmentStrategy" "AssignmentStrategy" NOT NULL DEFAULT 'CLIENT_CHOOSES',
  ADD COLUMN "minPartySize" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "maxPartySize" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "bookingPolicy" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "allowWaitlist" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowRecurring" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Booking"
  ADD COLUMN "sessionId" TEXT,
  ADD COLUMN "seriesId" TEXT,
  ADD COLUMN "partySize" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "ServiceAddon" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "durationMinutes" INTEGER NOT NULL DEFAULT 0,
  "preparationMinutes" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceAddon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingSeries" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT,
  "serviceId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "professionalId" TEXT,
  "resourceId" TEXT,
  "bookingType" "BookingType" NOT NULL,
  "rrule" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "anchorStartsAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "status" "RecurrenceStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingSeries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingSession" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "professionalId" TEXT,
  "resourceId" TEXT,
  "seriesId" TEXT,
  "title" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "capacityStartsAt" TIMESTAMP(3) NOT NULL,
  "capacityEndsAt" TIMESTAMP(3) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "onlineEnabled" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WaitlistEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "professionalId" TEXT,
  "resourceId" TEXT,
  "sessionId" TEXT,
  "bookedBookingId" TEXT,
  "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
  "partySize" INTEGER NOT NULL DEFAULT 1,
  "preferredFrom" TIMESTAMP(3),
  "preferredUntil" TIMESTAMP(3),
  "preferences" JSONB NOT NULL DEFAULT '{}',
  "offeredAt" TIMESTAMP(3),
  "offerExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingAddon" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "addonId" TEXT,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "durationMinutes" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingAddon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationRule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "offsetMinutes" INTEGER NOT NULL DEFAULT 0,
  "template" JSONB NOT NULL,
  "filters" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WaitlistEntry_bookedBookingId_key" ON "WaitlistEntry"("bookedBookingId");
CREATE INDEX "Service_tenantId_bookingType_isActive_idx" ON "Service"("tenantId", "bookingType", "isActive");
CREATE INDEX "ServiceAddon_tenantId_serviceId_isActive_sortOrder_idx" ON "ServiceAddon"("tenantId", "serviceId", "isActive", "sortOrder");
CREATE INDEX "Booking_tenantId_sessionId_idx" ON "Booking"("tenantId", "sessionId");
CREATE INDEX "Booking_tenantId_seriesId_idx" ON "Booking"("tenantId", "seriesId");
CREATE INDEX "BookingSeries_tenantId_status_anchorStartsAt_idx" ON "BookingSeries"("tenantId", "status", "anchorStartsAt");
CREATE INDEX "BookingSeries_tenantId_customerId_idx" ON "BookingSeries"("tenantId", "customerId");
CREATE INDEX "BookingSeries_tenantId_serviceId_idx" ON "BookingSeries"("tenantId", "serviceId");
CREATE INDEX "BookingSession_tenantId_startsAt_endsAt_idx" ON "BookingSession"("tenantId", "startsAt", "endsAt");
CREATE INDEX "BookingSession_tenantId_locationId_startsAt_idx" ON "BookingSession"("tenantId", "locationId", "startsAt");
CREATE INDEX "BookingSession_tenantId_professionalId_startsAt_idx" ON "BookingSession"("tenantId", "professionalId", "startsAt");
CREATE INDEX "BookingSession_tenantId_resourceId_startsAt_idx" ON "BookingSession"("tenantId", "resourceId", "startsAt");
CREATE INDEX "BookingSession_tenantId_serviceId_status_startsAt_idx" ON "BookingSession"("tenantId", "serviceId", "status", "startsAt");
CREATE INDEX "WaitlistEntry_tenantId_status_createdAt_idx" ON "WaitlistEntry"("tenantId", "status", "createdAt");
CREATE INDEX "WaitlistEntry_tenantId_serviceId_locationId_status_idx" ON "WaitlistEntry"("tenantId", "serviceId", "locationId", "status");
CREATE INDEX "WaitlistEntry_tenantId_sessionId_status_idx" ON "WaitlistEntry"("tenantId", "sessionId", "status");
CREATE INDEX "BookingAddon_tenantId_bookingId_idx" ON "BookingAddon"("tenantId", "bookingId");
CREATE INDEX "BookingAddon_tenantId_addonId_idx" ON "BookingAddon"("tenantId", "addonId");
CREATE INDEX "AutomationRule_tenantId_event_isActive_idx" ON "AutomationRule"("tenantId", "event", "isActive");

ALTER TABLE "ServiceAddon" ADD CONSTRAINT "ServiceAddon_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceAddon" ADD CONSTRAINT "ServiceAddon_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookingSession" ADD CONSTRAINT "BookingSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSession" ADD CONSTRAINT "BookingSession_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSession" ADD CONSTRAINT "BookingSession_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSession" ADD CONSTRAINT "BookingSession_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSession" ADD CONSTRAINT "BookingSession_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSession" ADD CONSTRAINT "BookingSession_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "BookingSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingSession" ADD CONSTRAINT "BookingSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BookingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "BookingSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BookingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_bookedBookingId_fkey" FOREIGN KEY ("bookedBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookingAddon" ADD CONSTRAINT "BookingAddon_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingAddon" ADD CONSTRAINT "BookingAddon_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingAddon" ADD CONSTRAINT "BookingAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "ServiceAddon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
