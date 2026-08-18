-- CreateEnum
CREATE TYPE "InterestArea" AS ENUM ('frontend', 'backend', 'ml');

-- CreateEnum
CREATE TYPE "PreAssessmentStatus" AS ENUM ('generating', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('dusuk', 'orta', 'yuksek');

-- CreateTable
CREATE TABLE "PreAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interestAreas" "InterestArea"[],
    "experienceLevel" "ExperienceLevel" NOT NULL,
    "skillSelections" JSONB,
    "language" "ReportLanguage" NOT NULL,
    "status" "PreAssessmentStatus" NOT NULL DEFAULT 'generating',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyReport" (
    "id" TEXT NOT NULL,
    "preAssessmentId" TEXT NOT NULL,
    "genelOzet" TEXT NOT NULL,
    "alanlar" JSONB NOT NULL,
    "guvenSeviyesi" "ConfidenceLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetencyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreAssessment_userId_createdAt_idx" ON "PreAssessment"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyReport_preAssessmentId_key" ON "CompetencyReport"("preAssessmentId");

-- AddForeignKey
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_preAssessmentId_fkey" FOREIGN KEY ("preAssessmentId") REFERENCES "PreAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreAssessment" ADD CONSTRAINT "PreAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyReport" ADD CONSTRAINT "CompetencyReport_preAssessmentId_fkey" FOREIGN KEY ("preAssessmentId") REFERENCES "PreAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
