-- ContentItem.updatedAt: backfill existing rows from created_at before enforcing NOT NULL,
-- rather than the naive "ADD COLUMN ... NOT NULL" that only works on an empty table.
ALTER TABLE "content_items" ADD COLUMN     "updated_at" TIMESTAMP(3);
UPDATE "content_items" SET "updated_at" = "created_at";
ALTER TABLE "content_items" ALTER COLUMN "updated_at" SET NOT NULL;

-- Agency.plan / Agency.subscription_status were dead columns: frozen at their schema defaults
-- forever since AgenciesService derives the real plan/status from the Subscription row instead
-- (see agencies.service.ts). Dropping them, not converting to an enum — there is nothing to
-- coordinate, the columns were never read.
ALTER TABLE "agencies" DROP COLUMN "plan",
DROP COLUMN "subscription_status";

-- Currency enum: Client.currency, AdCampaign.budgetCurrency and Invoice.currency were free
-- strings with no shared vocabulary. Converts each to the new enum defensively — any existing
-- value outside the known set falls back to NULL (nullable Client.currency) or the column's own
-- prior default (NOT NULL columns), rather than assuming production data is already clean.
CREATE TYPE "Currency" AS ENUM ('USD', 'INR', 'EUR', 'GBP');

ALTER TABLE "clients"
  ALTER COLUMN "currency" TYPE "Currency" USING (
    CASE WHEN "currency" IN ('USD', 'INR', 'EUR', 'GBP') THEN "currency"::"Currency" ELSE NULL END
  );

-- DROP DEFAULT first: Postgres can't auto-cast an existing text DEFAULT to the new enum type
-- as part of the same ALTER, even though the USING clause handles the column's row values fine.
ALTER TABLE "ad_campaigns" ALTER COLUMN "budget_currency" DROP DEFAULT;
ALTER TABLE "ad_campaigns"
  ALTER COLUMN "budget_currency" TYPE "Currency" USING (
    CASE WHEN "budget_currency" IN ('USD', 'INR', 'EUR', 'GBP') THEN "budget_currency"::"Currency" ELSE 'USD'::"Currency" END
  );
ALTER TABLE "ad_campaigns" ALTER COLUMN "budget_currency" SET DEFAULT 'USD';

ALTER TABLE "invoices" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "invoices"
  ALTER COLUMN "currency" TYPE "Currency" USING (
    CASE WHEN "currency" IN ('USD', 'INR', 'EUR', 'GBP') THEN "currency"::"Currency" ELSE 'INR'::"Currency" END
  );
ALTER TABLE "invoices" ALTER COLUMN "currency" SET DEFAULT 'INR';
