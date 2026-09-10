-- Soft-delete support for clients: a 15-day recoverable grace period before permanent purge.
ALTER TABLE "clients" ADD COLUMN "deleted_at" TIMESTAMP(3);
