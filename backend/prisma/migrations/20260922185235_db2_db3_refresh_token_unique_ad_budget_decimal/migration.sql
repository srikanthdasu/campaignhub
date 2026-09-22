-- DB-2: the hottest query on the auth path (every token refresh) had no index at all.
-- Confirmed no duplicate token_hash values exist before adding this.
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- DB-3: money stored as binary floating point — same bug already fixed for Invoice, not carried
-- across to AdCampaign's budget field.
ALTER TABLE "ad_campaigns" ALTER COLUMN "budget_amount" SET DATA TYPE DECIMAL(12,2);

-- Matching Invoice's non-negative CHECK constraint precedent.
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_budget_amount_non_negative" CHECK ("budget_amount" >= 0);
