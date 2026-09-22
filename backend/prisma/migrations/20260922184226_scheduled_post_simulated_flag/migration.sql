-- AlterTable
ALTER TABLE "scheduled_posts" ADD COLUMN     "simulated" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: any already-PUBLISHED post on a platform other than Instagram was, by construction,
-- a simulated publish (SchedulerService.publishPost only ever calls a real platform API for
-- Instagram) — without this, existing rows would default to simulated=false and misreport as real.
UPDATE "scheduled_posts" SET "simulated" = true WHERE "status" = 'PUBLISHED' AND "platform" != 'INSTAGRAM';
