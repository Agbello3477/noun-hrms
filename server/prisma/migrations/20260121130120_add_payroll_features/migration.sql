/*
  Warnings:

  - You are about to drop the column `baseSalary` on the `payroll_records` table. All the data in the column will be lost.
  - You are about to drop the column `bonus` on the `payroll_records` table. All the data in the column will be lost.
  - You are about to drop the column `deductions` on the `payroll_records` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,month,year]` on the table `payroll_records` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `basicSalary` to the `payroll_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `grossPay` to the `payroll_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `otherDeductions` to the `payroll_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pension` to the `payroll_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tax` to the `payroll_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAllowances` to the `payroll_records` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalDeductions` to the `payroll_records` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QueryStatus" AS ENUM ('OPEN', 'RESPONDED', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeaveType" ADD VALUE 'PATERNITY';
ALTER TYPE "LeaveType" ADD VALUE 'SABBATICAL';
ALTER TYPE "LeaveType" ADD VALUE 'WITHOUT_PAY';

-- AlterTable
ALTER TABLE "payroll_records" DROP COLUMN "baseSalary",
DROP COLUMN "bonus",
DROP COLUMN "deductions",
ADD COLUMN     "basicSalary" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "grossPay" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "otherDeductions" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "paymentDate" TIMESTAMP(3),
ADD COLUMN     "pension" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "tax" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalAllowances" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalDeductions" DOUBLE PRECISION NOT NULL;

-- CreateTable
CREATE TABLE "salary_scales" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_scales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_levels" (
    "id" TEXT NOT NULL,
    "scaleId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL,
    "rent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transport" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "meal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "utility" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "entertainment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consolidated" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_requests" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "accessLink" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_queries" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "response" TEXT,
    "responseAttachmentUrl" TEXT,
    "status" "QueryStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_queries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salary_scales_name_key" ON "salary_scales"("name");

-- CreateIndex
CREATE UNIQUE INDEX "salary_levels_scaleId_level_step_key" ON "salary_levels"("scaleId", "level", "step");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_userId_month_year_key" ON "payroll_records"("userId", "month", "year");

-- AddForeignKey
ALTER TABLE "salary_levels" ADD CONSTRAINT "salary_levels_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "salary_scales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_requests" ADD CONSTRAINT "file_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_requests" ADD CONSTRAINT "file_requests_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_queries" ADD CONSTRAINT "staff_queries_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_queries" ADD CONSTRAINT "staff_queries_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
