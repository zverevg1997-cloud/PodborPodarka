-- Запланированные посты в сообщество и канал.
CREATE TABLE "scheduled_posts" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "publishAt" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'post',
    "networks" TEXT NOT NULL,
    "textVk" TEXT NOT NULL,
    "textTg" TEXT NOT NULL,
    "needsPhoto" BOOLEAN NOT NULL DEFAULT false,
    "photoFileId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "vkPostId" TEXT,
    "tgMessageId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scheduled_posts_key_key" ON "scheduled_posts"("key");
CREATE INDEX "scheduled_posts_status_publishAt_idx" ON "scheduled_posts"("status", "publishAt");

-- Как и у остальных таблиц: снаружи в базу ходит только приложение,
-- политики не заводим, но RLS включаем, чтобы линтер не ругался.
ALTER TABLE "scheduled_posts" ENABLE ROW LEVEL SECURITY;
