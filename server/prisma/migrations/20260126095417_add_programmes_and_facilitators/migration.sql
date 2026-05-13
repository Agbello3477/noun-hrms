-- AlterTable
ALTER TABLE "staff_profiles" ADD COLUMN     "facilitatorInfo" JSONB,
ADD COLUMN     "programmeId" TEXT;

-- CreateTable
CREATE TABLE "academic_programmes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT,
    "faculty" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_programmes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "academic_programmes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
