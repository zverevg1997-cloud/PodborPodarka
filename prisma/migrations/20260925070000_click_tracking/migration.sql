-- Учёт кликов по идеям и меток источников.
--
-- Клик по идее — главное полезное действие сервиса: именно он приносит
-- партнёрское вознаграждение. На сайте его считала Метрика, но в боте
-- нашего кода нет вовсе, а Метрика туда не дотягивается. Поэтому считаем
-- на сервере, в точке редиректа, одинаково для всех источников.

-- AlterTable
ALTER TABLE "telegram_chats" ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "link_clicks" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "link_clicks_createdAt_idx" ON "link_clicks"("createdAt");

-- CreateIndex
CREATE INDEX "link_clicks_source_createdAt_idx" ON "link_clicks"("source", "createdAt");
