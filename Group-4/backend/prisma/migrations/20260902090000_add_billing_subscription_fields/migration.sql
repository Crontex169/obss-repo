-- AlterTable
ALTER TABLE "user" ADD COLUMN     "planTier" TEXT,
ADD COLUMN     "proUntil" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_stripeCustomerId_key" ON "user"("stripeCustomerId");
