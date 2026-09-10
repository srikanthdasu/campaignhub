-- Lets AI-generated (and uploaded) media be tagged to a campaign, same relation shape as
-- content_items.campaign_id, so the AI Image Studio's client+campaign selector is real.
ALTER TABLE "media_assets" ADD COLUMN "campaign_id" UUID;
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "media_assets_campaign_id_idx" ON "media_assets"("campaign_id");
