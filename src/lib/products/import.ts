/**
 * Загрузка товарных выгрузок в базу.
 *
 * Держим товары у себя, а не ходим в выгрузку при каждом обращении: файлы
 * весят от мегабайтов до сотен мегабайт, обновляются раз в сутки, а выбирать
 * из них надо по цене и словам в названии — по файлу так не поищешь.
 *
 * Читаем потоком. Выгрузка Читай-города — 674 мегабайта и триста тысяч
 * товаров; прочитать её целиком нельзя даже при желании, строка такой длины
 * в JavaScript не существует.
 */

import { prisma } from "@/lib/prisma";
import {
  parseCategories,
  parseShopName,
  takeOffers,
  type FeedProduct,
} from "@/lib/products/feed";

/** Раз в сутки: чаще магазины выгрузку и не обновляют. */
const STALE_AFTER_MS = 20 * 60 * 60 * 1000;

/** Сколько товаров пишем одной транзакцией. */
const CHUNK = 200;

/**
 * Предел на начало файла, где лежит справочник категорий.
 *
 * Нужен на случай, если выгрузка окажется без товаров вовсе: без него
 * ожидание метки `<offers>` съело бы все шестьсот мегабайт в память — ровно
 * то, от чего мы тут уходим.
 */
const HEAD_LIMIT = 8 * 1024 * 1024;

export interface ImportResult {
  feed: string;
  saved: number;
  skipped: number;
  gone: number;
  error?: string;
}

async function save(feedId: string, products: FeedProduct[]): Promise<void> {
  await prisma.$transaction(
    products.map((product) =>
      prisma.product.upsert({
        where: { feedId_externalId: { feedId, externalId: product.externalId } },
        create: { feedId, ...product },
        update: product,
      }),
    ),
  );
}

/**
 * Разбирает одну выгрузку.
 *
 * Товары, которых в ней больше нет, не удаляем, а помечаем отсутствующими:
 * на них могут стоять ссылки в уже вышедших постах, и превращать их в
 * пустоту нечестно. Заодно магазин мог просто выложить неполный файл, и
 * удаление стёрло бы половину каталога из-за чужой ошибки.
 *
 * Отличаем пропавшие по времени записи, а не по списку: перечислить триста
 * тысяч идентификаторов в одном запросе нельзя.
 */
export async function importFeed(feed: {
  id: string;
  name: string;
  url: string;
  include?: string | null;
}): Promise<ImportResult> {
  const startedAt = new Date();

  try {
    const res = await fetch(feed.url, { signal: AbortSignal.timeout(900_000) });
    if (!res.ok) throw new Error(`магазин ответил ${res.status}`);
    if (!res.body) throw new Error("магазин прислал пустой ответ");

    // Отбор по разделу: у больших магазинов в подарок годится малая часть
    // каталога, и тащить к себе остальное незачем.
    const only = feed.include ? new RegExp(feed.include, "i") : null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let categories = new Map<string, string>();
    let inOffers = false;
    let batch: FeedProduct[] = [];
    let saved = 0;
    let skipped = 0;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      if (!inOffers) {
        const start = buffer.indexOf("<offers>");

        if (start === -1) {
          if (buffer.length > HEAD_LIMIT) {
            throw new Error("не нашёл товаров в начале выгрузки");
          }
          continue;
        }

        const head = buffer.slice(0, start);
        categories = parseCategories(head);
        if (!feed.name) parseShopName(head);
        buffer = buffer.slice(start);
        inOffers = true;
      }

      const { products, rest } = takeOffers(buffer, categories);
      buffer = rest;

      for (const product of products) {
        if (only && !only.test(product.category ?? "")) {
          skipped++;
          continue;
        }
        batch.push(product);
      }

      while (batch.length >= CHUNK) {
        await save(feed.id, batch.splice(0, CHUNK));
        saved += CHUNK;
      }
    }

    if (batch.length > 0) {
      await save(feed.id, batch);
      saved += batch.length;
    }

    if (saved === 0) throw new Error("в выгрузке нет подходящих товаров");

    const { count: gone } = await prisma.product.updateMany({
      where: { feedId: feed.id, updatedAt: { lt: startedAt }, available: true },
      data: { available: false },
    });

    await prisma.productFeed.update({
      where: { id: feed.id },
      data: { importedAt: new Date(), count: saved, error: null },
    });

    return { feed: feed.name, saved, skipped, gone };
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 300);

    await prisma.productFeed
      .update({ where: { id: feed.id }, data: { error: message } })
      .catch(() => {});

    return { feed: feed.name, saved: 0, skipped: 0, gone: 0, error: message };
  }
}

/** Все выгрузки, которые давно не обновлялись. `force` берёт все подряд. */
export async function importDueFeeds(force = false): Promise<ImportResult[]> {
  const feeds = await prisma.productFeed.findMany({
    where: {
      enabled: true,
      ...(force
        ? {}
        : {
            OR: [
              { importedAt: null },
              { importedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } },
            ],
          }),
    },
  });

  const results: ImportResult[] = [];
  // По очереди, а не разом: две выгрузки одновременно — это два потока и
  // две очереди записи, и контейнеру от такого становится плохо.
  for (const feed of feeds) {
    results.push(await importFeed(feed));
  }

  return results;
}
