CREATE TYPE "CustomerPackageStatus" AS ENUM ('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "ServicePackage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "uses" INTEGER NOT NULL,
  "validityDays" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServicePackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServicePackageService" (
  "tenantId" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  CONSTRAINT "ServicePackageService_pkey" PRIMARY KEY ("packageId", "serviceId")
);

CREATE TABLE "CustomerPackage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "purchasedPriceCents" INTEGER NOT NULL DEFAULT 0,
  "totalUses" INTEGER NOT NULL,
  "remainingUses" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "status" "CustomerPackageStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PackageUsage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerPackageId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "uses" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PackageUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PackageUsage_bookingId_key" ON "PackageUsage"("bookingId");
CREATE INDEX "ServicePackage_tenantId_isActive_name_idx" ON "ServicePackage"("tenantId", "isActive", "name");
CREATE INDEX "ServicePackageService_tenantId_serviceId_idx" ON "ServicePackageService"("tenantId", "serviceId");
CREATE INDEX "CustomerPackage_tenantId_customerId_status_expiresAt_idx" ON "CustomerPackage"("tenantId", "customerId", "status", "expiresAt");
CREATE INDEX "CustomerPackage_tenantId_packageId_idx" ON "CustomerPackage"("tenantId", "packageId");
CREATE INDEX "PackageUsage_tenantId_customerPackageId_createdAt_idx" ON "PackageUsage"("tenantId", "customerPackageId", "createdAt");

ALTER TABLE "ServicePackage" ADD CONSTRAINT "ServicePackage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServicePackageService" ADD CONSTRAINT "ServicePackageService_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ServicePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServicePackageService" ADD CONSTRAINT "ServicePackageService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ServicePackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackageUsage" ADD CONSTRAINT "PackageUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackageUsage" ADD CONSTRAINT "PackageUsage_customerPackageId_fkey" FOREIGN KEY ("customerPackageId") REFERENCES "CustomerPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackageUsage" ADD CONSTRAINT "PackageUsage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
