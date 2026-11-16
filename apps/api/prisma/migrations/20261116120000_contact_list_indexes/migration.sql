CREATE INDEX "Contact_workspaceId_ownerId_createdAt_idx" ON "Contact"("workspaceId", "ownerId", "createdAt");
CREATE INDEX "Contact_workspaceId_createdAt_idx" ON "Contact"("workspaceId", "createdAt");
CREATE INDEX "ScanItem_workspaceId_status_createdAt_idx" ON "ScanItem"("workspaceId", "status", "createdAt");
