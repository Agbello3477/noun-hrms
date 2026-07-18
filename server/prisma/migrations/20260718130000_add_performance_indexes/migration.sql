-- CreateIndex
CREATE INDEX "clinic_encounters_patientFileId_idx" ON "clinic_encounters"("patientFileId");

-- CreateIndex
CREATE INDEX "clinic_encounters_status_idx" ON "clinic_encounters"("status");

-- CreateIndex
CREATE INDEX "security_incidents_status_idx" ON "security_incidents"("status");

-- CreateIndex
CREATE INDEX "security_incidents_category_idx" ON "security_incidents"("category");

-- CreateIndex
CREATE INDEX "security_incidents_priority_idx" ON "security_incidents"("priority");

-- CreateIndex
CREATE INDEX "security_incidents_createdAt_idx" ON "security_incidents"("createdAt");
