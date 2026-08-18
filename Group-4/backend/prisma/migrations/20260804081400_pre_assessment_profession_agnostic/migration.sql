/*
  Warnings:

  - You are about to drop the column `alanlar` on the `CompetencyReport` table. All the data in the column will be lost.
  - You are about to drop the column `interestAreas` on the `PreAssessment` table. All the data in the column will be lost.
  - You are about to drop the column `skillSelections` on the `PreAssessment` table. All the data in the column will be lost.
  - Added the required column `calismaTarziOzeti` to the `CompetencyReport` table without a default value. This is not possible if the table is not empty.
  - Added the required column `experienceYears` to the `PreAssessment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `learningStyle` to the `PreAssessment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `problemApproach` to the `PreAssessment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `selfRatings` to the `PreAssessment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `teamPreference` to the `PreAssessment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workPreference` to the `PreAssessment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workStatus` to the `PreAssessment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ExperienceYears" AS ENUM ('none', 'lt1', 'y1_3', 'y3_5', 'y5_10', 'y10plus');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('employed_full', 'employed_part', 'seeking', 'student');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('primary', 'secondary', 'high_school', 'vocational', 'associate', 'bachelor', 'graduate');

-- CreateEnum
CREATE TYPE "WorkPreference" AS ENUM ('hands_on', 'people', 'detail_routine', 'problem_solving', 'planning');

-- CreateEnum
CREATE TYPE "TeamPreference" AS ENUM ('alone', 'small_team', 'large_team', 'leading', 'no_preference');

-- CreateEnum
CREATE TYPE "LearningStyle" AS ENUM ('shown', 'by_doing', 'written', 'video', 'mentorship');

-- CreateEnum
CREATE TYPE "ProblemApproach" AS ENUM ('self', 'ask_experienced', 'report_manager', 'research', 'team_discussion');

-- AlterTable
ALTER TABLE "CompetencyReport" DROP COLUMN "alanlar",
ADD COLUMN     "calismaTarziOzeti" TEXT NOT NULL,
ADD COLUMN     "gelisimAlanlari" TEXT[],
ADD COLUMN     "gucluYonler" TEXT[];

-- AlterTable
ALTER TABLE "PreAssessment" DROP COLUMN "interestAreas",
DROP COLUMN "skillSelections",
ADD COLUMN     "educationLevel" "EducationLevel",
ADD COLUMN     "experienceYears" "ExperienceYears" NOT NULL,
ADD COLUMN     "learningStyle" "LearningStyle" NOT NULL,
ADD COLUMN     "openAnswers" JSONB,
ADD COLUMN     "problemApproach" "ProblemApproach" NOT NULL,
ADD COLUMN     "selfRatings" JSONB NOT NULL,
ADD COLUMN     "skills" TEXT[],
ADD COLUMN     "teamPreference" "TeamPreference" NOT NULL,
ADD COLUMN     "workPreference" "WorkPreference" NOT NULL,
ADD COLUMN     "workStatus" "WorkStatus" NOT NULL;

-- DropEnum
DROP TYPE "InterestArea";

-- T008 / FR-004 (elle eklendi — Prisma DSL partial/kosullu index'i ifade edemez):
-- kullanici basina en fazla bir AKTIF on degerlendirme (SC-007).
-- NOT: bu index onceki migration uygulandiktan SONRA elle olusturulmustu; checksum
-- uyusmazligini onlemek icin oradan cikarilip (idempotent olarak) buraya tasindi.
CREATE UNIQUE INDEX IF NOT EXISTS "pre_assessment_one_active_per_user"
  ON "PreAssessment" ("userId")
  WHERE "isActive" = true;
