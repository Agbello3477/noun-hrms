/*
  Warnings:

  - The `department` column on the `staff_profiles` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Department" AS ENUM ('REGISTRY_MAIN', 'REGISTRY_HR', 'REGISTRY_ACADEMIC', 'REGISTRY_COUNCIL', 'REGISTRY_TRAINING', 'BURSARY_MAIN', 'BURSARY_PAYROLL', 'BURSARY_AUDIT', 'BURSARY_ACCOUNTS', 'BURSARY_NHF', 'BURSARY_EXPENDITURE', 'STUDY_CENTER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('APPOINTMENT_LETTER', 'CREDENTIAL', 'PROMOTION_LETTER', 'PAYSLIP', 'QUERY', 'OTHER');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('CONFIDENTIAL', 'RESTRICTED', 'PUBLIC');

-- AlterTable
ALTER TABLE "staff_profiles" ADD COLUMN     "centerId" TEXT,
DROP COLUMN "department",
ADD COLUMN     "department" "Department";

-- CreateTable
CREATE TABLE "study_centers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "currentLocation" "Department" NOT NULL DEFAULT 'REGISTRY_MAIN',
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'CONFIDENTIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_trails" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fromDept" "Department" NOT NULL,
    "toDept" "Department" NOT NULL,
    "actionById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_trails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "study_centers_code_key" ON "study_centers"("code");

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "study_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_trails" ADD CONSTRAINT "document_trails_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_trails" ADD CONSTRAINT "document_trails_actionById_fkey" FOREIGN KEY ("actionById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
