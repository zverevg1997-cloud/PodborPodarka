/**
 * Загрузка товарных выгрузок в базу.
 *
 * Держим товары у себя, а не ходим в выгрузку при каждом обращении: файл
 * весит мегабайты, обновляется раз в сутки, а выбирать из него надо по цене
 * и словам в названии — по файлу так не поищешь.
 */

import { prisma } from "@/lib/prisma";
import { parseFeed, type FeedProduct } from "@/lib/products/feed";

/** Раз в сутки: чаще магазины выгрузку и не обновляют. */
const STALE_AFTER_MS = 20 * 60 * 60 * 1000;

/** Сколько товаров пишем одним заходом. */
const CHUNK = 200;

export interface ImportResult {
  feed: string;
  added: number;
  updated: number;
  gone: number;
  error?: string;
}

async function save(
  feedId: string,
  products: FeedProduct[],
): Promise<{ added: number; updated: number }> {
  const before = await prisma.product.count({ where: { feedId } });

  // Пишем кусками: одна транзакция на две с половиной тысячи записей
  // держит соединение минуту и упирается в таймаут.
  for (let i = 0; i < products.length; i += CHUNK) {
    await prisma.$transaction(
      products.slice(i, i + CHUNK).map((product) =>
        prisma.product.upsert({
          where: {
            feedId_externalId: { feedId, externalId: product.externalId },
          },
          create: { feedId, ...product },
          update: product,
        }),
      ),
    );
  }

  const after = await prisma.product.count({ where: { feedId } });
  const added = after - before;

  return { added, updated: products.length - added };
}

/**
 * Разбирает одну выгрузку.
 *
 * Товары, которых в ней больше нет, не удаляем, а помечаем отсутствующими:
 * на них могут стоять ссылки в уже вышедших постах, и превращать их в
 * пустоту нечестно. Заодно магазин мог просто выложить неполный файл, и
 * удаление стёрло бы половину каталога из-за чужой ошибки.
 */
export async function importFeed(feed: {
  id: string;
  name: string;
  url: string;
}): Promise<ImportResult> {
  try {
    const res = await fetch(feed.url, { signal: AbortSignal.timeout(180_000) });
    if (!res.ok) throw new Error(`магазин ответил ${res.status}`);

    const { products } = parseFeed(await res.text());
    if (products.length === 0) throw new Error("в выгрузке нет товаров");

    const { added, updated } = await save(feed.id, products);

    const present = products.map((product) => product.externalId);
    const { count: gone } = await prisma.product.updateMany({
      where: { feedId: feed.id, externalId: { notIn: present }, available: true },
      data: { available: false },
    });

    await prisma.productFeed.update({
      where: { id: feed.id },
      data: { importedAt: new Date(), count: products.length, error: null },
    });

    return { feed: feed.name, added, updated, gone };
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 300);

    await prisma.productFeed
      .update({ where: { id: feed.id }, data: { error: message } })
      .catch(() => {});

    return { feed: feed.name, added: 0, updated: 0, gone: 0, error: message };
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
  // По очереди, а не разом: выгрузки весят мегабайты, и разбирать несколько
  // одновременно — верный способ упереться в память контейнера.
  for (const feed of feeds) {
    results.push(await importFeed(feed));
  }

  return results;
}
