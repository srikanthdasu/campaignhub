-- externalPostId: the real platform post ID after a successful publish (Instagram today) — was
-- previously discarded, leaving no way to reference the post back for analytics or deletion.
-- retryCount: bounded manual retries for a FAILED post (see SchedulerService.MAX_RETRIES).
ALTER TABLE "scheduled_posts" ADD COLUMN "external_post_id" TEXT;
ALTER TABLE "scheduled_posts" ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0;
