-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "agency_id" UUID;

-- CreateIndex
CREATE INDEX "ad_campaigns_status_idx" ON "ad_campaigns"("status");

-- CreateIndex
CREATE INDEX "approval_flows_status_idx" ON "approval_flows"("status");

-- CreateIndex
CREATE INDEX "approval_steps_approver_id_idx" ON "approval_steps"("approver_id");

-- CreateIndex
CREATE INDEX "audit_logs_agency_id_idx" ON "audit_logs"("agency_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "content_items_status_idx" ON "content_items"("status");

-- CreateIndex
CREATE INDEX "inbox_messages_client_id_is_read_idx" ON "inbox_messages"("client_id", "is_read");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "scheduled_posts_status_scheduled_time_idx" ON "scheduled_posts"("status", "scheduled_time");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "user_client_access_client_id_idx" ON "user_client_access"("client_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
