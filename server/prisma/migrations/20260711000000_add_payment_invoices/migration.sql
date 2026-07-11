CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

CREATE TABLE "PaymentInvoice" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "provider" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "authority" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentInvoice_authority_key" ON "PaymentInvoice"("authority");
CREATE INDEX "PaymentInvoice_userId_createdAt_idx" ON "PaymentInvoice"("userId", "createdAt");
CREATE INDEX "PaymentInvoice_provider_status_idx" ON "PaymentInvoice"("provider", "status");

ALTER TABLE "PaymentInvoice" ADD CONSTRAINT "PaymentInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
