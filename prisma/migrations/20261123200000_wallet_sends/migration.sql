ALTER TABLE "PaymentOrder" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'bob';
ALTER TABLE "PaymentOrder" ADD COLUMN "feeAddress" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "feeChain" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "feeLegStatus" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "paymentLegStatus" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "feeTxHash" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "paymentTxHash" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "drainId" TEXT;

CREATE UNIQUE INDEX "PaymentOrder_drainId_key" ON "PaymentOrder"("drainId");
