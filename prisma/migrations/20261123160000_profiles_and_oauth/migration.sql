-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "googleSub" TEXT;
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "Company" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'empresa';
ALTER TABLE "Company" ADD COLUMN "fundingMode" TEXT;
ALTER TABLE "Company" ALTER COLUMN "nit" DROP NOT NULL;

UPDATE "Company" AS c
SET "ownerUserId" = u."id"
FROM "User" AS u
WHERE u."companyId" = c."id" AND c."ownerUserId" IS NULL;

CREATE UNIQUE INDEX "Company_ownerUserId_kind_key" ON "Company"("ownerUserId", "kind");
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ExternalWallet" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalWallet_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ExternalWallet" ADD CONSTRAINT "ExternalWallet_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
