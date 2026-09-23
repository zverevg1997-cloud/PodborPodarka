-- Профиль получателя теперь может принадлежать гостю, а не только аккаунту.
--
-- До этого увидеть хотя бы одну идею можно было только после регистрации и
-- подтверждения почты — стена ровно там, где у человека ещё нет причин
-- доверять сервису. Первый подбор делаем доступным без аккаунта.
--
-- guestIp хранится, чтобы очистка куки не давала бесконечные бесплатные
-- подборы: по нему считается дневной предел на адрес.

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "guestId" TEXT,
ADD COLUMN     "guestIp" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "profiles_guestId_idx" ON "profiles"("guestId");

-- CreateIndex
CREATE INDEX "profiles_guestIp_createdAt_idx" ON "profiles"("guestIp", "createdAt");

