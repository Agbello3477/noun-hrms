/*
  Warnings:

  - You are about to drop the column `rank` on the `staff_profiles` table. All the data in the column will be lost.
  - You are about to drop the `posting_history` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[staffId]` on the table `staff_profiles` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Cadre" AS ENUM ('ACADEMIC', 'ADMINISTRATIVE', 'TECHNICAL', 'JUNIOR');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('DIRECTORATE', 'FACULTY', 'DEPARTMENT', 'STUDY_CENTER');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'RECOMMENDED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'CASUAL', 'SICK', 'MATERNITY', 'STUDY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Department" ADD VALUE 'ACADEMIC_SCIENCES';
ALTER TYPE "Department" ADD VALUE 'ACADEMIC_ARTS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'SUPER_USER';
ALTER TYPE "Role" ADD VALUE 'HR_ADMIN';
ALTER TYPE "Role" ADD VALUE 'UNIT_HEAD';
ALTER TYPE "Role" ADD VALUE 'UNIT_ADMIN';
ALTER TYPE "Role" ADD VALUE 'BURSARY';
ALTER TYPE "Role" ADD VALUE 'AUDIT';

-- DropForeignKey
ALTER TABLE "posting_history" DROP CONSTRAINT "posting_history_staffId_fkey";

-- DropForeignKey
ALTER TABLE "posting_history" DROP CONSTRAINT "posting_history_transferredById_fkey";

-- AlterTable
ALTER TABLE "staff_profiles" DROP COLUMN "rank",
ADD COLUMN     "cadre" "Cadre",
ADD COLUMN     "emailPersonal" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "level" TEXT,
ADD COLUMN     "lga" TEXT,
ADD COLUMN     "otherNames" TEXT,
ADD COLUMN     "passportUrl" TEXT,
ADD COLUMN     "staffId" TEXT,
ADD COLUMN     "stateOfOrigin" TEXT,
ADD COLUMN     "step" TEXT,
ADD COLUMN     "surname" TEXT,
ADD COLUMN     "unitId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "posting_history";

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "UnitType" NOT NULL,
    "code" TEXT,
    "headId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_logs" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "oldCenterId" TEXT,
    "newCenterId" TEXT,
    "initiatedById" TEXT NOT NULL,
    "reason" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "recommendedById" TEXT,
    "approvedById" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "units_code_key" ON "units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_staffId_key" ON "staff_profiles"("staffId");

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_logs" ADD CONSTRAINT "transfer_logs_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_logs" ADD CONSTRAINT "transfer_logs_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_recommendedById_fkey" FOREIGN KEY ("recommendedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
