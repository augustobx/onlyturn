CREATE TABLE "PaymentProviderConnection" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "encryptedCredentials" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentProviderConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentTransaction" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "externalReference" TEXT NOT NULL,
  "preferenceId" TEXT,
  "paymentId" TEXT,
  "checkoutUrl" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3),
  "rawStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentProviderConnection_tenantId_provider_key" ON "PaymentProviderConnection"("tenantId", "provider");
CREATE INDEX "PaymentProviderConnection_tenantId_status_idx" ON "PaymentProviderConnection"("tenantId", "status");
CREATE UNIQUE INDEX "PaymentTransaction_externalReference_key" ON "PaymentTransaction"("externalReference");
CREATE UNIQUE INDEX "PaymentTransaction_preferenceId_key" ON "PaymentTransaction"("preferenceId");
CREATE UNIQUE INDEX "PaymentTransaction_paymentId_key" ON "PaymentTransaction"("paymentId");
CREATE INDEX "PaymentTransaction_tenantId_createdAt_idx" ON "PaymentTransaction"("tenantId", "createdAt");
CREATE INDEX "PaymentTransaction_bookingId_status_idx" ON "PaymentTransaction"("bookingId", "status");
CREATE INDEX "PaymentTransaction_status_expiresAt_idx" ON "PaymentTransaction"("status", "expiresAt");
ALTER TABLE "PaymentProviderConnection" ADD CONSTRAINT "PaymentProviderConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
