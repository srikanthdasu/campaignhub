-- DropIndex
DROP INDEX "ad_campaigns_client_id_idx";

-- DropIndex
DROP INDEX "campaigns_client_id_idx";

-- DropIndex
DROP INDEX "email_campaigns_client_id_idx";

-- DropIndex
DROP INDEX "inbox_messages_client_id_idx";

-- DropIndex
DROP INDEX "invoices_agency_id_idx";

-- CreateIndex
CREATE INDEX "ad_campaigns_client_id_status_idx" ON "ad_campaigns"("client_id", "status");

-- CreateIndex
CREATE INDEX "campaigns_client_id_status_idx" ON "campaigns"("client_id", "status");

-- CreateIndex
CREATE INDEX "email_campaigns_client_id_status_idx" ON "email_campaigns"("client_id", "status");

-- CreateIndex
CREATE INDEX "inbox_messages_client_id_received_at_idx" ON "inbox_messages"("client_id", "received_at");

-- CreateIndex
CREATE INDEX "invoices_agency_id_issued_at_idx" ON "invoices"("agency_id", "issued_at");

-- Manually-added social accounts (externalAccountId IS NULL) were never covered by
-- @@unique([clientId, platform, externalAccountId]) — Postgres treats every NULL as distinct,
-- so that constraint is a no-op for the normal manual-add path. social-accounts.service.ts
-- already checks for this case-insensitively before creating (label ILIKE match); this is the
-- DB-level backstop for the race a check-then-insert can't close on its own. Confirmed no
-- existing duplicates before adding this.
CREATE UNIQUE INDEX "social_accounts_manual_client_platform_label_key"
  ON "social_accounts" ("client_id", "platform", LOWER("label"))
  WHERE "external_account_id" IS NULL;
