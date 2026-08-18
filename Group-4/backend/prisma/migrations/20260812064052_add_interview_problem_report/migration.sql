-- CreateTable
CREATE TABLE "InterviewProblemReport" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewProblemReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewProblemReport_interviewId_idx" ON "InterviewProblemReport"("interviewId");

-- AddForeignKey
ALTER TABLE "InterviewProblemReport" ADD CONSTRAINT "InterviewProblemReport_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
