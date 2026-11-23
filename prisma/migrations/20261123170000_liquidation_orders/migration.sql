-- AlterTable
ALTER TABLE "Beneficiary" ADD COLUMN "liquidationId" TEXT;
ALTER TABLE "Beneficiary" ADD COLUMN "liquidationAddress" TEXT;
ALTER TABLE "Beneficiary" ADD COLUMN "liquidationChain" TEXT;
ALTER TABLE "VirtualAccount" ADD COLUMN "destinationMode" TEXT;

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "bobAmount" TEXT NOT NULL,
    "rate" TEXT NOT NULL,
    "usdcAmount" TEXT NOT NULL,
    "feePercent" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "txHash" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiquidacionBob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "virtualAccountId" TEXT,
    "bolivianAccountId" TEXT,
    "usdcAmount" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "reference" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LiquidacionBob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LiquidacionBob" ADD CONSTRAINT "LiquidacionBob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LiquidacionBob" ADD CONSTRAINT "LiquidacionBob_virtualAccountId_fkey" FOREIGN KEY ("virtualAccountId") REFERENCES "VirtualAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
