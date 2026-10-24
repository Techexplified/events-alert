-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "lastCheckMessage" TEXT,
ADD COLUMN     "lastCheckStatus" TEXT,
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN     "lastDigestSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AlertNotification" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "cardUrl" TEXT NOT NULL,
    "stuckSince" TIMESTAMP(3) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "AlertNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrelloCredential" (
    "memberId" TEXT NOT NULL,
    "fullName" TEXT,
    "email" TEXT,
    "tokenEnc" TEXT NOT NULL,
    "invalidAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrelloCredential_pkey" PRIMARY KEY ("memberId")
);

-- CreateIndex
CREATE INDEX "AlertNotification_alertId_sentAt_idx" ON "AlertNotification"("alertId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertNotification_alertId_cardId_stuckSince_key" ON "AlertNotification"("alertId", "cardId", "stuckSince");

-- AddForeignKey
ALTER TABLE "AlertNotification" ADD CONSTRAINT "AlertNotification_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
