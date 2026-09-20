-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMP(3),
ADD COLUMN     "verification_token_expires_at" TIMESTAMP(3),
ADD COLUMN     "verification_token_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_verification_token_hash_key" ON "users"("verification_token_hash");

-- Backfill: grandfather in every user that existed before this migration — they were never put
-- through a verification flow, and locking out real existing accounts on ship day is not the
-- goal (the goal is stopping NEW unverified signups from getting instant access). This must stay
-- a one-time UPDATE, not a column DEFAULT, or every future row would be grandfathered too.
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;
