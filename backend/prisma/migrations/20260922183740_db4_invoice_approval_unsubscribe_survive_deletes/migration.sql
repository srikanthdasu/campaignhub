-- DropForeignKey
ALTER TABLE "approval_flows" DROP CONSTRAINT "approval_flows_content_item_id_fkey";

-- DropForeignKey
ALTER TABLE "email_unsubscribes" DROP CONSTRAINT "email_unsubscribes_client_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_agency_id_fkey";

-- AlterTable
ALTER TABLE "email_unsubscribes" ALTER COLUMN "client_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "approval_flows" ADD CONSTRAINT "approval_flows_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_unsubscribes" ADD CONSTRAINT "email_unsubscribes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
