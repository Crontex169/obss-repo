-- CreateEnum
CREATE TYPE "JobPostingSource" AS ENUM ('text', 'pdf');

-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('written', 'voice');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('multiple_choice', 'open_ended');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('in_progress', 'completed');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('not_applicable', 'pending', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "LlmOperation" AS ENUM ('pre_assessment', 'question_generation', 'adaptive_evaluation', 'interview_report');

-- CreateEnum
CREATE TYPE "ReportLanguage" AS ENUM ('tr', 'en');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('intern', 'junior', 'senior');

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobPostingSource" "JobPostingSource" NOT NULL,
    "jobPostingText" TEXT NOT NULL,
    "jobPostingFileName" TEXT,
    "questionCount" INTEGER NOT NULL,
    "mode" "InterviewMode" NOT NULL,
    "adaptiveEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "InterviewStatus" NOT NULL DEFAULT 'in_progress',
    "reportStatus" "ReportStatus" NOT NULL DEFAULT 'not_applicable',
    "currentQuestionOrder" INTEGER NOT NULL DEFAULT 1,
    "position" TEXT,
    "level" "ExperienceLevel" NOT NULL,
    "language" "ReportLanguage" NOT NULL,
    "completedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "QuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "options" TEXT[],
    "adaptedFromAnswerId" TEXT,
    "isBaseline" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceMode" "InterviewMode" NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "overallImpression" TEXT NOT NULL,
    "strengths" TEXT[],
    "improvementAreas" TEXT[],
    "technicalScore" INTEGER NOT NULL,
    "behavioralScore" INTEGER NOT NULL,
    "generalScore" INTEGER NOT NULL,
    "additionalNotes" TEXT[],
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operation" "LlmOperation" NOT NULL,
    "preAssessmentId" TEXT,
    "interviewId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "estimatedCostUsd" DECIMAL(10,6) NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Interview_userId_createdAt_idx" ON "Interview"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Interview_deletedAt_idx" ON "Interview"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Question_interviewId_order_key" ON "Question"("interviewId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_questionId_key" ON "Answer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_interviewId_key" ON "Report"("interviewId");

-- CreateIndex
CREATE INDEX "TokenUsage_userId_createdAt_idx" ON "TokenUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TokenUsage_operation_createdAt_idx" ON "TokenUsage"("operation", "createdAt");

-- CreateIndex
CREATE INDEX "TokenUsage_interviewId_idx" ON "TokenUsage"("interviewId");

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
