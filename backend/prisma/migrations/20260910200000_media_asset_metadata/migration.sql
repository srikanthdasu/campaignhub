-- Real, previously-untracked media metadata: an editable title/description (separate from the
-- original fileName), the actual byte size captured at upload/generation time, and when an
-- asset was last attached to content (not just how many times, which usage_count already had).
ALTER TABLE "media_assets" ADD COLUMN "title" TEXT;
ALTER TABLE "media_assets" ADD COLUMN "description" TEXT;
ALTER TABLE "media_assets" ADD COLUMN "file_size" INTEGER;
ALTER TABLE "media_assets" ADD COLUMN "last_used_at" TIMESTAMP(3);
