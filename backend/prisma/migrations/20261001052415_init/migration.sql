-- CreateEnum
CREATE TYPE "SummerKind" AS ENUM ('PROMOTIONAL', 'UPGRADE');

-- AlterTable
ALTER TABLE "CourseRegistration" ADD COLUMN     "mainStage" INTEGER;

-- AlterTable
ALTER TABLE "Semester" ADD COLUMN     "summerKind" "SummerKind";
