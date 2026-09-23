-- CreateTable
CREATE TABLE "demo_leads" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "demo_leads_created_at_idx" ON "demo_leads"("created_at");
