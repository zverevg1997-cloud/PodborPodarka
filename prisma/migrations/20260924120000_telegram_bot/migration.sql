-- Телеграм-бот: состояние диалога и третий тип владельца профиля.
--
-- Состояние держим в базе, а не в памяти процесса: контейнер
-- перезапускается при каждом деплое, и разговор оборвался бы на середине.

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "telegramChat" TEXT;

-- CreateTable
CREATE TABLE "telegram_chats" (
    "id" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'idle',
    "draftJson" JSONB,
    "lastSearchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_chats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profiles_telegramChat_idx" ON "profiles"("telegramChat");
