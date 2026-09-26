-- Вход через ВКонтакте.
--
-- Почта и пароль перестают быть обязательными: во ВКонтакте аккаунт заводят
-- на телефон, и адреса у человека может не быть вовсе.
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN "vkId" TEXT;
ALTER TABLE "users" ADD COLUMN "name" TEXT;
ALTER TABLE "users" ADD COLUMN "avatarUrl" TEXT;

CREATE UNIQUE INDEX "users_vkId_key" ON "users"("vkId");
