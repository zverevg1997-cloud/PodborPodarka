import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/** Сколько регистраций разрешаем с одного IP за окно. */
export const REGISTRATIONS_PER_IP = 5;

/** Длина окна в часах. */
const WINDOW_HOURS = 1;

/** Насколько долго храним записи о попытках, прежде чем удалить. */
const RETENTION_HOURS = 24;

/**
 * IP клиента. За Vercel запрос всегда приходит через прокси, поэтому реальный
 * адрес лежит в x-forwarded-for; первый элемент списка — исходный клиент.
 * Заголовок подделывается, но на Vercel его перезаписывает сам прокси.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Проверяет, не исчерпан ли лимит регистраций для IP, и сразу же учитывает
 * текущую попытку. Считаем именно попытки, а не успешные регистрации: иначе
 * перебор занятых адресов лимитом не ограничивался бы.
 */
export async function checkRegistrationLimit(
  ip: string,
): Promise<{ allowed: boolean }> {
  const windowStart = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);

  const recent = await prisma.registrationAttempt.count({
    where: { ip, createdAt: { gte: windowStart } },
  });

  if (recent >= REGISTRATIONS_PER_IP) {
    return { allowed: false };
  }

  await prisma.registrationAttempt.create({ data: { ip } });

  // Подчищаем старые записи, чтобы таблица не росла бесконечно. Делаем это
  // изредка и не ждём результата — на ответ пользователю это влиять не должно.
  if (Math.random() < 0.05) {
    const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000);
    void prisma.registrationAttempt
      .deleteMany({ where: { createdAt: { lt: cutoff } } })
      .catch(() => {});
  }

  return { allowed: true };
}
