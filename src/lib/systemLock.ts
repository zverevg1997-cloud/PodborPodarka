import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Замок на фоновую работу, которую должен выполнять ровно один процесс.
 *
 * Понадобился слушателю телеграма: при выкатке старый контейнер живёт ещё
 * какое-то время рядом с новым, оба забирают обновления и перебивают друг
 * друга — телеграм отвечает обоим ошибкой Conflict, и бот замолкает.
 *
 * Это аренда, а не вечный замок: процесс может умереть, не отпустив его,
 * и тогда бот молчал бы до следующей выкатки. Владелец продлевает аренду
 * на каждом круге, а чужой процесс может забрать её, только когда срок истёк.
 */

/** На сколько берём замок. Больше, чем один круг ожидания, но не намного. */
const LEASE_MS = 90_000;

/** Идентификатор этого процесса. Живёт столько же, сколько он сам. */
export const PROCESS_ID = randomUUID();

/**
 * Пытается взять или продлить замок. Возвращает true, если он наш.
 *
 * Условие в WHERE делает проверку и захват одной операцией: два процесса не
 * могут увидеть свободный замок одновременно и оба решить, что он их.
 */
export async function holdLock(name: string): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LEASE_MS);

  const { count } = await prisma.systemLock.updateMany({
    where: {
      id: name,
      OR: [{ holder: PROCESS_ID }, { expiresAt: { lt: now } }],
    },
    data: { holder: PROCESS_ID, expiresAt },
  });

  if (count > 0) return true;

  // Строки может не быть вовсе — первый запуск. Создание упадёт, если её
  // только что создал другой процесс, и это нормальный отрицательный ответ.
  try {
    await prisma.systemLock.create({
      data: { id: name, holder: PROCESS_ID, expiresAt },
    });
    return true;
  } catch {
    return false;
  }
}

/** Отпускает замок, чтобы следующий процесс не ждал истечения аренды. */
export async function releaseLock(name: string): Promise<void> {
  await prisma.systemLock
    .deleteMany({ where: { id: name, holder: PROCESS_ID } })
    .catch(() => {});
}
