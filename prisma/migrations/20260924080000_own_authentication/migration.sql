-- Своя аутентификация вместо Supabase Auth.
--
-- Supabase хранил почты и хэши паролей на серверах за пределами России, а
-- 152-ФЗ требует, чтобы персональные данные россиян лежали здесь. Заодно
-- уходит внешняя зависимость, недоступность которой клала вход целиком.
--
-- Пароли переносятся из Supabase как есть: там bcrypt формата $2a$, наша
-- библиотека проверяет и его, и новый $2b$. Никому ничего менять не нужно.

-- AlterTable
-- Значение по умолчанию нужно только на время добавления столбца: без него
-- команда падает, если в таблице уже есть строки. Сразу после — убираем,
-- чтобы пустой пароль нельзя было записать случайно.
ALTER TABLE "users" ADD COLUMN     "passwordHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emailConfirmedAt" TIMESTAMP(3);
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP DEFAULT;

-- CreateTable
-- id — хэш токена из куки, а не сам токен: по утёкшей базе чужую сессию
-- не восстановить.
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "email_tokens_userId_purpose_idx" ON "email_tokens"("userId", "purpose");

-- CreateIndex
CREATE INDEX "email_tokens_expiresAt_idx" ON "email_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
