-- AlterTable
ALTER TABLE "clients"
  ADD COLUMN "address" TEXT,
  ADD COLUMN "time_zone" TEXT,
  ADD COLUMN "currency" TEXT,
  ADD COLUMN "default_language" TEXT,
  ADD COLUMN "allow_client_portal_access" BOOLEAN NOT NULL DEFAULT true;
