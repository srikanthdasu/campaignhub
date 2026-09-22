-- DropIndex
DROP INDEX "clients_agency_id_idx";

-- DropIndex
DROP INDEX "email_recipients_campaign_id_idx";

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "gst_amount" SET DATA TYPE DECIMAL(12,2);

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_approval_flow_id_step_order_key" ON "approval_steps"("approval_flow_id", "step_order");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_approval_flow_id_approver_id_key" ON "approval_steps"("approval_flow_id", "approver_id");

-- CreateIndex
CREATE INDEX "audit_logs_agency_id_created_at_idx" ON "audit_logs"("agency_id", "created_at");

-- CreateIndex
CREATE INDEX "clients_agency_id_deleted_at_idx" ON "clients"("agency_id", "deleted_at");

-- CreateIndex
CREATE INDEX "content_items_client_id_status_idx" ON "content_items"("client_id", "status");

-- CreateIndex
CREATE INDEX "email_campaigns_status_idx" ON "email_campaigns"("status");

-- CreateIndex
CREATE INDEX "email_recipients_campaign_id_status_idx" ON "email_recipients"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_revoked_at_idx" ON "refresh_tokens"("revoked_at");

-- CreateIndex
CREATE INDEX "users_agency_id_role_idx" ON "users"("agency_id", "role");

-- Business rules the Prisma schema itself can't express (no @@check, no partial/filtered
-- @@unique) — hand-added, same technique used elsewhere in this project's migrations.

-- Invoice amounts must never go negative — nothing in the app should ever try to write one, but
-- this is the actual backstop if something upstream (a future refund/credit-note feature, a bug)
-- ever does.
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amount_non_negative" CHECK ("amount" >= 0);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_gst_amount_non_negative" CHECK ("gst_amount" >= 0);

-- One active (non-soft-deleted) client name per agency. A blanket unique on (agency_id, name)
-- would wrongly block reusing a name after a soft-delete, since the old deleted row would still
-- occupy it — the partial WHERE clause is what makes that safe, and Prisma's @@unique syntax has
-- no way to express it. Confirmed no existing duplicate active names before adding this.
CREATE UNIQUE INDEX "clients_agency_id_name_active_key" ON "clients"("agency_id", "name") WHERE "deleted_at" IS NULL;
