-- Замок на фоновые задачи, которые должен выполнять ровно один процесс.
--
-- Понадобился слушателю телеграма: при выкатке старый контейнер работает
-- ещё какое-то время рядом с новым, оба забирают обновления и перебивают
-- друг друга ошибкой Conflict.

-- CreateTable
CREATE TABLE "system_locks" (
    "id" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_locks_pkey" PRIMARY KEY ("id")
);
