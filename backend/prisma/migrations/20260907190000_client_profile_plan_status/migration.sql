-- CreateEnum
CREATE TYPE "ClientPlan" AS ENUM ('BASIC', 'PRO', 'BUSINESS', 'ENTERPRISE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'PENDING_ONBOARDING', 'INACTIVE', 'BLOCKED');

-- AlterTable
ALTER TABLE "clients"
  ADD COLUMN "contact_name" TEXT,
  ADD COLUMN "contact_email" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "website" TEXT,
  ADD COLUMN "business_type" TEXT,
  ADD COLUMN "industry" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "plan" "ClientPlan" NOT NULL DEFAULT 'BASIC',
  ADD COLUMN "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE';
