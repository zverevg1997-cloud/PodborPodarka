/**
 * Токен ВКонтакте, который сам себя продлевает.
 *
 * Новый вход ВК выдаёт токен на час и refresh_token к нему. Час — это
 * меньше, чем промежуток между постами, поэтому без продления публикация с
 * картинками ломалась бы почти сразу после настройки.
 *
 * Хранится он в базе, а не в переменных окружения: переменные задаются
 * снаружи и только при запуске контейнера, а этот меняется сам. В .env
 * остаётся первая пара, с которой всё начинается, — её кладёт туда
 * scripts/vk-token.mjs.
 */

import { prisma } from "@/lib/prisma";

const ACCESS = "vk_access_token";
const REFRESH = "vk_refresh_token";
const EXPIRES = "vk_expires_at";

/** Обновляем заранее: иначе токен успеет истечь между проверкой и запросом. */
const RENEW_BEFORE_MS = 5 * 60 * 1000;

async function read(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function write(values: Record<string, string>): Promise<void> {
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    ),
  );
}

/**
 * Продлевает токен по refresh_token.
 *
 * ВК отдаёт новый refresh_token вместе с новым токеном и старый тут же
 * гасит, поэтому сохранять надо оба и сразу: потеряв новый, мы потеряем и
 * возможность продлиться дальше.
 */
async function refresh(refreshToken: string): Promise<string | null> {
  const secret = process.env.VK_APP_SECRET;

  const res = await fetch("https://id.vk.com/oauth2/auth", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.VK_APP_ID ?? "",
      ...(secret ? { client_secret: secret } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    console.error("вк: токен не продлился", JSON.stringify(data).slice(0, 300));
    return null;
  }

  await write({
    [ACCESS]: data.access_token,
    ...(data.refresh_token ? { [REFRESH]: data.refresh_token } : {}),
    [EXPIRES]: String(
      // Без срока считаем, что час: у ВК это значение по умолчанию.
      Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600_000),
    ),
  });

  return data.access_token;
}

/**
 * Действующий токен для запросов к ВКонтакте.
 *
 * Первый вызов переносит пару из переменных окружения в базу — дальше она
 * живёт там и обновляется сама.
 */
export async function vkAccessToken(): Promise<string | null> {
  const fromEnv = process.env.VK_TOKEN ?? null;
  const refreshFromEnv = process.env.VK_REFRESH_TOKEN ?? null;

  // Бессрочный токен старого образца продлевать нечем и незачем.
  if (fromEnv && !refreshFromEnv) return fromEnv;

  let stored = await read(ACCESS);
  let storedRefresh = await read(REFRESH);

  if (!stored && fromEnv) {
    await write({
      [ACCESS]: fromEnv,
      ...(refreshFromEnv ? { [REFRESH]: refreshFromEnv } : {}),
      // Срока из .env мы не знаем, поэтому считаем истёкшим: пусть первое
      // же обращение честно сходит за новым, чем мы будем гадать.
      [EXPIRES]: "0",
    });
    stored = fromEnv;
    storedRefresh = refreshFromEnv;
  }

  const expiresAt = Number(await read(EXPIRES)) || 0;

  if (stored && Date.now() < expiresAt - RENEW_BEFORE_MS) return stored;

  if (storedRefresh) {
    const renewed = await refresh(storedRefresh);
    if (renewed) return renewed;
  }

  // Продлить не вышло — отдаём что есть. Скорее всего запрос упадёт, но с
  // внятной ошибкой от самого ВК, а не с нашим молчанием.
  return stored;
}
