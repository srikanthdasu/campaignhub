-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AiVideoStep" AS ENUM ('IDEA', 'SCRIPT', 'STORYBOARD', 'ASSETS', 'ENHANCE', 'PREVIEW', 'EXPORT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AiStrategyStatus" AS ENUM ('DRAFT', 'GENERATED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_captions" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "input" TEXT NOT NULL,
    "tone" TEXT NOT NULL DEFAULT 'Friendly',
    "platform" "SocialPlatform",
    "text" TEXT NOT NULL,
    "hashtags" TEXT[],
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_captions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_video_projects" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "idea" TEXT,
    "script" TEXT,
    "scenes" JSONB,
    "assets" JSONB,
    "enhancements" JSONB,
    "step" "AiVideoStep" NOT NULL DEFAULT 'IDEA',
    "preview_url" TEXT,
    "export_format" TEXT,
    "published_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_video_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_strategy_requests" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "context" JSONB,
    "goal" TEXT,
    "output" TEXT,
    "status" "AiStrategyStatus" NOT NULL DEFAULT 'DRAFT',
    "review_note" TEXT,
    "feedback_rating" INTEGER,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_strategy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_conversations_client_id_idx" ON "ai_conversations"("client_id");

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_idx" ON "ai_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "ai_captions_client_id_idx" ON "ai_captions"("client_id");

-- CreateIndex
CREATE INDEX "ai_video_projects_client_id_idx" ON "ai_video_projects"("client_id");

-- CreateIndex
CREATE INDEX "ai_strategy_requests_client_id_idx" ON "ai_strategy_requests"("client_id");

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_captions" ADD CONSTRAINT "ai_captions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_captions" ADD CONSTRAINT "ai_captions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_video_projects" ADD CONSTRAINT "ai_video_projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_video_projects" ADD CONSTRAINT "ai_video_projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_strategy_requests" ADD CONSTRAINT "ai_strategy_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_strategy_requests" ADD CONSTRAINT "ai_strategy_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
