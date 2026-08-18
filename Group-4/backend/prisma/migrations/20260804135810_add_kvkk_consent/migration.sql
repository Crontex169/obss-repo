/*
  Warnings:

  - Made the column `overallScore` on table `Report` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Report" ALTER COLUMN "overallScore" SET NOT NULL;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "kvkkConsentAt" TIMESTAMP(3);
