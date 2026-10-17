-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('active', 'paused');

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "boardName" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "recipients" JSONB NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'active',
    "createdByMemberId" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alert_boardId_createdAt_idx" ON "Alert"("boardId", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_boardId_status_idx" ON "Alert"("boardId", "status");
