-- CreateEnum
CREATE TYPE "ClientEmailSenderProvider" AS ENUM ('BREVO');

-- CreateEnum
CREATE TYPE "ClientEmailSenderVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateTable
CREATE TABLE "client_email_senders" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "sender_name" TEXT NOT NULL,
    "sender_email" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "provider" "ClientEmailSenderProvider" NOT NULL DEFAULT 'BREVO',
    "verification_status" "ClientEmailSenderVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMP(3),
    "provider_domain_id" TEXT,
    "daily_send_limit" INTEGER,
    "monthly_send_limit" INTEGER,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_email_senders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_email_senders_client_id_key" ON "client_email_senders"("client_id");

-- AddForeignKey
ALTER TABLE "client_email_senders" ADD CONSTRAINT "client_email_senders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_email_senders" ADD CONSTRAINT "client_email_senders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
