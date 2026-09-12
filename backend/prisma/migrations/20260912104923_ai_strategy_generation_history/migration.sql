-- CreateTable
CREATE TABLE "ai_strategy_generations" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "output" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_strategy_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_strategy_generations_request_id_idx" ON "ai_strategy_generations"("request_id");

-- AddForeignKey
ALTER TABLE "ai_strategy_generations" ADD CONSTRAINT "ai_strategy_generations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "ai_strategy_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
