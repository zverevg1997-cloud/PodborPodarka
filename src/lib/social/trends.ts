/**
 * Поиск взлетевших тем в чужих сообществах.
 *
 * Условие срабатывания — не расписание, а превышение. Запись присылается,
 * только если она обогнала **медиану своего же сообщества** втрое и больше.
 *
 * Почему именно медиану своего, а не абсолютное число просмотров: в разборе
 * сообществ (docs/smm.md) видно, что сообщество на 513 подписчиков собирает
 * больше просмотров, чем витрина на 209 тысяч. Единой планки для обоих не
 * существует, и любая попытка её назначить будет либо шумом, либо тишиной.
 *
 * В тихую неделю находок не будет вовсе. Это правильное поведение, а не
 * поломка: три черновика дважды в день просто потому, что настало время,
 * перестают открывать через неделю.
 */

import { prisma } from "@/lib/prisma";

/** Во сколько раз запись должна обогнать своё сообщество. */
const TIMES = 3;

/** Сколько записей берём, чтобы посчитать медиану. */
const SAMPLE = 50;

/** Свежие записи не берём: они ещё не набрали просмотры и обгонят кого угодно. */
const MIN_AGE_MS = 18 * 60 * 60 * 1000;

/** Слишком старое уже не тема, а история. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** За сколько назад считаем тему повторной. */
const REPEAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface VkPost {
  id: number;
  date: number;
  text?: string;
  views?: { count?: number };
  is_pinned?: number;
}

export interface Trend {
  handle: string;
  postId: string;
  views: number;
  median: number;
  ratio: number;
  text: string;
  url: string;
  topicKey: string;
}

/**
 * Ключ темы: пять самых длинных слов записи по алфавиту.
 *
 * Пересказ той же новости в другом сообществе даёт тот же набор длинных
 * слов, даже если фразы разные. Для отсева повторов этого достаточно, а
 * сравнивать тексты целиком здесь было бы и дороже, и хуже.
 */
function topicOf(text: string): string {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^а-яёa-z\s]/gi, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 6),
    ),
  ]
    .sort((a, b) => b.length - a.length)
    .slice(0, 5)
    .sort()
    .join("-");
}

function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function wallGet(handle: string): Promise<VkPost[]> {
  const token = process.env.VK_SERVICE_TOKEN;
  if (!token) throw new Error("VK_SERVICE_TOKEN не задан");

  const res = await fetch("https://api.vk.com/method/wall.get", {
    method: "POST",
    body: new URLSearchParams({
      domain: handle,
      count: String(SAMPLE),
      access_token: token,
      v: "5.199",
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const data = (await res.json()) as {
    response?: { items?: VkPost[] };
    error?: { error_msg?: string };
  };

  if (data.error) throw new Error(data.error.error_msg ?? "ВКонтакте отказал");
  return data.response?.items ?? [];
}

/** Разбирает одно сообщество. Возвращает только то, что действительно взлетело. */
export async function scanSource(source: {
  id: string;
  handle: string;
}): Promise<Trend[]> {
  const now = Date.now();

  const posts = (await wallGet(source.handle)).filter(
    // Закреплённая запись висит месяцами и набирает просмотры просто так.
    (post) => !post.is_pinned && (post.views?.count ?? 0) > 0,
  );

  if (posts.length < 10) {
    throw new Error("слишком мало записей, чтобы считать медиану");
  }

  const middle = median(posts.map((post) => post.views?.count ?? 0));

  await prisma.trendSource.update({
    where: { id: source.id },
    data: { checkedAt: new Date(), median: middle, error: null },
  });

  if (middle === 0) return [];

  const found: Trend[] = [];

  for (const post of posts) {
    const age = now - post.date * 1000;
    if (age < MIN_AGE_MS || age > MAX_AGE_MS) continue;

    const views = post.views?.count ?? 0;
    const ratio = views / middle;
    if (ratio < TIMES) continue;

    const text = (post.text ?? "").trim();
    if (text.length < 40) continue;

    found.push({
      handle: source.handle,
      postId: `${source.handle}_${post.id}`,
      views,
      median: middle,
      ratio: Math.round(ratio * 10) / 10,
      text,
      url: `https://vk.com/${source.handle}?w=wall-0_${post.id}`,
      topicKey: topicOf(text),
    });
  }

  return found;
}

/**
 * Проходит по всем сообществам и возвращает новые находки.
 *
 * Уже виденное отсеивается дважды: по самой записи и по теме за последнюю
 * неделю. Второе важнее — один удачный сюжет пересказывают друг у друга все
 * подряд, и без этого он пришёл бы пять раз от пяти сообществ.
 */
export async function findTrends(): Promise<{ trends: Trend[]; errors: string[] }> {
  const sources = await prisma.trendSource.findMany({ where: { enabled: true } });
  const trends: Trend[] = [];
  const errors: string[] = [];

  for (const source of sources) {
    try {
      trends.push(...(await scanSource(source)));
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error).slice(0, 200);
      errors.push(`${source.handle}: ${message}`);
      await prisma.trendSource
        .update({ where: { id: source.id }, data: { error: message } })
        .catch(() => {});
    }
  }

  const since = new Date(Date.now() - REPEAT_WINDOW_MS);
  const fresh: Trend[] = [];

  for (const trend of trends.sort((a, b) => b.ratio - a.ratio)) {
    const seen = await prisma.trendFind.findFirst({
      where: {
        OR: [
          { network: "vk", postId: trend.postId },
          { topicKey: trend.topicKey, foundAt: { gte: since } },
        ],
      },
    });
    if (seen) continue;

    await prisma.trendFind.create({ data: { network: "vk", ...trend } });
    fresh.push(trend);
  }

  return { trends: fresh, errors };
}
