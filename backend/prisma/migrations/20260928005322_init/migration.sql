/*
  Warnings:

  - A unique constraint covering the columns `[reference]` on the table `FinePayment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[indexCode]` on the table `Programme` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "HostelPaymentMethod" AS ENUM ('ONLINE', 'CASH', 'MOBILE_MONEY', 'BANK');

-- CreateEnum
CREATE TYPE "FormSubmissionStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ExcuseRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "JobPayUnit" AS ENUM ('HOUR', 'MONTH', 'TASK');

-- CreateEnum
CREATE TYPE "JobApplicationStatus" AS ENUM ('SUBMITTED', 'SHORTLISTED', 'HIRED', 'REJECTED', 'WITHDRAWN', 'ENDED');

-- CreateEnum
CREATE TYPE "DispatcherStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'ENDED');

-- CreateEnum
CREATE TYPE "DispatcherTransport" AS ENUM ('WALKING', 'BICYCLE', 'MOTORBIKE');

-- CreateEnum
CREATE TYPE "DispatchFeeSettlement" AS ENUM ('UNIVERSITY', 'VENDOR', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "DispatchDeliveryStatus" AS ENUM ('WAITING', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClearanceSource" AS ENUM ('MANUAL', 'FEES');

-- CreateEnum
CREATE TYPE "ExamAttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('GHS', 'USD');

-- CreateEnum
CREATE TYPE "FeeStudentGroup" AS ENUM ('ALL', 'GHANAIAN', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "FeePaymentMethod" AS ENUM ('ONLINE', 'BANK', 'MOBILE_MONEY', 'CHEQUE');

-- CreateEnum
CREATE TYPE "AssociationOffice" AS ENUM ('PRESIDENT', 'TREASURER');

-- CreateEnum
CREATE TYPE "DuesMethod" AS ENUM ('ONLINE', 'CASH');

-- CreateEnum
CREATE TYPE "ProgrammeCategory" AS ENUM ('DIPLOMA', 'BACHELORS', 'GRADUATE', 'OTHER');

-- CreateEnum
CREATE TYPE "StudyMode" AS ENUM ('REGULAR', 'WEEKEND', 'SANDWICH', 'DISTANCE');

-- CreateEnum
CREATE TYPE "DispatchFeeMode" AS ENUM ('INCLUDED', 'ON_DELIVERY');

-- CreateEnum
CREATE TYPE "DocumentPurpose" AS ENUM ('HOSTEL_FORM', 'HOSTEL_FORM_SUBMISSION', 'EXCUSE');

-- CreateEnum
CREATE TYPE "AmendmentStatus" AS ENUM ('REQUESTED', 'HOD_APPROVED', 'DEAN_APPROVED', 'APPLIED', 'REJECTED');

-- AlterEnum
ALTER TYPE "FinePaymentMethod" ADD VALUE 'ONLINE';

-- AlterTable
ALTER TABLE "CourseRegistration" ADD COLUMN     "reopenReason" TEXT,
ADD COLUMN     "reopenedAt" TIMESTAMP(3),
ADD COLUMN     "reopenedById" UUID;

-- AlterTable
ALTER TABLE "CourseResult" ADD COLUMN     "devotionExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "devotionScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "showDuesOnRegister" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ExamSession" ADD COLUMN     "registerClosedAt" TIMESTAMP(3),
ADD COLUMN     "registerClosedById" UUID,
ADD COLUMN     "registerNote" TEXT;

-- AlterTable
ALTER TABLE "FinancialClearance" ADD COLUMN     "source" "ClearanceSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "FinePayment" ADD COLUMN     "reference" TEXT;

-- AlterTable
ALTER TABLE "FoodOrder" ADD COLUMN     "dispatchFeeMode" "DispatchFeeMode",
ADD COLUMN     "paidMarkedAt" TIMESTAMP(3),
ADD COLUMN     "paidReference" TEXT,
ADD COLUMN     "paidVia" TEXT,
ADD COLUMN     "viaDispatcher" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Hostel" ADD COLUMN     "photoIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "photoId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "subjectId" UUID;

-- AlterTable
ALTER TABLE "PrivateBooking" ADD COLUMN     "checkInNote" TEXT,
ADD COLUMN     "checkOutNote" TEXT,
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "checkedInById" UUID,
ADD COLUMN     "checkedOutAt" TIMESTAMP(3),
ADD COLUMN     "checkedOutById" UUID;

-- AlterTable
ALTER TABLE "Programme" ADD COLUMN     "indexCode" TEXT,
ADD COLUMN     "semesters" INTEGER;

-- AlterTable
ALTER TABLE "ProgrammeLevel" ADD COLUMN     "category" "ProgrammeCategory" NOT NULL DEFAULT 'BACHELORS',
ADD COLUMN     "indexFormat" TEXT NOT NULL DEFAULT 'ANU{YY}{CODE}{SEQ:5}',
ADD COLUMN     "mode" "StudyMode" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "semesters" INTEGER NOT NULL DEFAULT 8;

-- AlterTable
ALTER TABLE "RoomAllocation" ADD COLUMN     "checkInNote" TEXT,
ADD COLUMN     "checkOutNote" TEXT,
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "checkedInById" UUID,
ADD COLUMN     "checkedOutAt" TIMESTAMP(3),
ADD COLUMN     "checkedOutById" UUID;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "useDispatchers" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "HostelFee" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "hostelId" UUID NOT NULL,
    "allocationId" UUID,
    "bookingId" UUID,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostelFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostelFeePayment" (
    "id" UUID NOT NULL,
    "feeId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "HostelPaymentMethod" NOT NULL,
    "reference" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "paidOn" DATE NOT NULL,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedById" UUID,
    "reversalReason" TEXT,

    CONSTRAINT "HostelFeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostelOwnerPayout" (
    "id" UUID NOT NULL,
    "hostelId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HostelOwnerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostelFormTemplate" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "hostelId" UUID,
    "documentId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HostelFormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostelFormSubmission" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "status" "FormSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "note" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostelFormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcuseRequest" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "category" "ExcuseCategory" NOT NULL,
    "statement" TEXT NOT NULL,
    "documentId" UUID,
    "status" "ExcuseRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "decisionNote" TEXT,
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "excuseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcuseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevotionExemption" (
    "studentId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "grantedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevotionExemption_pkey" PRIMARY KEY ("studentId","semesterId")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hoursPerWeek" INTEGER NOT NULL,
    "payRate" INTEGER NOT NULL,
    "payUnit" "JobPayUnit" NOT NULL,
    "positions" INTEGER NOT NULL DEFAULT 1,
    "minCgpa" DOUBLE PRECISION,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "supervisorId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "statement" TEXT NOT NULL,
    "availability" TEXT,
    "cgpaAtApply" DOUBLE PRECISION,
    "decisionNote" TEXT,
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatcherProfile" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "DispatcherStatus" NOT NULL DEFAULT 'PENDING',
    "statement" TEXT NOT NULL,
    "transport" "DispatcherTransport" NOT NULL DEFAULT 'WALKING',
    "payoutNetwork" TEXT NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "payoutName" TEXT NOT NULL,
    "cgpaAtApply" DOUBLE PRECISION,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "statusNote" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatcherProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "dispatcherId" UUID,
    "status" "DispatchDeliveryStatus" NOT NULL DEFAULT 'WAITING',
    "fee" INTEGER NOT NULL,
    "feeSettlement" "DispatchFeeSettlement" NOT NULL DEFAULT 'UNIVERSITY',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "waitAlertAt" TIMESTAMP(3),
    "problemNote" TEXT,
    "problemAt" TIMESTAMP(3),

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatcherPayout" (
    "id" UUID NOT NULL,
    "dispatcherId" UUID NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispatcherPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSeat" (
    "sessionId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "seatNumber" INTEGER NOT NULL,

    CONSTRAINT "ExamSeat_pkey" PRIMARY KEY ("sessionId","studentId")
);

-- CreateTable
CREATE TABLE "ExamAttendance" (
    "sessionId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "ExamAttendanceStatus" NOT NULL,
    "markedById" UUID NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "ExamAttendance_pkey" PRIMARY KEY ("sessionId","studentId")
);

-- CreateTable
CREATE TABLE "FeeItem" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeSchedule" (
    "id" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "programmeId" UUID,
    "level" INTEGER,
    "studentGroup" "FeeStudentGroup" NOT NULL DEFAULT 'ALL',
    "currency" "Currency" NOT NULL DEFAULT 'GHS',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeScheduleLine" (
    "id" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "feeItemId" UUID,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FeeScheduleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentBill" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "scheduleId" UUID,
    "lines" JSONB NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'GHS',
    "charged" INTEGER NOT NULL,
    "issuedById" UUID NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeAdjustment" (
    "id" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "allocationId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePayment" (
    "id" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "FeePaymentMethod" NOT NULL,
    "reference" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "originalAmount" INTEGER,
    "originalCurrency" "Currency",
    "exchangeRate" DOUBLE PRECISION,
    "paidOn" DATE NOT NULL,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedById" UUID,
    "reversalReason" TEXT,

    CONSTRAINT "FeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Association" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "payoutNetwork" TEXT,
    "payoutNumber" TEXT,
    "payoutName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "receiptSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Association_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssociationDepartment" (
    "associationId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,

    CONSTRAINT "AssociationDepartment_pkey" PRIMARY KEY ("associationId","departmentId")
);

-- CreateTable
CREATE TABLE "AssociationOfficer" (
    "id" UUID NOT NULL,
    "associationId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "office" "AssociationOffice" NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    "appointedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssociationOfficer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuesLevy" (
    "id" UUID NOT NULL,
    "associationId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "dueOn" DATE NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuesLevy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuesPayment" (
    "id" UUID NOT NULL,
    "levyId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "DuesMethod" NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "reference" TEXT,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedById" UUID,
    "voidReason" TEXT,

    CONSTRAINT "DuesPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuesPayout" (
    "id" UUID NOT NULL,
    "associationId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuesPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" UUID NOT NULL,
    "cedisPerDollar" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredDocument" (
    "id" UUID NOT NULL,
    "publicId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "bytes" INTEGER,
    "originalName" TEXT NOT NULL,
    "purpose" "DocumentPurpose" NOT NULL,
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultAmendment" (
    "id" UUID NOT NULL,
    "resultId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "newCaScore" DOUBLE PRECISION NOT NULL,
    "newExamScore" DOUBLE PRECISION NOT NULL,
    "after" JSONB,
    "status" "AmendmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" UUID NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hodApprovedById" UUID,
    "hodApprovedAt" TIMESTAMP(3),
    "deanApprovedById" UUID,
    "deanApprovedAt" TIMESTAMP(3),
    "appliedById" UUID,
    "appliedAt" TIMESTAMP(3),
    "rejectedById" UUID,
    "rejectedAt" TIMESTAMP(3),
    "rejectNote" TEXT,

    CONSTRAINT "ResultAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorAssignment" (
    "studentId" UUID NOT NULL,
    "advisorId" UUID NOT NULL,
    "assignedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorAssignment_pkey" PRIMARY KEY ("studentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "HostelFee_allocationId_key" ON "HostelFee"("allocationId");

-- CreateIndex
CREATE UNIQUE INDEX "HostelFee_bookingId_key" ON "HostelFee"("bookingId");

-- CreateIndex
CREATE INDEX "HostelFee_semesterId_hostelId_idx" ON "HostelFee"("semesterId", "hostelId");

-- CreateIndex
CREATE INDEX "HostelFee_studentId_idx" ON "HostelFee"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "HostelFeePayment_reference_key" ON "HostelFeePayment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "HostelFeePayment_receiptNumber_key" ON "HostelFeePayment"("receiptNumber");

-- CreateIndex
CREATE INDEX "HostelFeePayment_feeId_idx" ON "HostelFeePayment"("feeId");

-- CreateIndex
CREATE UNIQUE INDEX "HostelFormSubmission_templateId_studentId_semesterId_key" ON "HostelFormSubmission"("templateId", "studentId", "semesterId");

-- CreateIndex
CREATE INDEX "ExcuseRequest_status_createdAt_idx" ON "ExcuseRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ExcuseRequest_studentId_idx" ON "ExcuseRequest"("studentId");

-- CreateIndex
CREATE INDEX "Job_status_closesAt_idx" ON "Job"("status", "closesAt");

-- CreateIndex
CREATE INDEX "JobApplication_studentId_status_idx" ON "JobApplication"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_jobId_studentId_key" ON "JobApplication"("jobId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "DispatcherProfile_studentId_key" ON "DispatcherProfile"("studentId");

-- CreateIndex
CREATE INDEX "DispatcherProfile_status_online_idx" ON "DispatcherProfile"("status", "online");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_orderId_key" ON "Delivery"("orderId");

-- CreateIndex
CREATE INDEX "Delivery_status_offeredAt_idx" ON "Delivery"("status", "offeredAt");

-- CreateIndex
CREATE INDEX "Delivery_dispatcherId_status_idx" ON "Delivery"("dispatcherId", "status");

-- CreateIndex
CREATE INDEX "DispatcherPayout_dispatcherId_periodFrom_idx" ON "DispatcherPayout"("dispatcherId", "periodFrom");

-- CreateIndex
CREATE INDEX "ExamSeat_studentId_idx" ON "ExamSeat"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeItem_name_key" ON "FeeItem"("name");

-- CreateIndex
CREATE INDEX "FeeSchedule_semesterId_idx" ON "FeeSchedule"("semesterId");

-- CreateIndex
CREATE INDEX "StudentBill_semesterId_idx" ON "StudentBill"("semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentBill_studentId_semesterId_key" ON "StudentBill"("studentId", "semesterId");

-- CreateIndex
CREATE INDEX "FeeAdjustment_allocationId_idx" ON "FeeAdjustment"("allocationId");

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_receiptNumber_key" ON "FeePayment"("receiptNumber");

-- CreateIndex
CREATE INDEX "FeePayment_billId_idx" ON "FeePayment"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_method_reference_key" ON "FeePayment"("method", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "Association_code_key" ON "Association"("code");

-- CreateIndex
CREATE INDEX "AssociationDepartment_departmentId_idx" ON "AssociationDepartment"("departmentId");

-- CreateIndex
CREATE INDEX "AssociationOfficer_associationId_endedAt_idx" ON "AssociationOfficer"("associationId", "endedAt");

-- CreateIndex
CREATE INDEX "AssociationOfficer_studentId_idx" ON "AssociationOfficer"("studentId");

-- CreateIndex
CREATE INDEX "DuesLevy_associationId_semesterId_idx" ON "DuesLevy"("associationId", "semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "DuesPayment_receiptNumber_key" ON "DuesPayment"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DuesPayment_reference_key" ON "DuesPayment"("reference");

-- CreateIndex
CREATE INDEX "DuesPayment_levyId_studentId_idx" ON "DuesPayment"("levyId", "studentId");

-- CreateIndex
CREATE INDEX "ExchangeRate_effectiveFrom_idx" ON "ExchangeRate"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "StoredDocument_publicId_key" ON "StoredDocument"("publicId");

-- CreateIndex
CREATE INDEX "ResultAmendment_status_idx" ON "ResultAmendment"("status");

-- CreateIndex
CREATE INDEX "ResultAmendment_resultId_idx" ON "ResultAmendment"("resultId");

-- CreateIndex
CREATE INDEX "AdvisorAssignment_advisorId_idx" ON "AdvisorAssignment"("advisorId");

-- CreateIndex
CREATE UNIQUE INDEX "FinePayment_reference_key" ON "FinePayment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Programme_indexCode_key" ON "Programme"("indexCode");

-- AddForeignKey
ALTER TABLE "HostelFee" ADD CONSTRAINT "HostelFee_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelFee" ADD CONSTRAINT "HostelFee_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "Hostel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelFeePayment" ADD CONSTRAINT "HostelFeePayment_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES "HostelFee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelOwnerPayout" ADD CONSTRAINT "HostelOwnerPayout_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "Hostel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelFormTemplate" ADD CONSTRAINT "HostelFormTemplate_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "Hostel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelFormTemplate" ADD CONSTRAINT "HostelFormTemplate_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StoredDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelFormSubmission" ADD CONSTRAINT "HostelFormSubmission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "HostelFormTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelFormSubmission" ADD CONSTRAINT "HostelFormSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelFormSubmission" ADD CONSTRAINT "HostelFormSubmission_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StoredDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcuseRequest" ADD CONSTRAINT "ExcuseRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcuseRequest" ADD CONSTRAINT "ExcuseRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StoredDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevotionExemption" ADD CONSTRAINT "DevotionExemption_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatcherProfile" ADD CONSTRAINT "DispatcherProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FoodOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_dispatcherId_fkey" FOREIGN KEY ("dispatcherId") REFERENCES "DispatcherProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatcherPayout" ADD CONSTRAINT "DispatcherPayout_dispatcherId_fkey" FOREIGN KEY ("dispatcherId") REFERENCES "DispatcherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSeat" ADD CONSTRAINT "ExamSeat_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSeat" ADD CONSTRAINT "ExamSeat_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttendance" ADD CONSTRAINT "ExamAttendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttendance" ADD CONSTRAINT "ExamAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeScheduleLine" ADD CONSTRAINT "FeeScheduleLine_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "FeeSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeScheduleLine" ADD CONSTRAINT "FeeScheduleLine_feeItemId_fkey" FOREIGN KEY ("feeItemId") REFERENCES "FeeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBill" ADD CONSTRAINT "StudentBill_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBill" ADD CONSTRAINT "StudentBill_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBill" ADD CONSTRAINT "StudentBill_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "FeeSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAdjustment" ADD CONSTRAINT "FeeAdjustment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "StudentBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "StudentBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssociationDepartment" ADD CONSTRAINT "AssociationDepartment_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssociationDepartment" ADD CONSTRAINT "AssociationDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssociationOfficer" ADD CONSTRAINT "AssociationOfficer_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssociationOfficer" ADD CONSTRAINT "AssociationOfficer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesLevy" ADD CONSTRAINT "DuesLevy_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesLevy" ADD CONSTRAINT "DuesLevy_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesPayment" ADD CONSTRAINT "DuesPayment_levyId_fkey" FOREIGN KEY ("levyId") REFERENCES "DuesLevy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesPayment" ADD CONSTRAINT "DuesPayment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesPayout" ADD CONSTRAINT "DuesPayout_associationId_fkey" FOREIGN KEY ("associationId") REFERENCES "Association"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultAmendment" ADD CONSTRAINT "ResultAmendment_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "CourseResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorAssignment" ADD CONSTRAINT "AdvisorAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorAssignment" ADD CONSTRAINT "AdvisorAssignment_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
