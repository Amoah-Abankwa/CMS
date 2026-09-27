-- CreateEnum
CREATE TYPE "HostelKind" AS ENUM ('UNIVERSITY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "HostelGender" AS ENUM ('MALE', 'FEMALE', 'MIXED');

-- CreateEnum
CREATE TYPE "HostelVerification" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "HostelApplicationStatus" AS ENUM ('SUBMITTED', 'WITHDRAWN', 'ALLOCATED', 'UNPLACED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('PROVISIONAL', 'OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AllocationSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClassSessionKind" AS ENUM ('LECTURE', 'TUTORIAL', 'PRACTICAL');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('LECTURER', 'CHECK_IN', 'EXCUSE');

-- CreateEnum
CREATE TYPE "ExcuseCategory" AS ENUM ('MEDICAL', 'BEREAVEMENT', 'OFFICIAL_DUTY', 'OTHER');

-- CreateEnum
CREATE TYPE "DevotionStatus" AS ENUM ('EARLY', 'LATE', 'ABSENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "DevotionSource" AS ENUM ('SELF_CHECK_IN', 'DOOR', 'CORRECTION', 'CLOSE', 'EXCUSE');

-- CreateEnum
CREATE TYPE "ExamTimetableStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ExamHoldCategory" AS ENUM ('DISCIPLINARY', 'ACADEMIC_MISCONDUCT', 'ADMINISTRATIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('STUDENT', 'STAFF', 'PARTNER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_SETUP', 'ACTIVE', 'LOCKED', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CopyStatus" AS ENUM ('AVAILABLE', 'ON_LOAN', 'ON_HOLD', 'LOST', 'DAMAGED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'RETURNED', 'LOST');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('WAITING', 'READY', 'COLLECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FineReason" AS ENUM ('OVERDUE', 'LOST', 'DAMAGED');

-- CreateEnum
CREATE TYPE "FinePaymentMethod" AS ENUM ('CASH', 'MOBILE_MONEY', 'WAIVER');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FulfilmentType" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentOption" AS ENUM ('ONLINE', 'ON_PICKUP');

-- CreateEnum
CREATE TYPE "FoodOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PLACED', 'ACCEPTED', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssessmentKind" AS ENUM ('CONTINUOUS', 'EXAM');

-- CreateEnum
CREATE TYPE "ResultSheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'HOD_APPROVED', 'DEAN_APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "School" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schoolId" UUID NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" UUID NOT NULL,
    "levelCode" TEXT NOT NULL,
    "durationYears" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semester" (
    "id" UUID NOT NULL,
    "academicYearId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "registrationOpensAt" TIMESTAMP(3),
    "registrationClosesAt" TIMESTAMP(3),
    "minCredits" INTEGER NOT NULL DEFAULT 12,
    "maxCredits" INTEGER NOT NULL DEFAULT 24,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "creditHours" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "semesterNo" INTEGER NOT NULL,
    "departmentId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logGroup" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "scope" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeveloperAccessGrant" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "grantedById" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" UUID,
    "revokeReason" TEXT,

    CONSTRAINT "DeveloperAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hostel" (
    "id" UUID NOT NULL,
    "kind" "HostelKind" NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "HostelGender" NOT NULL,
    "location" TEXT,
    "digitalAddress" TEXT,
    "distanceNote" TEXT,
    "description" TEXT,
    "facilities" TEXT[],
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" UUID,
    "verification" "HostelVerification" NOT NULL DEFAULT 'APPROVED',
    "verificationNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hostel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "hostelId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "floor" TEXT,
    "capacity" INTEGER NOT NULL,
    "roomType" TEXT NOT NULL,
    "pricePerSemester" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccommodationRound" (
    "semesterId" UUID NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "acceptanceDays" INTEGER NOT NULL DEFAULT 5,
    "lastRunAt" TIMESTAMP(3),
    "lastPublishedAt" TIMESTAMP(3),

    CONSTRAINT "AccommodationRound_pkey" PRIMARY KEY ("semesterId")
);

-- CreateTable
CREATE TABLE "HostelApplication" (
    "id" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "preferences" JSONB NOT NULL,
    "acceptAny" BOOLEAN NOT NULL DEFAULT false,
    "specialNeeds" TEXT,
    "specialNeedsApproved" BOOLEAN NOT NULL DEFAULT false,
    "status" "HostelApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostelApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomAllocation" (
    "id" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "status" "AllocationStatus" NOT NULL,
    "source" "AllocationSource" NOT NULL,
    "preferenceRank" INTEGER,
    "offeredAt" TIMESTAMP(3),
    "acceptBy" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateRoomType" (
    "id" UUID NOT NULL,
    "hostelId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "bedsPerRoom" INTEGER NOT NULL,
    "pricePerSemester" INTEGER NOT NULL,
    "availableBeds" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateRoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateBooking" (
    "id" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "message" TEXT,
    "ownerNote" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResidenceDeclaration" (
    "studentId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "digitalAddress" TEXT,
    "landmark" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResidenceDeclaration_pkey" PRIMARY KEY ("studentId","semesterId")
);

-- CreateTable
CREATE TABLE "ClassSession" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "kind" "ClassSessionKind" NOT NULL DEFAULT 'LECTURE',
    "topic" TEXT,
    "venue" TEXT,
    "createdById" UUID NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "checkInSecret" TEXT,
    "checkInOpenedAt" TIMESTAMP(3),
    "checkInClosesAt" TIMESTAMP(3),
    "attendanceTakenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "sessionId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "source" "AttendanceSource" NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "markedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("sessionId","studentId")
);

-- CreateTable
CREATE TABLE "AttendanceExcuse" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "category" "ExcuseCategory" NOT NULL,
    "note" TEXT NOT NULL,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" UUID,
    "revokeReason" TEXT,

    CONSTRAINT "AttendanceExcuse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceWarning" (
    "studentId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "warnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceWarning_pkey" PRIMARY KEY ("studentId","offeringId")
);

-- CreateTable
CREATE TABLE "DevotionService" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "semesterId" UUID NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "lateFrom" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "theme" TEXT,
    "speaker" TEXT,
    "checkInSecret" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevotionService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevotionRecord" (
    "serviceId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "DevotionStatus" NOT NULL,
    "source" "DevotionSource" NOT NULL,
    "arrivedAt" TIMESTAMP(3),
    "recordedById" UUID,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevotionRecord_pkey" PRIMARY KEY ("serviceId","studentId")
);

-- CreateTable
CREATE TABLE "DevotionResult" (
    "studentId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "early" INTEGER NOT NULL,
    "late" INTEGER NOT NULL,
    "absent" INTEGER NOT NULL,
    "excused" INTEGER NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL,
    "finalizedById" UUID NOT NULL,

    CONSTRAINT "DevotionResult_pkey" PRIMARY KEY ("studentId","semesterId")
);

-- CreateTable
CREATE TABLE "ExamVenue" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamVenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamTimetable" (
    "id" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "status" "ExamTimetableStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedVersion" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "publishedSnapshot" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamTimetable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSession" (
    "id" UUID NOT NULL,
    "timetableId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "venueId" UUID,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamInvigilator" (
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "ExamInvigilator_pkey" PRIMARY KEY ("sessionId","userId")
);

-- CreateTable
CREATE TABLE "FinancialClearance" (
    "studentId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "cleared" BOOLEAN NOT NULL,
    "note" TEXT,
    "updatedById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialClearance_pkey" PRIMARY KEY ("studentId","semesterId")
);

-- CreateTable
CREATE TABLE "ExamHold" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "offeringId" UUID,
    "category" "ExamHoldCategory" NOT NULL,
    "reason" TEXT NOT NULL,
    "placedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),
    "liftedById" UUID,
    "liftReason" TEXT,

    CONSTRAINT "ExamHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamEligibilityList" (
    "semesterId" UUID NOT NULL,
    "generatedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedVersion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExamEligibilityList_pkey" PRIMARY KEY ("semesterId")
);

-- CreateTable
CREATE TABLE "ExamEligibility" (
    "id" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "status" "EligibilityStatus" NOT NULL,
    "reasons" JSONB NOT NULL,
    "overrideStatus" "EligibilityStatus",
    "overrideReason" TEXT,
    "overriddenById" UUID,
    "overriddenAt" TIMESTAMP(3),
    "publishedStatus" "EligibilityStatus",
    "publishedReasons" JSONB,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "type" "UserType" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING_SETUP',
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "indexNumber" TEXT,
    "passwordHash" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "primaryRoleKey" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "programmeId" UUID NOT NULL,
    "levelCode" TEXT NOT NULL,
    "admissionYear" INTEGER NOT NULL,
    "currentLevel" INTEGER NOT NULL DEFAULT 100,
    "dateOfBirth" DATE,
    "gender" TEXT,
    "nationality" TEXT,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "staffNumber" TEXT NOT NULL,
    "title" TEXT,
    "departmentId" UUID,
    "isTeaching" BOOLEAN NOT NULL DEFAULT false,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaFactor" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "lastUsedStep" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "activeRoleKey" TEXT,
    "mfaVerifiedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" UUID NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "sidebarCollapsed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ProgrammeLevel" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProgrammeLevel_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "IndexNumberCounter" (
    "admissionYear" INTEGER NOT NULL,
    "levelCode" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexNumberCounter_pkey" PRIMARY KEY ("admissionYear","levelCode")
);

-- CreateTable
CREATE TABLE "AccountSetupToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSetupToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryTitle" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "authors" TEXT[],
    "isbn" TEXT,
    "publisher" TEXT,
    "year" INTEGER,
    "edition" TEXT,
    "callNumber" TEXT,
    "subjects" TEXT[],
    "description" TEXT,
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryCopy" (
    "id" UUID NOT NULL,
    "titleId" UUID NOT NULL,
    "barcode" TEXT NOT NULL,
    "shelf" TEXT,
    "isReference" BOOLEAN NOT NULL DEFAULT false,
    "status" "CopyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" UUID NOT NULL,
    "copyId" UUID NOT NULL,
    "borrowerId" UUID NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "renewals" INTEGER NOT NULL DEFAULT 0,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedById" UUID,
    "returnedById" UUID,
    "dueReminderSentAt" TIMESTAMP(3),
    "overdueNoticeCount" INTEGER NOT NULL DEFAULT 0,
    "lastOverdueNoticeAt" TIMESTAMP(3),

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryReservation" (
    "id" UUID NOT NULL,
    "titleId" UUID NOT NULL,
    "borrowerId" UUID NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'WAITING',
    "copyId" UUID,
    "readyAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryFine" (
    "id" UUID NOT NULL,
    "borrowerId" UUID NOT NULL,
    "loanId" UUID,
    "reason" "FineReason" NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "waived" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "LibraryFine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinePayment" (
    "id" UUID NOT NULL,
    "fineId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "FinePaymentMethod" NOT NULL,
    "receiptNumber" TEXT,
    "note" TEXT,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "openingHours" JSONB NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "acceptsOnline" BOOLEAN NOT NULL DEFAULT true,
    "acceptsPayOnPickup" BOOLEAN NOT NULL DEFAULT true,
    "offersPickup" BOOLEAN NOT NULL DEFAULT true,
    "offersDelivery" BOOLEAN NOT NULL DEFAULT false,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "deliveryNote" TEXT,
    "minimumOrder" INTEGER NOT NULL DEFAULT 0,
    "prepMinutes" INTEGER NOT NULL DEFAULT 20,
    "payoutNetwork" TEXT,
    "payoutNumber" TEXT,
    "payoutName" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'PENDING',
    "statusNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "categoryId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodOrder" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "vendorId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "status" "FoodOrderStatus" NOT NULL,
    "fulfilment" "FulfilmentType" NOT NULL,
    "deliveryAddress" TEXT,
    "deliveryNote" TEXT,
    "paymentOption" "PaymentOption" NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "commission" INTEGER NOT NULL DEFAULT 0,
    "pickupCode" TEXT NOT NULL,
    "note" TEXT,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "placedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    "estimatedReadyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodOrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "menuItemId" UUID,
    "name" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,

    CONSTRAINT "FoodOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "orderId" UUID,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "channel" TEXT,
    "providerData" JSONB,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPayout" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" UUID,
    "actorLabel" TEXT,
    "actorRoleKey" TEXT,
    "logGroup" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "result" "AuditResult" NOT NULL DEFAULT 'SUCCESS',
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "correlationId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" UUID NOT NULL,
    "eventKey" TEXT NOT NULL,
    "emailSubject" TEXT NOT NULL,
    "emailBody" TEXT NOT NULL,
    "smsBody" TEXT NOT NULL,
    "inAppTitle" TEXT NOT NULL,
    "inAppBody" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "eventKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "destination" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "GradingScale" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "passMark" DOUBLE PRECISION NOT NULL,
    "maxGradePoint" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradingScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeBand" (
    "id" UUID NOT NULL,
    "scaleId" UUID NOT NULL,
    "letter" TEXT NOT NULL,
    "minScore" DOUBLE PRECISION NOT NULL,
    "gradePoint" DOUBLE PRECISION NOT NULL,
    "isPass" BOOLEAN NOT NULL,
    "remark" TEXT,

    CONSTRAINT "GradeBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AssessmentKind" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "marksUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentMark" (
    "assessmentId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "score" DOUBLE PRECISION,
    "absent" BOOLEAN NOT NULL DEFAULT false,
    "releasedScore" DOUBLE PRECISION,
    "releasedAbsent" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3),
    "enteredById" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentMark_pkey" PRIMARY KEY ("assessmentId","studentId")
);

-- CreateTable
CREATE TABLE "ResultSheet" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "status" "ResultSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "scaleId" UUID,
    "submittedAt" TIMESTAMP(3),
    "submittedById" UUID,
    "hodApprovedAt" TIMESTAMP(3),
    "hodApprovedById" UUID,
    "deanApprovedAt" TIMESTAMP(3),
    "deanApprovedById" UUID,
    "publishedAt" TIMESTAMP(3),
    "publishedById" UUID,
    "returnNote" TEXT,
    "returnedAt" TIMESTAMP(3),
    "returnedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseResult" (
    "id" UUID NOT NULL,
    "sheetId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "credits" INTEGER NOT NULL,
    "caScore" DOUBLE PRECISION NOT NULL,
    "examScore" DOUBLE PRECISION NOT NULL,
    "total" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "gradePoint" DOUBLE PRECISION NOT NULL,
    "isPass" BOOLEAN NOT NULL,
    "incomplete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CourseResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeCourse" (
    "programmeId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "semesterNo" INTEGER NOT NULL,
    "isElective" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProgrammeCourse_pkey" PRIMARY KEY ("programmeId","courseId")
);

-- CreateTable
CREATE TABLE "CourseOffering" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferingLecturer" (
    "offeringId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferingLecturer_pkey" PRIMARY KEY ("offeringId","userId")
);

-- CreateTable
CREATE TABLE "CourseRegistration" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "semesterId" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRegistrationItem" (
    "registrationId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,

    CONSTRAINT "CourseRegistrationItem_pkey" PRIMARY KEY ("registrationId","offeringId")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_code_key" ON "School"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Programme_code_key" ON "Programme"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_label_key" ON "AcademicYear"("label");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_academicYearId_number_key" ON "Semester"("academicYearId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_scope_key" ON "UserRole"("userId", "roleId", "scope");

-- CreateIndex
CREATE INDEX "DeveloperAccessGrant_userId_revokedAt_idx" ON "DeveloperAccessGrant"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Hostel_name_key" ON "Hostel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Room_hostelId_number_key" ON "Room"("hostelId", "number");

-- CreateIndex
CREATE INDEX "HostelApplication_semesterId_status_idx" ON "HostelApplication"("semesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HostelApplication_semesterId_studentId_key" ON "HostelApplication"("semesterId", "studentId");

-- CreateIndex
CREATE INDEX "RoomAllocation_roomId_status_idx" ON "RoomAllocation"("roomId", "status");

-- CreateIndex
CREATE INDEX "RoomAllocation_semesterId_studentId_idx" ON "RoomAllocation"("semesterId", "studentId");

-- CreateIndex
CREATE INDEX "RoomAllocation_status_acceptBy_idx" ON "RoomAllocation"("status", "acceptBy");

-- CreateIndex
CREATE INDEX "PrivateBooking_roomTypeId_status_idx" ON "PrivateBooking"("roomTypeId", "status");

-- CreateIndex
CREATE INDEX "PrivateBooking_semesterId_studentId_idx" ON "PrivateBooking"("semesterId", "studentId");

-- CreateIndex
CREATE INDEX "ClassSession_offeringId_startsAt_idx" ON "ClassSession"("offeringId", "startsAt");

-- CreateIndex
CREATE INDEX "ClassSession_checkInClosesAt_idx" ON "ClassSession"("checkInClosesAt");

-- CreateIndex
CREATE INDEX "AttendanceRecord_studentId_idx" ON "AttendanceRecord"("studentId");

-- CreateIndex
CREATE INDEX "AttendanceExcuse_studentId_fromDate_toDate_idx" ON "AttendanceExcuse"("studentId", "fromDate", "toDate");

-- CreateIndex
CREATE UNIQUE INDEX "DevotionService_date_key" ON "DevotionService"("date");

-- CreateIndex
CREATE INDEX "DevotionService_semesterId_date_idx" ON "DevotionService"("semesterId", "date");

-- CreateIndex
CREATE INDEX "DevotionService_endsAt_closedAt_idx" ON "DevotionService"("endsAt", "closedAt");

-- CreateIndex
CREATE INDEX "DevotionRecord_studentId_idx" ON "DevotionRecord"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamVenue_name_key" ON "ExamVenue"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExamTimetable_semesterId_key" ON "ExamTimetable"("semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSession_offeringId_key" ON "ExamSession"("offeringId");

-- CreateIndex
CREATE INDEX "ExamSession_timetableId_startsAt_idx" ON "ExamSession"("timetableId", "startsAt");

-- CreateIndex
CREATE INDEX "ExamInvigilator_userId_idx" ON "ExamInvigilator"("userId");

-- CreateIndex
CREATE INDEX "ExamHold_semesterId_liftedAt_idx" ON "ExamHold"("semesterId", "liftedAt");

-- CreateIndex
CREATE INDEX "ExamHold_studentId_idx" ON "ExamHold"("studentId");

-- CreateIndex
CREATE INDEX "ExamEligibility_semesterId_status_idx" ON "ExamEligibility"("semesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExamEligibility_semesterId_studentId_offeringId_key" ON "ExamEligibility"("semesterId", "studentId", "offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_indexNumber_key" ON "User"("indexNumber");

-- CreateIndex
CREATE INDEX "User_type_status_idx" ON "User"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE INDEX "StudentProfile_programmeId_idx" ON "StudentProfile"("programmeId");

-- CreateIndex
CREATE INDEX "StudentProfile_admissionYear_levelCode_idx" ON "StudentProfile"("admissionYear", "levelCode");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_staffNumber_key" ON "StaffProfile"("staffNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MfaFactor_userId_key" ON "MfaFactor"("userId");

-- CreateIndex
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetCode_userId_idx" ON "PasswordResetCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountSetupToken_tokenHash_key" ON "AccountSetupToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountSetupToken_userId_idx" ON "AccountSetupToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryTitle_isbn_key" ON "LibraryTitle"("isbn");

-- CreateIndex
CREATE INDEX "LibraryTitle_title_idx" ON "LibraryTitle"("title");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCopy_barcode_key" ON "LibraryCopy"("barcode");

-- CreateIndex
CREATE INDEX "LibraryCopy_titleId_status_idx" ON "LibraryCopy"("titleId", "status");

-- CreateIndex
CREATE INDEX "Loan_borrowerId_status_idx" ON "Loan"("borrowerId", "status");

-- CreateIndex
CREATE INDEX "Loan_status_dueAt_idx" ON "Loan"("status", "dueAt");

-- CreateIndex
CREATE INDEX "LibraryReservation_titleId_status_createdAt_idx" ON "LibraryReservation"("titleId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "LibraryReservation_borrowerId_status_idx" ON "LibraryReservation"("borrowerId", "status");

-- CreateIndex
CREATE INDEX "LibraryFine_borrowerId_settledAt_idx" ON "LibraryFine"("borrowerId", "settledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_name_key" ON "Vendor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MenuCategory_vendorId_name_key" ON "MenuCategory"("vendorId", "name");

-- CreateIndex
CREATE INDEX "MenuItem_vendorId_isAvailable_idx" ON "MenuItem"("vendorId", "isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "FoodOrder_number_key" ON "FoodOrder"("number");

-- CreateIndex
CREATE INDEX "FoodOrder_vendorId_status_idx" ON "FoodOrder"("vendorId", "status");

-- CreateIndex
CREATE INDEX "FoodOrder_customerId_createdAt_idx" ON "FoodOrder"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "FoodOrder_status_createdAt_idx" ON "FoodOrder"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_occurredAt_idx" ON "AuditLog"("actorId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_logGroup_occurredAt_idx" ON "AuditLog"("logGroup", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_module_action_idx" ON "AuditLog"("module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_eventKey_key" ON "NotificationTemplate"("eventKey");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_channel_idx" ON "NotificationDelivery"("status", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "GradingScale_version_key" ON "GradingScale"("version");

-- CreateIndex
CREATE UNIQUE INDEX "GradeBand_scaleId_letter_key" ON "GradeBand"("scaleId", "letter");

-- CreateIndex
CREATE UNIQUE INDEX "GradeBand_scaleId_minScore_key" ON "GradeBand"("scaleId", "minScore");

-- CreateIndex
CREATE INDEX "Assessment_offeringId_idx" ON "Assessment"("offeringId");

-- CreateIndex
CREATE INDEX "AssessmentMark_studentId_idx" ON "AssessmentMark"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ResultSheet_offeringId_key" ON "ResultSheet"("offeringId");

-- CreateIndex
CREATE INDEX "ResultSheet_status_idx" ON "ResultSheet"("status");

-- CreateIndex
CREATE INDEX "CourseResult_studentId_idx" ON "CourseResult"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseResult_sheetId_studentId_key" ON "CourseResult"("sheetId", "studentId");

-- CreateIndex
CREATE INDEX "ProgrammeCourse_programmeId_level_semesterNo_idx" ON "ProgrammeCourse"("programmeId", "level", "semesterNo");

-- CreateIndex
CREATE INDEX "CourseOffering_semesterId_idx" ON "CourseOffering"("semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOffering_courseId_semesterId_key" ON "CourseOffering"("courseId", "semesterId");

-- CreateIndex
CREATE INDEX "OfferingLecturer_userId_idx" ON "OfferingLecturer"("userId");

-- CreateIndex
CREATE INDEX "CourseRegistration_semesterId_status_idx" ON "CourseRegistration"("semesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistration_studentId_semesterId_key" ON "CourseRegistration"("studentId", "semesterId");

-- CreateIndex
CREATE INDEX "CourseRegistrationItem_offeringId_idx" ON "CourseRegistrationItem"("offeringId");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_levelCode_fkey" FOREIGN KEY ("levelCode") REFERENCES "ProgrammeLevel"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperAccessGrant" ADD CONSTRAINT "DeveloperAccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperAccessGrant" ADD CONSTRAINT "DeveloperAccessGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hostel" ADD CONSTRAINT "Hostel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "Hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccommodationRound" ADD CONSTRAINT "AccommodationRound_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostelApplication" ADD CONSTRAINT "HostelApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAllocation" ADD CONSTRAINT "RoomAllocation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateRoomType" ADD CONSTRAINT "PrivateRoomType_hostelId_fkey" FOREIGN KEY ("hostelId") REFERENCES "Hostel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateBooking" ADD CONSTRAINT "PrivateBooking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateBooking" ADD CONSTRAINT "PrivateBooking_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "PrivateRoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidenceDeclaration" ADD CONSTRAINT "ResidenceDeclaration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceExcuse" ADD CONSTRAINT "AttendanceExcuse_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevotionService" ADD CONSTRAINT "DevotionService_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevotionRecord" ADD CONSTRAINT "DevotionRecord_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "DevotionService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevotionRecord" ADD CONSTRAINT "DevotionRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevotionResult" ADD CONSTRAINT "DevotionResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevotionResult" ADD CONSTRAINT "DevotionResult_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTimetable" ADD CONSTRAINT "ExamTimetable_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_timetableId_fkey" FOREIGN KEY ("timetableId") REFERENCES "ExamTimetable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "ExamVenue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamInvigilator" ADD CONSTRAINT "ExamInvigilator_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamInvigilator" ADD CONSTRAINT "ExamInvigilator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialClearance" ADD CONSTRAINT "FinancialClearance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialClearance" ADD CONSTRAINT "FinancialClearance_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamHold" ADD CONSTRAINT "ExamHold_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamHold" ADD CONSTRAINT "ExamHold_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamHold" ADD CONSTRAINT "ExamHold_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamEligibilityList" ADD CONSTRAINT "ExamEligibilityList_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamEligibility" ADD CONSTRAINT "ExamEligibility_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamEligibility" ADD CONSTRAINT "ExamEligibility_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaFactor" ADD CONSTRAINT "MfaFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetCode" ADD CONSTRAINT "PasswordResetCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSetupToken" ADD CONSTRAINT "AccountSetupToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCopy" ADD CONSTRAINT "LibraryCopy_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "LibraryTitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryReservation" ADD CONSTRAINT "LibraryReservation_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "LibraryTitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryReservation" ADD CONSTRAINT "LibraryReservation_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryReservation" ADD CONSTRAINT "LibraryReservation_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryFine" ADD CONSTRAINT "LibraryFine_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryFine" ADD CONSTRAINT "LibraryFine_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinePayment" ADD CONSTRAINT "FinePayment_fineId_fkey" FOREIGN KEY ("fineId") REFERENCES "LibraryFine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodOrderItem" ADD CONSTRAINT "FoodOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FoodOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FoodOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayout" ADD CONSTRAINT "VendorPayout_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeBand" ADD CONSTRAINT "GradeBand_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "GradingScale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentMark" ADD CONSTRAINT "AssessmentMark_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentMark" ADD CONSTRAINT "AssessmentMark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultSheet" ADD CONSTRAINT "ResultSheet_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultSheet" ADD CONSTRAINT "ResultSheet_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "GradingScale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResult" ADD CONSTRAINT "CourseResult_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "ResultSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseResult" ADD CONSTRAINT "CourseResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeCourse" ADD CONSTRAINT "ProgrammeCourse_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeCourse" ADD CONSTRAINT "ProgrammeCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferingLecturer" ADD CONSTRAINT "OfferingLecturer_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferingLecturer" ADD CONSTRAINT "OfferingLecturer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistrationItem" ADD CONSTRAINT "CourseRegistrationItem_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "CourseRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistrationItem" ADD CONSTRAINT "CourseRegistrationItem_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
