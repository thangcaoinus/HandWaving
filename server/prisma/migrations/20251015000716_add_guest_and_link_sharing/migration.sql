/*
  Warnings:

  - A unique constraint covering the columns `[shareToken]` on the table `Canvas` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Canvas" ADD COLUMN     "linkSharingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shareRole" "CollaborationRole" NOT NULL DEFAULT 'EDITOR',
ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Canvas_shareToken_key" ON "Canvas"("shareToken");

-- CreateIndex
CREATE INDEX "Canvas_shareToken_idx" ON "Canvas"("shareToken");

-- CreateIndex
CREATE INDEX "User_isGuest_createdAt_idx" ON "User"("isGuest", "createdAt");
