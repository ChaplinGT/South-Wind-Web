-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'BO',
    "clientType" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "bridgeCustomerId" TEXT,
    "bridgeWalletId" TEXT,
    "walletAddress" TEXT,
    "walletChain" TEXT,
    "kybStatus" TEXT NOT NULL DEFAULT 'not_started',
    "bridgeKycStatus" TEXT,
    "kybLinkUrl" TEXT,
    "tosLinkUrl" TEXT,
    "onboardingSource" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BolivianAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BolivianAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bridgeExternalAccountId" TEXT,
    "nickname" TEXT NOT NULL,
    "rail" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "accountOwnerName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountLast4" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "detailsJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bridgeVirtualAccountId" TEXT,
    "status" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "instructionsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VirtualAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bridgeTransferId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "developerFee" TEXT NOT NULL,
    "totalDebit" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "rail" TEXT NOT NULL,
    "beneficiaryId" TEXT,
    "beneficiaryName" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responseJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "sourceCurrency" TEXT NOT NULL,
    "targetCurrency" TEXT NOT NULL,
    "bolivianAccountId" TEXT,
    "bankSnapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "reference" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionReceipt" (
    "conversionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "ConversionReceipt_pkey" PRIMARY KEY ("conversionId")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "debit" TEXT NOT NULL DEFAULT '0.00',
    "credit" TEXT NOT NULL DEFAULT '0.00',
    "currency" TEXT NOT NULL DEFAULT 'usdc',
    "transferId" TEXT,
    "conversionId" TEXT,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "statementNumber" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "openingBalance" TEXT NOT NULL,
    "closingBalance" TEXT NOT NULL,
    "totalDebits" TEXT NOT NULL,
    "totalCredits" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usdc',
    "verificationCode" TEXT NOT NULL,
    "linesJson" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "companyId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseJson" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "BridgeMockState" (
    "id" TEXT NOT NULL,
    "json" TEXT NOT NULL,

    CONSTRAINT "BridgeMockState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_nit_key" ON "Company"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "Company_bridgeCustomerId_key" ON "Company"("bridgeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualAccount_bridgeVirtualAccountId_key" ON "VirtualAccount"("bridgeVirtualAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_bridgeTransferId_key" ON "Transfer"("bridgeTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_idempotencyKey_key" ON "Transfer"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LedgerEntry_companyId_postedAt_idx" ON "LedgerEntry"("companyId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_statementNumber_key" ON "Statement"("statementNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_verificationCode_key" ON "Statement"("verificationCode");

-- CreateIndex
CREATE INDEX "Statement_companyId_idx" ON "Statement"("companyId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_key_key" ON "IdempotencyRecord"("key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BolivianAccount" ADD CONSTRAINT "BolivianAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualAccount" ADD CONSTRAINT "VirtualAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionRequest" ADD CONSTRAINT "ConversionRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionReceipt" ADD CONSTRAINT "ConversionReceipt_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "ConversionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

