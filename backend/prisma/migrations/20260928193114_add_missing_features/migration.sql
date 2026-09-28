-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('SAFETY', 'CLEANLINESS', 'WATER_POWER', 'OWNER_CONDUCT', 'PRICING', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('CAMPUS_JOB', 'INTERNSHIP', 'TEACHING_ASSISTANT', 'RESEARCH_ASSISTANT');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED', 'PAID');

-- CreateEnum
CREATE TYPE "IllStatus" AS ENUM ('REQUESTED', 'ORDERED', 'ARRIVED', 'ON_LOAN', 'RETURNED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReadingImportance" AS ENUM ('ESSENTIAL', 'RECOMMENDED');

-- CreateEnum
CREATE TYPE "MealPlanStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'USED_UP', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferPurpose" AS ENUM ('VENDOR', 'DISPATCHER', 'ASSOCIATION', 'HOSTEL_OWNER', 'PAYROLL');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('STRUCTURE', 'COURSES', 'STAFF', 'STUDENTS', 'RESULTS');

-- AlterEnum
ALTER TYPE "DocumentPurpose" ADD VALUE 'EBOOK';

-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'PENDING_REVIEW';

-- AlterTable
ALTER TABLE "Association" ADD COLUMN     "patronId" UUID;

-- AlterTable
ALTER TABLE "DispatcherProfile" ADD COLUMN     "lastAccuracy" DOUBLE PRECISION,
ADD COLUMN     "lastLat" DOUBLE PRECISION,
ADD COLUMN     "lastLng" DOUBLE PRECISION,
ADD COLUMN     "lastLocationAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FoodOrder" ADD COLUMN     "mealCredit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mealPlanPurchaseId" UUID,
ADD COLUMN     "scheduledFor" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Hostel" ADD COLUMN     "payoutName" TEXT,
ADD COLUMN     "payoutNetwork" TEXT,
ADD COLUMN     "payoutNumber" TEXT;

-- AlterTable
ALTER TABLE "HostelApplication" ADD COLUMN     "roommateIndex" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "applyUrl" TEXT,
ADD COLUMN     "kind" "JobKind" NOT NULL DEFAULT 'CAMPUS_JOB',
ADD COLUMN     "location" TEXT,
ADD COLUMN     "organisation" TEXT;

-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "payoutName" TEXT,
ADD COLUMN     "payoutNetwork" TEXT,
ADD COLUMN     "payoutNumber" TEXT;

-- AlterTable
ALTER TABLE "LibraryTitle" ADD COLUMN     "ebookDocumentId" UUID,
ADD COLUMN     "ebookOpens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ebookUrl" TEXT;

-- AlterTable
ALTER TABLE "ResultSheet" ADD COLUMN     "importedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "importBatchId" UUID,
ADD COLUMN     "photoId" TEXT;

-- CreateTable
CREATE TABLE "HostelComplaint" (
    "id" UUID NOT NULL,
    "hostelId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "category" "ComplaintCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "shareName" BOOLEAN NOT NULL DEFAULT false,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "officeNote" TEXT,
    "ownerResponse" TEXT,
    "ownerRespondedAt" TIMESTAMP(3),
    "handledById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostelComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "returnNote" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidReference" TEXT,
    "paidById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetEntry" (
    "id" UUID NOT NULL,
    "timesheetId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,

    CONSTRAINT "TimesheetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeInstalmentPlan" (
    "semesterId" UUID NOT NULL,
    "instalments" JSONB NOT NULL,
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeInstalmentPlan_pkey" PRIMARY KEY ("semesterId")
);

-- CreateTable
CREATE TABLE "FeeLateCharge" (
    "billId" UUID NOT NULL,
    "instalmentIndex" INTEGER NOT NULL,
    "adjustmentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeLateCharge_pkey" PRIMARY KEY ("billId","instalmentIndex")
);

-- CreateTable
CREATE TABLE "LibraryClearance" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "clearedById" UUID NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,

    CONSTRAINT "LibraryClearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterLibraryLoan" (
    "id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT,
    "isbn" TEXT,
    "lendingLibrary" TEXT,
    "neededBy" DATE,
    "note" TEXT,
    "status" "IllStatus" NOT NULL DEFAULT 'REQUESTED',
    "dueDate" DATE,
    "librarianNote" TEXT,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterLibraryLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingList" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingListItem" (
    "id" UUID NOT NULL,
    "listId" UUID NOT NULL,
    "titleId" UUID,
    "citation" TEXT,
    "url" TEXT,
    "importance" "ReadingImportance" NOT NULL DEFAULT 'RECOMMENDED',
    "note" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReadingListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderRating" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "vendorStars" INTEGER NOT NULL,
    "vendorComment" TEXT,
    "dispatcherId" UUID,
    "dispatcherStars" INTEGER,
    "hiddenAt" TIMESTAMP(3),
    "hiddenById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlan" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "meals" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "validDays" INTEGER NOT NULL,
    "eligibleItemIds" UUID[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanPurchase" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "mealsTotal" INTEGER NOT NULL,
    "mealsLeft" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "status" "MealPlanStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPlanPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" UUID NOT NULL,
    "purpose" "TransferPurpose" NOT NULL,
    "subjectId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "network" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "transferCode" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "meta" JSONB,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" UUID NOT NULL,
    "type" "ImportType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "setupSentAt" TIMESTAMP(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HostelComplaint_hostelId_status_idx" ON "HostelComplaint"("hostelId", "status");

-- CreateIndex
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_applicationId_period_key" ON "Timesheet"("applicationId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryClearance_certificateNumber_key" ON "LibraryClearance"("certificateNumber");

-- CreateIndex
CREATE INDEX "LibraryClearance_studentId_idx" ON "LibraryClearance"("studentId");

-- CreateIndex
CREATE INDEX "InterLibraryLoan_status_idx" ON "InterLibraryLoan"("status");

-- CreateIndex
CREATE INDEX "InterLibraryLoan_requesterId_idx" ON "InterLibraryLoan"("requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingList_courseId_key" ON "ReadingList"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderRating_orderId_key" ON "OrderRating"("orderId");

-- CreateIndex
CREATE INDEX "OrderRating_vendorId_idx" ON "OrderRating"("vendorId");

-- CreateIndex
CREATE INDEX "OrderRating_dispatcherId_idx" ON "OrderRating"("dispatcherId");

-- CreateIndex
CREATE INDEX "MealPlanPurchase_customerId_status_idx" ON "MealPlanPurchase"("customerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_reference_key" ON "Transfer"("reference");

-- CreateIndex
CREATE INDEX "Transfer_purpose_subjectId_idx" ON "Transfer"("purpose", "subjectId");

-- AddForeignKey
ALTER TABLE "HostelComplaint" ADD CONSTRAINT "HostelComplaint_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "Hostel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelComplaint" ADD CONSTRAINT "HostelComplaint_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Association" ADD CONSTRAINT "Association_patronId_fkey" FOREIGN KEY ("patronId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryTitle" ADD CONSTRAINT "LibraryTitle_ebookDocumentId_fkey" FOREIGN KEY ("ebookDocumentId") REFERENCES "StoredDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryClearance" ADD CONSTRAINT "LibraryClearance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterLibraryLoan" ADD CONSTRAINT "InterLibraryLoan_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingList" ADD CONSTRAINT "ReadingList_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingListItem" ADD CONSTRAINT "ReadingListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ReadingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingListItem" ADD CONSTRAINT "ReadingListItem_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "LibraryTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_mealPlanPurchaseId_fkey" FOREIGN KEY ("mealPlanPurchaseId") REFERENCES "MealPlanPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRating" ADD CONSTRAINT "OrderRating_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FoodOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanPurchase" ADD CONSTRAINT "MealPlanPurchase_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MealPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
