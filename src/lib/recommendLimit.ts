import { prisma } from "@/lib/prisma";

/** Сколько подборов в сутки доступно одному пользователю. */
export const DAILY_RECOMMEND_LIMIT = 5;

// Москва круглый год UTC+3, перехода на летнее время нет — поэтому смещение
// можно держать константой, не подтягивая библиотеку часовых поясов.
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Начало текущих суток по московскому времени.
 *
 * Раньше сутки считались по UTC, то есть лимит обновлялся в три часа ночи по
 * Москве и ещё позже восточнее. Пока счётчика не было видно, это никого не
 * смущало; теперь он на экране, и момент обнуления должен быть объяснимым.
 */
export function startOfDay(now: Date = new Date()): Date {
  const moscow = new Date(now.getTime() + MSK_OFFSET_MS);
  moscow.setUTCHours(0, 0, 0, 0);
  return new Date(moscow.getTime() - MSK_OFFSET_MS);
}

/** Сколько подборов пользователь сделал за сегодня. */
export async function countTodaySearches(userId: string): Promise<number> {
  return prisma.search.count({
    where: {
      profile: { userId },
      createdAt: { gte: startOfDay() },
    },
  });
}
