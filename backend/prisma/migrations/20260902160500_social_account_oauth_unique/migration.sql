-- Enables upsert-by-(client, platform, external account) for OAuth-connected social accounts,
-- so re-connecting the same Facebook/Instagram account updates the existing row instead of
-- creating a duplicate.
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_client_id_platform_external_account_id_key" UNIQUE ("client_id", "platform", "external_account_id");
