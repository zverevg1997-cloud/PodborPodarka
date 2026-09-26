/**
 * Публикация запланированных постов.
 *
 * Работает так: раз в минуту смотрим, не подошло ли время у одобренных
 * постов, и публикуем их в обе сети. Ничего не публикуется без одобрения —
 * это намеренно. Один нелепый пост в ленте стоит дороже, чем сэкономленные
 * пять минут на просмотр.
 *
 * Замок тот же по смыслу, что у слушателя телеграма: при выкатке контейнеры
 * какое-то время живут парой, и без него оба опубликуют один и тот же пост.
 */

import { prisma } from "@/lib/prisma";
import { holdLock, releaseLock } from "@/lib/systemLock";
import { getFileBytes, sendMessage, sendPhoto } from "@/lib/telegram/api";
import { isVkConfigured, postToWall } from "@/lib/social/vk";

const LOCK = "social-scheduler";

/** Как часто смотрим на очередь. Минуты достаточно: посты не срочные. */
const TICK_MS = 60_000;

/** За сколько предупреждаем, что к посту нет картинки. */
const WARN_AHEAD_MS = 24 * 60 * 60 * 1000;

/** Ограничение телеграма на подпись к картинке. */
const CAPTION_LIMIT = 1024;

/** Как часто заглядываем, не устарели ли товарные выгрузки. */
const FEED_CHECK_MS = 30 * 60 * 1000;

let running = false;
let feedsCheckedAt = 0;

/**
 * Обновление выгрузок.
 *
 * Запускаем в стороне, не дожидаясь: разбор нескольких мегабайт занимает
 * минуты, а расписание постов ждать не может — пост, назначенный на это
 * время, вышел бы с опозданием.
 */
function refreshFeedsInBackground(): void {
  if (Date.now() - feedsCheckedAt < FEED_CHECK_MS) return;
  feedsCheckedAt = Date.now();

  void import("@/lib/products/import")
    .then(({ importDueFeeds }) => importDueFeeds())
    .then((results) => {
      for (const r of results) {
        console.log(
          r.error
            ? `выгрузка «${r.feed}»: ${r.error}`
            : `выгрузка «${r.feed}»: новых ${r.added}, обновлено ${r.updated}, пропало ${r.gone}`,
        );
      }
    })
    .catch((error) => console.error("выгрузки: обновить не вышло", error));
}

function channel(): string | null {
  return process.env.TELEGRAM_CHANNEL ?? null;
}

function admin(): string | null {
  return process.env.TELEGRAM_ADMIN_ID ?? null;
}

/** Сообщение администратору. Молчать о сбое хуже, чем разбудить. */
async function tellAdmin(text: string): Promise<void> {
  const to = admin();
  if (!to) return;
  await sendMessage(to, text).catch(() => {});
}

async function publishToTelegram(
  text: string,
  photoFileId: string | null,
): Promise<string | null> {
  const to = channel();
  if (!to) throw new Error("TELEGRAM_CHANNEL не задан");

  // С картинкой пост выглядит иначе и занимает в ленте больше места, но
  // подпись к ней ограничена. Длинный текст отправляем отдельно, чтобы он
  // не обрезался молча.
  if (photoFileId && text.length <= CAPTION_LIMIT) {
    const sent = (await sendPhoto(to, photoFileId, text)) as {
      result?: { message_id?: number };
    } | null;
    if (!sent?.result?.message_id) throw new Error("телеграм не принял пост с картинкой");
    return String(sent.result.message_id);
  }

  if (photoFileId) {
    await sendPhoto(to, photoFileId, "");
  }

  const sent = (await sendMessage(to, text)) as {
    result?: { message_id?: number };
  } | null;
  if (!sent?.result?.message_id) throw new Error("телеграм не принял пост");
  return String(sent.result.message_id);
}

/** Один пост: публикуем туда, куда он назначен, и записываем результат. */
async function publish(post: {
  id: string;
  key: string;
  networks: string;
  textVk: string;
  textTg: string;
  needsPhoto: boolean;
  photoFileId: string | null;
  vkPostId: string | null;
  tgMessageId: string | null;
}): Promise<void> {
  // Сеть, куда пост уже ушёл, пропускаем. Публикация идёт в две сети по
  // очереди, и падение второй не отменяет первую: без этой проверки повтор
  // выложил бы запись в канал ещё раз.
  const toVk =
    (post.networks === "both" || post.networks === "vk") && !post.vkPostId;
  const toTg =
    (post.networks === "both" || post.networks === "tg") && !post.tgMessageId;

  // Картинку скачиваем один раз: она нужна ВКонтакте в виде байтов, а
  // телеграму хватает его собственного идентификатора файла.
  const image =
    toVk && post.photoFileId ? await getFileBytes(post.photoFileId) : null;

  if (toVk && post.photoFileId && !image) {
    throw new Error("картинка не скачалась из телеграма");
  }

  let vkPostId: string | null = post.vkPostId;
  let tgMessageId: string | null = post.tgMessageId;
  let vkWithoutPhoto: string | null = null;

  try {
    // Телеграм первым: он надёжнее, и если упадёт ВКонтакте, пост хотя бы
    // выйдет в канале, а не потеряется целиком.
    if (toTg) {
      tgMessageId = await publishToTelegram(post.textTg, post.photoFileId);
    }

    if (toVk) {
      if (!isVkConfigured()) throw new Error("VK_TOKEN или VK_GROUP_ID не заданы");

      try {
        vkPostId = await postToWall(post.textVk, image);
      } catch (error) {
        // Пост, к которому фотография и есть содержание, без неё выпускать
        // нельзя: список товаров без картинок хуже, чем ничего. А вот запись
        // с карточкой лучше выпустить текстом, чем потерять целиком —
        // расписание сдвигать некуда, время у неё одно.
        if (post.needsPhoto || !image) throw error;

        vkWithoutPhoto = String(error instanceof Error ? error.message : error).slice(0, 300);
        vkPostId = await postToWall(post.textVk, null);
      }
    }
  } catch (error) {
    // Запоминаем то, что уже получилось, и только потом отдаём ошибку выше.
    // Иначе удачная половина работы потеряется, и повтор сделает её заново.
    if (vkPostId !== post.vkPostId || tgMessageId !== post.tgMessageId) {
      await prisma.scheduledPost
        .update({ where: { id: post.id }, data: { vkPostId, tgMessageId } })
        .catch(() => {});
    }
    throw error;
  }

  await prisma.scheduledPost.update({
    where: { id: post.id },
    data: {
      status: "published",
      publishedAt: new Date(),
      vkPostId,
      tgMessageId,
      error: null,
    },
  });

  const where = [
    vkPostId ? `вк: vk.com/wall-${process.env.VK_GROUP_ID}_${vkPostId}` : null,
    tgMessageId ? "телеграм: опубликован" : null,
  ]
    .filter(Boolean)
    .join("\n");

  await tellAdmin(`Опубликован пост ${post.key}\n${where}`);
}

/**
 * Напоминание за сутки о постах без картинки.
 *
 * Раньше об этом можно было узнать только в момент, когда пост уже не вышел,
 * — то есть поздно. Суток хватает, чтобы подобрать товар и сфотографировать
 * его или собрать карточку.
 *
 * Предупреждаем одним сообщением на все такие посты и ровно один раз: то же
 * самое каждую минуту до публикации быстро научило бы не читать эти письма.
 */
async function warnAboutMissingPhotos(): Promise<void> {
  const soon = new Date(Date.now() + WARN_AHEAD_MS);

  const posts = await prisma.scheduledPost.findMany({
    where: {
      status: { in: ["draft", "approved"] },
      // Опросы и видео публикуются руками, картинка им не нужна.
      kind: "post",
      photoFileId: null,
      warnedAt: null,
      publishAt: { lte: soon, gte: new Date() },
    },
    orderBy: { publishAt: "asc" },
  });

  if (posts.length === 0) return;

  const when = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines = posts.map((post) => {
    // Разница существенная: один пост без картинки просто выйдет хуже,
    // а другой не выйдет вовсе, и это надо сказать разными словами.
    const consequence = post.needsPhoto
      ? "без неё не выйдет"
      : "выйдет текстом, в ВК это заметно срежет охват";
    return `${when.format(post.publishAt)} — ${post.key}\n   ${consequence}`;
  });

  await tellAdmin(
    `Через сутки выходят посты без картинки:\n\n${lines.join("\n")}\n\n` +
      "Пришлите картинку и укажите в подписи ключ поста.",
  );

  await prisma.scheduledPost.updateMany({
    where: { id: { in: posts.map((post) => post.id) } },
    data: { warnedAt: new Date() },
  });
}

/** Один проход по очереди. */
async function tick(): Promise<void> {
  await warnAboutMissingPhotos();

  const due = await prisma.scheduledPost.findMany({
    where: { status: "approved", publishAt: { lte: new Date() } },
    orderBy: { publishAt: "asc" },
    take: 5,
  });

  for (const post of due) {
    // Опросы и видео публикуются руками: в каждой сети у них свой формат,
    // и автоматизировать это ради нескольких записей не стоит.
    if (post.kind !== "post") {
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "manual" },
      });
      await tellAdmin(
        `Пора публиковать руками (${post.kind === "poll" ? "опрос" : "видео"}), ключ ${post.key}:\n\n${post.textTg}`,
      );
      continue;
    }

    if (post.needsPhoto && !post.photoFileId) {
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "failed", error: "нет фотографии товара" },
      });
      await tellAdmin(
        `Пост ${post.key} не вышел: нужна фотография товара. Пришлите её мне с подписью ${post.key}, и я опубликую.`,
      );
      continue;
    }

    try {
      await publish(post);
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error).slice(0, 400);
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "failed", error: message },
      });
      await tellAdmin(`Пост ${post.key} не опубликовался:\n${message}`);
    }
  }
}

export async function startScheduler(): Promise<void> {
  if (running) return;
  running = true;

  while (!(await holdLock(LOCK))) {
    await new Promise((r) => setTimeout(r, 30_000));
  }

  const release = () => {
    void releaseLock(LOCK);
  };
  process.once("SIGTERM", release);
  process.once("SIGINT", release);

  console.log("посты: слежу за расписанием");

  for (;;) {
    try {
      if (!(await holdLock(LOCK))) {
        console.log("посты: замок потерян, расписание ведёт другой процесс");
        running = false;
        return;
      }

      refreshFeedsInBackground();
      await tick();
    } catch (error) {
      console.error("посты: проход не удался", error);
    }

    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}
