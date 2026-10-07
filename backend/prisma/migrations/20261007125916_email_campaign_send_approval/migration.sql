-- AlterEnum
ALTER TYPE "EmailCampaignStatus" ADD VALUE 'PENDING_APPROVAL';

-- AlterTable
ALTER TABLE "email_campaigns" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" UUID,
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "requested_at" TIMESTAMP(3),
ADD COLUMN     "requested_by_id" UUID;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
