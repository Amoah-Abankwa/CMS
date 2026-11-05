-- CreateEnum
CREATE TYPE "DropStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Semester" ADD COLUMN     "dropDeadline" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CoursePrerequisite" (
    "courseId" UUID NOT NULL,
    "prerequisiteId" UUID NOT NULL,

    CONSTRAINT "CoursePrerequisite_pkey" PRIMARY KEY ("courseId","prerequisiteId")
);

-- CreateTable
CREATE TABLE "CourseApproval" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MalpracticeCase" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "offeringId" UUID,
    "semesterId" UUID NOT NULL,
    "occurredOn" DATE NOT NULL,
    "offence" TEXT NOT NULL,
    "sanction" TEXT,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MalpracticeCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseDropRequest" (
    "id" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DropStatus" NOT NULL DEFAULT 'REQUESTED',
    "decisionNote" TEXT,
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseDropRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseApproval_studentId_courseId_semesterId_key" ON "CourseApproval"("studentId", "courseId", "semesterId");

-- CreateIndex
CREATE INDEX "MalpracticeCase_semesterId_idx" ON "MalpracticeCase"("semesterId");

-- CreateIndex
CREATE INDEX "MalpracticeCase_studentId_idx" ON "MalpracticeCase"("studentId");

-- CreateIndex
CREATE INDEX "CourseDropRequest_semesterId_status_idx" ON "CourseDropRequest"("semesterId", "status");

-- CreateIndex
CREATE INDEX "CourseDropRequest_studentId_idx" ON "CourseDropRequest"("studentId");

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseApproval" ADD CONSTRAINT "CourseApproval_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseApproval" ADD CONSTRAINT "CourseApproval_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MalpracticeCase" ADD CONSTRAINT "MalpracticeCase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MalpracticeCase" ADD CONSTRAINT "MalpracticeCase_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseDropRequest" ADD CONSTRAINT "CourseDropRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseDropRequest" ADD CONSTRAINT "CourseDropRequest_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
