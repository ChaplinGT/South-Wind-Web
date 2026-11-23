ALTER TABLE "PaymentOrder" ADD COLUMN "principalBob" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "fixedFeeUsd" TEXT;
ALTER TABLE "PaymentOrder" ADD COLUMN "fixedFeeBob" TEXT;

ALTER TABLE "LiquidacionBob" ADD COLUMN "fixedFeeUsd" TEXT;
ALTER TABLE "LiquidacionBob" ADD COLUMN "fixedFeeBearer" TEXT;
ALTER TABLE "LiquidacionBob" ADD COLUMN "netUsdcAmount" TEXT;
ALTER TABLE "LiquidacionBob" ADD COLUMN "rate" TEXT;
ALTER TABLE "LiquidacionBob" ADD COLUMN "bobAmount" TEXT;
ALTER TABLE "LiquidacionBob" ADD COLUMN "quotedAt" TIMESTAMP(3);

ALTER TABLE "VirtualAccount" ADD COLUMN "feeMode" TEXT;
