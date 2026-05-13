-- CreateTable
CREATE TABLE "posting_history" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "oldCenterId" TEXT,
    "newCenterId" TEXT,
    "transferredById" TEXT NOT NULL,
    "reason" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posting_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "posting_history" ADD CONSTRAINT "posting_history_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posting_history" ADD CONSTRAINT "posting_history_transferredById_fkey" FOREIGN KEY ("transferredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
